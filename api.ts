/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { apiLogger } from './apilogger';

// --- API Configuration Management ---
// With the Vite proxy, we no longer need the absolute path.
// The browser makes requests to the same origin, and Vite forwards them.
export const getApiBaseUrl = () => {
    // Prefer an explicit Vite env var when available (set VITE_BACKEND_URL)
    // otherwise, during local development assume the backend runs on port 4000.
    // In production, an empty string lets the browser use the same origin.
    try {
        // Vite exposes env vars on `import.meta.env` with the VITE_ prefix.
        // Use any value provided there first.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const maybe = (import.meta as any)?.env?.VITE_BACKEND_URL;
        if (maybe) return maybe;
    } catch (e) {}

    if (typeof window !== 'undefined') {
        // If running on localhost (dev), point to the backend default port.
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'http://localhost:4000';
        }
    }

    // Production: use same origin
    return '';
};


// --- Core Request Logic ---
// Fix: Type the `options` parameter with `RequestInit` to allow fetch options.
async function request(endpoint: string, options: RequestInit = {}) {
    const API_BASE = getApiBaseUrl();
    const MAX_RETRIES = 2;
    const RETRY_DELAY_MS = 500;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const start = Date.now();
        try {
            // ...existing code...
            const response = await fetch(`${API_BASE}${endpoint}`, {
                credentials: 'include',
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers,
                },
            });
            const duration = Date.now() - start;
            if (!response.ok) {
                const errorText = await response.text();
                let errorMessage = errorText;
                try {
                    const errorJson = JSON.parse(errorText);
                    errorMessage = errorJson.error || errorText;
                } catch (e) {
                    // Not a JSON response, use the raw text.
                }
                apiLogger.log('ERROR', `${options.method || 'GET'} ${endpoint}`, response.status, duration, errorMessage);
                const err: any = new Error(errorMessage || `HTTP ${response.status}`);
                err.status = response.status;
                throw err;
            }
            const data = await response.json();
            apiLogger.log('SUCCESS', `${options.method || 'GET'} ${endpoint}`, response.status, duration, data);
            return data;
        } catch (error) {
            const duration = Date.now() - start;
            let errorMessage = '';
            if (error instanceof Error) {
                errorMessage = error.message;
            } else {
                errorMessage = String(error);
            }
            if (attempt < MAX_RETRIES && error instanceof TypeError && errorMessage.includes('fetch')) {
                console.warn(`API request to ${endpoint} failed. Retrying in ${RETRY_DELAY_MS * (attempt + 1)}ms...`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)));
                continue;
            }
            apiLogger.log('FAIL', `${options.method || 'GET'} ${endpoint}`, 0, duration, errorMessage);
            console.error(`API request failed for ${endpoint}:`, error);
            throw error;
        }
    }
}

// --- Exported API Functions ---

export const fetchMockData = () => request('/api/mock-data');

export const updateProfessor = (professor: any) => request('/api/datas/update', {
    method: 'POST',
    body: JSON.stringify(professor),
});

export const deleteProfessor = (id: string) => request(`/api/professors/${id}`, {
    method: 'DELETE',
});

export const deleteDepartment = (id: string) => request(`/api/departments/${encodeURIComponent(id)}`, {
    method: 'DELETE',
});

export const registerPublicUser = (userData: {name: string, email: string, password: string, apiKey?: string}) => request('/api/public-register', {
    method: 'POST',
    body: JSON.stringify(userData),
});

export const getCurrentUser = () => request('/api/me');

export const logout = () => request('/api/logout', { method: 'POST' });