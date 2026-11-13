'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseSorters, parseFilters, parsePaging, runCollectionQuery } = require('../src/utils/query');
const { csvCell, toCsv } = require('../src/utils/csv');
const { AppError } = require('../src/utils/errors');

const SETTINGS = { page_size: 25, max_page_size: 100 };
const SCHEMA = {
    symbol: { type: 'string' },
    value: { type: 'number' },
    side: { type: 'enum', values: ['BUY', 'SELL'] },
    when: { type: 'date' }
};
const SORTABLE = new Set(['symbol', 'value', 'id']);
const rows = Array.from({ length: 30 }, (_, i) => ({
    id: String(i + 1).padStart(2, '0'),
    symbol: `S${String(i % 10)}`,
    value: i * 10,
    side: i % 2 ? 'SELL' : 'BUY',
    when: new Date(Date.UTC(2025, 0, 1 + i)).toISOString()
}));
const badRequest = (fn, code) => assert.throws(fn, (e) => e instanceof AppError && e.status === 400 && e.code === code);

test('sorters: Ext JSON form, simple form, direction, whitelist', () => {
    assert.deepEqual(parseSorters(JSON.stringify([{ property: 'symbol', direction: 'desc' }]), undefined, SORTABLE),
        [{ property: 'symbol', direction: 'DESC' }]);
    assert.deepEqual(parseSorters('value', 'DESC', SORTABLE), [{ property: 'value', direction: 'DESC' }]);
    assert.deepEqual(parseSorters(undefined, undefined, SORTABLE), []);
    badRequest(() => parseSorters('[{"property":"password"}]', undefined, SORTABLE), 'INVALID_SORTER');
    badRequest(() => parseSorters('[{"property":"symbol","direction":"SIDEWAYS"}]', undefined, SORTABLE), 'INVALID_SORTER');
    badRequest(() => parseSorters('[not json', undefined, SORTABLE), 'INVALID_SORTER');
});

test('filters: operators, typed values, whitelist, invalid payloads', () => {
    const [f] = parseFilters('[{"property":"value","operator":">=","value":"50"}]', SCHEMA);
    assert.deepEqual([f.property, f.op, f.value], ['value', 'ge', 50]);
    assert.equal(parseFilters('[{"property":"symbol","value":"s1"}]', SCHEMA)[0].op, 'like', 'text default is contains');
    assert.equal(parseFilters('[{"property":"value","value":5}]', SCHEMA)[0].op, 'eq', 'number default is equals');
    badRequest(() => parseFilters('[{"property":"secret","value":"x"}]', SCHEMA), 'INVALID_FILTER');
    badRequest(() => parseFilters('[{"property":"value","operator":"/=","value":"x"}]', SCHEMA), 'INVALID_FILTER');
    badRequest(() => parseFilters('[{"property":"value","value":"abc"}]', SCHEMA), 'INVALID_FILTER');
    badRequest(() => parseFilters('[{"property":"symbol","operator":">","value":"a"}]', SCHEMA), 'INVALID_FILTER');
    badRequest(() => parseFilters('[{"property":"side","value":"HOLD"}]', SCHEMA), 'INVALID_FILTER');
    badRequest(() => parseFilters('{broken', SCHEMA), 'INVALID_FILTER');
});

test('paging: page/start/limit, defaults and caps', () => {
    assert.deepEqual(parsePaging({}, SETTINGS), { offset: 0, limit: 25, page: 1 });
    assert.deepEqual(parsePaging({ page: '3', start: '50', limit: '25' }, SETTINGS), { offset: 50, limit: 25, page: 3 });
    assert.deepEqual(parsePaging({ page: '2', limit: '10' }, SETTINGS), { offset: 10, limit: 10, page: 2 });
    assert.equal(parsePaging({ limit: '5000' }, SETTINGS).limit, 100, 'limit is capped');
    badRequest(() => parsePaging({ limit: '0' }, SETTINGS), 'INVALID_PAGING');
    badRequest(() => parsePaging({ limit: 'abc' }, SETTINGS), 'INVALID_PAGING');
    badRequest(() => parsePaging({ start: '-1' }, SETTINGS), 'INVALID_PAGING');
    badRequest(() => parsePaging({ page: '0' }, SETTINGS), 'INVALID_PAGING');
});

test('total is the filtered count BEFORE pagination, and sorting is stable', () => {
    const options = { schema: SCHEMA, sortable: SORTABLE, settings: SETTINGS, tieBreak: 'id' };
    const page1 = runCollectionQuery(rows, { filter: '[{"property":"side","value":"BUY"}]', limit: '10', start: '0' }, options);
    assert.equal(page1.total, 15);
    assert.equal(page1.data.length, 10);
    const page2 = runCollectionQuery(rows, { filter: '[{"property":"side","value":"BUY"}]', limit: '10', start: '10' }, options);
    assert.equal(page2.total, 15);
    assert.equal(page2.data.length, 5);
    const sorted = runCollectionQuery(rows, { sort: '[{"property":"symbol","direction":"ASC"}]', limit: '30' }, options).data;
    assert.deepEqual(sorted.map((r) => r.id), sorted.slice().sort((a, b) => (a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : a.id < b.id ? -1 : 1)).map((r) => r.id));
    const unpaged = runCollectionQuery(rows, {}, { ...options, paged: false });
    assert.equal(unpaged.data.length, 30);
    const dates = runCollectionQuery(rows, { filter: '[{"property":"when","operator":">=","value":"2025-01-20"},{"property":"when","operator":"<","value":"2025-01-25"}]' }, options);
    assert.equal(dates.total, 5);
    const empty = runCollectionQuery(rows, { filter: '[{"property":"symbol","value":"zzz"}]' }, options);
    assert.deepEqual([empty.data, empty.total], [[], 0]);
});

test('CSV cells neutralize spreadsheet formula injection and escape quotes', () => {
    assert.equal(csvCell('=HYPERLINK("http://x")'), '"\'=HYPERLINK(""http://x"")"');
    assert.equal(csvCell('+1+1'), "'+1+1");
    assert.equal(csvCell('-2+3'), "'-2+3");
    assert.equal(csvCell('@SUM(A1)'), "'@SUM(A1)");
    assert.equal(csvCell('\tcmd'), "'\tcmd");
    assert.equal(csvCell('plain'), 'plain');
    assert.equal(csvCell('a,b'), '"a,b"');
    assert.equal(csvCell(-12.5), '-12.5', 'numbers stay numbers');
    assert.equal(csvCell(null), '');
    assert.equal(toCsv([{ header: 'N', key: 'n' }], [{ n: '=1+1' }, { n: 5 }]), "N\r\n'=1+1\r\n5\r\n");
});
