// Simple cookie-based auth for Cloudflare Pages Functions
const COOKIE_NAME = 'pastebin_auth';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export function isAuthenticated(request: Request, env: Env): boolean {
    const cookie = parseCookies(request.headers.get('Cookie') || '');
    const token = cookie[COOKIE_NAME];
    if (!token) return false;
    return token === createToken(env.AUTH_KEY);
}

export function createAuthCookie(authKey: string): string {
    const token = createToken(authKey);
    return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`;
}

export function clearAuthCookie(): string {
    return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

// Simple token — hash of the auth key (not the raw key in cookies)
function createToken(authKey: string): string {
    // Simple base64 encoding with a prefix to avoid storing raw key
    const encoded = btoa(`pastebin:${authKey}`);
    return encoded;
}

function parseCookies(cookieHeader: string): Record<string, string> {
    const cookies: Record<string, string> = {};
    cookieHeader.split(';').forEach((cookie) => {
        const [name, ...rest] = cookie.trim().split('=');
        if (name) {
            cookies[name.trim()] = rest.join('=').trim();
        }
    });
    return cookies;
}

// Types for Cloudflare environment
export interface Env {
    DB: D1Database;
    AUTH_KEY: string;
}
