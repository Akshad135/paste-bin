// API client for pastebin backend

import {
    cachePasteList,
    getCachedPasteList,
    cachePaste,
    getCachedPaste,
    cachePastesFromList,
} from './offlineCache';

import { DEMO_PASTES } from './demoData';

const API_BASE = '/api';
const NETWORK_TIMEOUT_MS = 4000;

export interface Paste {
    id: number;
    slug: string;
    title: string;
    content: string;
    language: string;
    visibility: 'public' | 'private';
    pinned: number;
    preview?: string;
    expires_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface PasteListResponse {
    pastes: Paste[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
}

/** Result wrapper — lets the UI know if data came from cache */
export interface CachedResult<T> {
    data: T;
    fromCache: boolean;
}

// ─── Core fetch helper (unchanged for write operations) ───

async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 10000); // 10s hard timeout

    try {
        const res = await fetch(`${API_BASE}${path}`, {
            ...options,
            signal: controller.signal,
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                ...options?.headers,
            },
        });
        clearTimeout(id);

        let data: unknown;
        try {
            data = await res.json();
        } catch {
            throw new Error(`Server error (${res.status})`);
        }

        if (!res.ok) {
            throw new Error((data as { error?: string }).error || 'Request failed');
        }

        return data as T;
    } catch (err) {
        clearTimeout(id);
        if (err instanceof Error) throw err;
        throw new Error(String(err));
    }
}

// ─── Network-first fetch with fast timeout for reads ───

/**
 * Race the network against a timer.
 * - If the network wins → return fresh data.
 * - If the timer wins → let the caller fall back to cache.
 * Uses a SEPARATE shorter timeout (NETWORK_TIMEOUT_MS) so we fail-fast to cache.
 */
function fetchWithTimeout<T>(path: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const controller = new AbortController();
        const timer = setTimeout(() => {
            controller.abort();
            reject(new Error('Network timeout'));
        }, NETWORK_TIMEOUT_MS);

        fetch(`${API_BASE}${path}`, {
            signal: controller.signal,
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
        })
            .then(async (res) => {
                clearTimeout(timer);
                let data: unknown;
                try { data = await res.json(); } catch { throw new Error(`Server error (${res.status})`); }
                if (!res.ok) throw new Error((data as { error?: string }).error || 'Request failed');
                resolve(data as T);
            })
            .catch((err) => {
                clearTimeout(timer);
                reject(err);
            });
    });
}

// ─── Monotonic fetch IDs to prevent stale-overwrites-fresh race condition ───
let listFetchId = 0;
let pasteFetchIds: Record<string, number> = {};

