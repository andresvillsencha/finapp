'use strict';

/**
 * Parsing and applying Ext JS remote sort / filter / paging parameters.
 *
 * Ext JS (remoteSort / remoteFilter) sends:
 *   sort   = [{"property":"symbol","direction":"ASC"}]   (JSON, URL-encoded)
 *   filter = [{"property":"sector","value":"Tech","operator":"like"}]
 *   page / start / limit
 * Everything is whitelisted: unknown fields, operators or malformed JSON are
 * rejected with HTTP 400. Nothing client-supplied is ever evaluated.
 */
const { badRequest } = require('./errors');

const OPERATORS = {
    '=': 'eq', '==': 'eq', '===': 'eq', eq: 'eq',
    '!=': 'ne', '!==': 'ne', ne: 'ne',
    '<': 'lt', lt: 'lt',
    '<=': 'le', le: 'le', lte: 'le',
    '>': 'gt', gt: 'gt',
    '>=': 'ge', ge: 'ge', gte: 'ge',
    like: 'like',
    in: 'in',
    notin: 'notin'
};
const MAX_SORTERS = 5;
const MAX_FILTERS = 10;

function parseJson(name, raw, code) {
    if (typeof raw !== 'string') {
        throw badRequest(code, `Parameter "${name}" must be a JSON string.`);
    }
    try {
        return JSON.parse(raw);
    } catch (err) {
        throw badRequest(code, `Parameter "${name}" is not valid JSON.`);
    }
}

function parseIntStrict(name, raw, min, code) {
    if (typeof raw !== 'string' || !/^\d+$/.test(raw)) {
        throw badRequest(code, `Parameter "${name}" must be an integer >= ${min}.`);
    }
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < min) {
        throw badRequest(code, `Parameter "${name}" must be an integer >= ${min}.`);
    }
    return value;
}

/**
 * Returns [{ property, direction: 'ASC'|'DESC' }]. `sortable` is a Set of
 * allowed property names. Also accepts the simple form ?sort=symbol&dir=DESC.
 */
function parseSorters(rawSort, rawDir, sortable) {
    if (rawSort === undefined || rawSort === '') {
        return [];
    }
    let items;
    const text = typeof rawSort === 'string' ? rawSort.trim() : '';
    if (text.startsWith('[') || text.startsWith('{')) {
        items = parseJson('sort', rawSort, 'INVALID_SORTER');
        if (!Array.isArray(items)) {
            items = [items];
        }
    } else if (typeof rawSort === 'string') {
        items = [{ property: rawSort, direction: rawDir || 'ASC' }];
    } else {
        throw badRequest('INVALID_SORTER', 'Parameter "sort" is invalid.');
    }
    if (items.length > MAX_SORTERS) {
        throw badRequest('INVALID_SORTER', `At most ${MAX_SORTERS} sorters are allowed.`);
    }
    return items.map((item) => {
        if (!item || typeof item !== 'object' || typeof item.property !== 'string') {
            throw badRequest('INVALID_SORTER', 'Each sorter needs a "property".');
        }
        if (!sortable.has(item.property)) {
            throw badRequest('INVALID_SORTER', `Cannot sort by "${item.property}".`);
        }
        const direction = String(item.direction || 'ASC').toUpperCase();
        if (direction !== 'ASC' && direction !== 'DESC') {
            throw badRequest('INVALID_SORTER', 'Sort direction must be ASC or DESC.');
        }
        return { property: item.property, direction };
    });
}

function toNumber(raw, property) {
    const value = typeof raw === 'number' ? raw : (typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN);
    if (!Number.isFinite(value)) {
        throw badRequest('INVALID_FILTER', `Filter value for "${property}" must be a number.`);
    }
    return value;
}

function toDateMs(raw, property) {
    const value = typeof raw === 'string' ? Date.parse(raw) : NaN;
    if (!Number.isFinite(value)) {
        throw badRequest('INVALID_FILTER', `Filter value for "${property}" must be an ISO date.`);
    }
    return value;
}

function typedValue(spec, property, raw) {
    switch (spec.type) {
        case 'number':
            return toNumber(raw, property);
        case 'date':
            return toDateMs(raw, property);
        case 'enum': {
            const upper = String(raw).toUpperCase();
            if (!spec.values.includes(upper)) {
                throw badRequest('INVALID_FILTER', `"${property}" must be one of ${spec.values.join(', ')}.`);
            }
            return upper;
        }
        default:
            if (typeof raw !== 'string' && typeof raw !== 'number') {
                throw badRequest('INVALID_FILTER', `Filter value for "${property}" must be text.`);
            }
            return String(raw).toLowerCase();
    }
}

/**
 * Returns [{ property, op, value }] with typed values. `schema` maps a property
 * to { type: 'string'|'number'|'date'|'enum', values? }.
 * A missing operator means "contains" for text and "equals" otherwise.
 */
