// API client for pastebin backend

const API_BASE = '/api';

export interface Paste {
    id: number;
    slug: string;
    title: string;
    content: string;
    language: string;
    visibility: 'public' | 'private';
    preview?: string;
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

async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
        const res = await fetch(`${API_BASE}${path}`, {
            ...options,
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
                ...options?.headers,
            },
        });
        clearTimeout(id);

        const data = await res.json();

        if (!res.ok) {
            throw new Error((data as { error?: string }).error || 'Request failed');
        }

        return data as T;
    } catch (err) {
        clearTimeout(id);
        throw err;
    }
}

export const api = {
    auth: {
        login: (passphrase: string) =>
            request<{ success: boolean }>('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ passphrase }),
            }),

        logout: () =>
            request<{ success: boolean }>('/auth/logout', { method: 'POST' }),

        check: () =>
            request<{ authenticated: boolean }>('/auth/login'),
    },

    paste: {
        list: (page = 1, limit = 20) =>
            request<PasteListResponse>(`/paste?page=${page}&limit=${limit}`),

        get: (slug: string) =>
            request<{ paste: Paste }>(`/paste/${slug}`),

        create: (data: {
            title?: string;
            content: string;
            language?: string;
            visibility?: 'public' | 'private';
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
    },
};