export const api = {
    auth: {
        login: (passphrase: string) =>
            request<{ success: boolean }>('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ passphrase }),
            }),

        logout: () =>
            request<{ success: boolean }>('/auth/logout', { method: 'POST' }),

        check: () => {
            if (import.meta.env.VITE_DEMO_MODE === 'true') {
                return Promise.resolve({ authenticated: false });
            }
            return request<{ authenticated: boolean }>('/auth/login');
        },
    },

    paste: {
        /**
         * List pastes — stale-while-revalidate pattern.
         * Returns cached data instantly if available, then refreshes in the background.
         * The caller provides an `onUpdate` callback for background refresh results.
         */
        list: async (
            page = 1,
            limit = 20,
            onUpdate?: (result: CachedResult<PasteListResponse>) => void,
        ): Promise<CachedResult<PasteListResponse>> => {
            // DEMO MODE: Return static data
            if (import.meta.env.VITE_DEMO_MODE === 'true') {
                const start = (page - 1) * limit;
                const end = start + limit;
                const pastes = DEMO_PASTES.slice(start, end);
                const hasMore = end < DEMO_PASTES.length;
                return {
                    data: {
                        pastes,
                        total: DEMO_PASTES.length,
                        page,
                        limit,
                        hasMore
                    },
                    fromCache: false
                };
            }

            const myFetchId = ++listFetchId;

            // Try to get cached data (best-effort, don't let IDB errors break the flow)
            let cached: PasteListResponse | undefined;
            try {
                cached = await getCachedPasteList(page) ?? undefined;
            } catch {
                cached = undefined;
            }

            if (cached && cached.pastes) {
                // We have cached data — show it immediately
                // Then try to refresh in background (if online)
                if (navigator.onLine) {
                    fetchWithTimeout<PasteListResponse>(`/paste?page=${page}&limit=${limit}`)
                        .then((fresh) => {
                            if (myFetchId === listFetchId && fresh && fresh.pastes) {
                                const publicOnly = { ...fresh, pastes: fresh.pastes.filter(p => p.visibility === 'public') };
                                cachePasteList(page, publicOnly).catch(() => { });
                                cachePastesFromList(fresh.pastes).catch(() => { });
                                onUpdate?.({ data: fresh, fromCache: false });
                            }
                        })
                        .catch(() => { });
                }

                return { data: cached, fromCache: true };
            }

            // No cache — must wait for network
            try {
                const fresh = await fetchWithTimeout<PasteListResponse>(`/paste?page=${page}&limit=${limit}`);
                if (fresh && fresh.pastes) {
                    if (myFetchId === listFetchId) {
                        const publicOnly = { ...fresh, pastes: fresh.pastes.filter(p => p.visibility === 'public') };
                        cachePasteList(page, publicOnly).catch(() => { });
                        cachePastesFromList(fresh.pastes).catch(() => { });
                    }
                    return { data: fresh, fromCache: false };
                }
                throw new Error('Invalid response from server');
            } catch (err) {
                // Network failed — try IndexedDB one more time
                try {
                    const fallback = await getCachedPasteList(page);
                    if (fallback && fallback.pastes) return { data: fallback, fromCache: true };
                } catch {
                    // IDB also failed
                }
                throw err instanceof Error ? err : new Error('Failed to connect to server');
            }
        },

        /**
         * Get a single paste — same stale-while-revalidate pattern.
         */
        get: async (
            slug: string,
            onUpdate?: (result: CachedResult<{ paste: Paste }>) => void,
        ): Promise<CachedResult<{ paste: Paste }>> => {
            // DEMO MODE: Return static data
            if (import.meta.env.VITE_DEMO_MODE === 'true') {
                const paste = DEMO_PASTES.find(p => p.slug === slug);
                if (paste) {
                    return { data: { paste }, fromCache: false };
                }
                throw new Error('Paste not found');
            }

            const myFetchId = (pasteFetchIds[slug] = (pasteFetchIds[slug] || 0) + 1);

            let cached: Paste | undefined;
            try {
                const raw = await getCachedPaste(slug) ?? undefined;
                // Only use cache if it has full content (not just preview from list)
                cached = raw?.content ? raw : undefined;
            } catch {
                cached = undefined;
            }

            if (cached) {
                if (navigator.onLine) {
                    fetchWithTimeout<{ paste: Paste }>(`/paste/${slug}`)
                        .then((fresh) => {
                            if (myFetchId === pasteFetchIds[slug] && fresh?.paste) {
                                cachePaste(slug, fresh.paste).catch(() => { });
                                onUpdate?.({ data: fresh, fromCache: false });
                            }
                        })
                        .catch(() => { });
                }

                return { data: { paste: cached }, fromCache: true };
            }

            try {
                const fresh = await fetchWithTimeout<{ paste: Paste }>(`/paste/${slug}`);
                if (fresh?.paste) {
                    if (myFetchId === pasteFetchIds[slug]) {
                        cachePaste(slug, fresh.paste).catch(() => { });
                    }
                    return { data: fresh, fromCache: false };
                }
                throw new Error('Invalid response from server');
            } catch (err) {
                try {
                    const fallback = await getCachedPaste(slug);
                    if (fallback) return { data: { paste: fallback }, fromCache: true };
                } catch {
                    // IDB also failed
                }
                throw err instanceof Error ? err : new Error('Paste not found or server unavailable');
            }
        },

        create: (data: {
            title?: string;
            content: string;
            language?: string;
            visibility?: 'public' | 'private';
            expires_in?: string;
        }) =>
            request<{ slug: string; success: boolean }>('/paste', {
                method: 'POST',
                body: JSON.stringify(data),
            }),

        update: (slug: string, data: Partial<Paste>) =>
            request<{ success: boolean }>(`/paste/${slug}`, {
                method: 'PUT',
                body: JSON.stringify(data),
            }),

        delete: (slug: string) =>
            request<{ success: boolean }>(`/paste/${slug}`, {
                method: 'DELETE',
            }),

        pin: (slug: string, pinned: boolean) =>
            request<{ success: boolean }>(`/paste/${slug}`, {
                method: 'PUT',
                body: JSON.stringify({ pinned: pinned ? 1 : 0 }),
            }),
    },
};
