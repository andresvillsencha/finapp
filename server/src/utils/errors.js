'use strict';

/** An expected, client-facing error with an HTTP status and a stable code. */
class AppError extends Error {
    constructor(status, code, message, details) {
        super(message);
        this.name = 'AppError';
        this.status = status;
        this.code = code;
        if (details !== undefined) {
            this.details = details;
        }
    }
}

/** Raised when fixtures or the runtime journal are unusable at startup. */
class StartupError extends Error {
    constructor(message, issues = []) {
        super(message);
        this.name = 'StartupError';
        this.issues = issues;
    }
}

const badRequest = (code, message, details) => new AppError(400, code, message, details);
const notFound = (code, message, details) => new AppError(404, code, message, details);
const conflict = (code, message, details) => new AppError(409, code, message, details);

module.exports = { AppError, StartupError, badRequest, notFound, conflict };