function parseFilters(rawFilter, schema) {
    if (rawFilter === undefined || rawFilter === '') {
        return [];
    }
    let items = parseJson('filter', rawFilter, 'INVALID_FILTER');
    if (!Array.isArray(items)) {
        items = [items];
    }
    if (items.length > MAX_FILTERS) {
        throw badRequest('INVALID_FILTER', `At most ${MAX_FILTERS} filters are allowed.`);
    }
    return items.map((item) => {
        if (!item || typeof item !== 'object' || typeof item.property !== 'string') {
            throw badRequest('INVALID_FILTER', 'Each filter needs a "property".');
        }
        const spec = schema[item.property];
        if (!spec) {
            throw badRequest('INVALID_FILTER', `Cannot filter by "${item.property}".`);
        }
        let op;
        if (item.operator === undefined || item.operator === null || item.operator === '') {
            op = spec.type === 'string' ? 'like' : 'eq';
        } else {
            op = OPERATORS[String(item.operator)];
            if (!op) {
                throw badRequest('INVALID_FILTER', `Unsupported operator "${item.operator}".`);
            }
        }
        if (spec.type === 'string' && ['lt', 'le', 'gt', 'ge'].includes(op)) {
            throw badRequest('INVALID_FILTER', `Operator "${item.operator}" is not supported for text field "${item.property}".`);
        }
        if (spec.type === 'enum' && op === 'like') {
            op = 'eq';
        }
        if (item.value === undefined) {
            throw badRequest('INVALID_FILTER', `Filter for "${item.property}" needs a "value".`);
        }
        let value;
        if (op === 'in' || op === 'notin') {
            const list = Array.isArray(item.value) ? item.value : String(item.value).split(',');
            if (list.length === 0 || list.length > 100) {
                throw badRequest('INVALID_FILTER', `"${item.property}" list must contain 1 to 100 values.`);
            }
            value = list.map((v) => typedValue(spec, item.property, typeof v === 'string' ? v.trim() : v));
        } else {
            value = typedValue(spec, item.property, item.value);
        }
        return { property: item.property, op, value, type: spec.type };
    });
}

function rowValue(row, filter) {
    const raw = row[filter.property];
    if (raw === null || raw === undefined) {
        return null;
    }
    if (filter.type === 'number') {
        return raw;
    }
    if (filter.type === 'date') {
        return Date.parse(raw);
    }
    if (filter.type === 'enum') {
        // Enum filter values are normalized to upper case by typedValue().
        return String(raw).toUpperCase();
    }
    return String(raw).toLowerCase();
}

function matches(row, filter) {
    const actual = rowValue(row, filter);
    if (actual === null) {
        return filter.op === 'ne' || filter.op === 'notin';
    }
    const { op, value } = filter;
    switch (op) {
        case 'eq': return actual === value;
        case 'ne': return actual !== value;
        case 'lt': return actual < value;
        case 'le': return actual <= value;
        case 'gt': return actual > value;
        case 'ge': return actual >= value;
        case 'like': return String(actual).includes(value);
        case 'in': return value.includes(actual);
        case 'notin': return !value.includes(actual);
        default: return false;
    }
}

function applyFilters(rows, filters) {
    if (filters.length === 0) {
        return rows;
    }
    return rows.filter((row) => filters.every((f) => matches(row, f)));
}

function compareValues(a, b) {
    if (a === b) {
        return 0;
    }
    if (a === null || a === undefined) {
        return -1;
    }
    if (b === null || b === undefined) {
        return 1;
    }
    if (typeof a === 'string' && typeof b === 'string') {
        const x = a.toLowerCase();
        const y = b.toLowerCase();
        return x < y ? -1 : (x > y ? 1 : 0);
    }
    return a < b ? -1 : 1;
}

/** Stable multi-key sort with a deterministic final tie-break on `tieBreak`. */
function applySorters(rows, sorters, tieBreak) {
    const all = sorters.slice();
    if (tieBreak && !all.some((s) => s.property === tieBreak)) {
        all.push({ property: tieBreak, direction: 'ASC' });
    }
    return rows.slice().sort((a, b) => {
        for (const s of all) {
            const c = compareValues(a[s.property], b[s.property]);
            if (c !== 0) {
                return s.direction === 'DESC' ? -c : c;
            }
        }
        return 0;
    });
}

/**
 * Ext JS paging parameters: page / start / limit. `start` wins when both are
 * given. limit defaults to settings.page_size and is clamped to max_page_size.
 */
function parsePaging(query, settings) {
    const maxLimit = settings.max_page_size;
    let limit = settings.page_size;
    if (query.limit !== undefined) {
        limit = Math.min(parseIntStrict('limit', query.limit, 1, 'INVALID_PAGING'), maxLimit);
    }
    let offset = 0;
    if (query.start !== undefined) {
        offset = parseIntStrict('start', query.start, 0, 'INVALID_PAGING');
    } else if (query.page !== undefined) {
        offset = (parseIntStrict('page', query.page, 1, 'INVALID_PAGING') - 1) * limit;
    }
    return { offset, limit, page: Math.floor(offset / limit) + 1 };
}

/**
 * Filter first, sort second, paginate last. `total` is the number of rows
 * matching the filters BEFORE pagination.
 */
function runCollectionQuery(rows, query, options) {
    const { schema, sortable, settings, defaultSort = [], tieBreak, paged = true } = options;
    const filters = parseFilters(query.filter, schema);
    const requested = parseSorters(query.sort, query.dir, sortable);
    const sorters = requested.length > 0 ? requested : defaultSort;
    const filtered = applyFilters(rows, filters);
    const sorted = applySorters(filtered, sorters, tieBreak);
    if (!paged) {
        return { data: sorted, total: sorted.length, paging: null };
    }
    const paging = parsePaging(query, settings);
    return {
        data: sorted.slice(paging.offset, paging.offset + paging.limit),
        total: sorted.length,
        paging
    };
}

module.exports = {
    parseSorters,
    parseFilters,
    parsePaging,
    applyFilters,
    applySorters,
    runCollectionQuery,
    parseIntStrict
};
