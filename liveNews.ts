import * as React from 'react';

// Minimal news item shape used by the hook
export type NewsItem = { id: string; title: string; date: string; link?: string };

const DEFAULT_POLL_MS = 60 * 60 * 1000; // 3600000 ms = 1 hour
