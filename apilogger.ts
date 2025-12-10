/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// FIX: Add and export an interface for log entries to ensure type safety.
export interface LogEntry {
    timestamp: Date;
    status: string;
    requestInfo: string;
    responseCode: number;
    duration: number;
    data: any;
}

class ApiLogger {
    // Fix: Declare class properties with types to resolve errors.
    logs: LogEntry[];
    subscribers: Set<(logs: LogEntry[]) => void>;

    constructor() {
        this.logs = [];
        this.subscribers = new Set();
    }

    log(status: string, requestInfo: string, responseCode: number, duration: number, data: any) {
        const logEntry: LogEntry = {
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

    getLogs(): LogEntry[] {
        return this.logs;
    }

    subscribe(callback: (logs: LogEntry[]) => void) {
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