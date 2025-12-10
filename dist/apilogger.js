/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
class ApiLogger {
    constructor() {
        this.logs = [];
        this.subscribers = new Set();
    }
    log(status, requestInfo, responseCode, duration, data) {
        const logEntry = {
            timestamp: new Date(),
            status,
            requestInfo,
            responseCode,
            duration,
            data: data,
        };
        this.logs.unshift(logEntry);
        if (this.logs.length > 100) {
            this.logs.pop();
        }
        this.notifySubscribers();
    }
    getLogs() {
        return this.logs;
    }
    subscribe(callback) {
        this.subscribers.add(callback);
        return () => this.subscribers.delete(callback);
    }
    notifySubscribers() {
        for (const callback of this.subscribers) {
            callback(this.logs);
        }
    }
}
export const apiLogger = new ApiLogger();
