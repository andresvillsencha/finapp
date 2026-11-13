'use strict';

/**
 * In-process mutation queue. Tasks run strictly one after another, so two
 * simultaneous trades can never both pass validation against the same cash or
 * share balance. A failing task never blocks the tasks queued behind it.
 */
class SerialQueue {
    constructor() {
        this.tail = Promise.resolve();
    }

    run(task) {
        const result = this.tail.then(() => task());
        this.tail = result.catch(() => undefined);
        return result;
    }
}

module.exports = { SerialQueue };
