// API client for pastebin backend

import {
  cachePasteList,
  getCachedPasteList,
  cachePaste,
  getCachedPaste,
  cachePastesFromList,
  deleteCachedPaste,
  cachePasteFiles,
  getCachedPasteFiles,
} from "./offlineCache";


const API_BASE = "/api";
const NETWORK_TIMEOUT_MS = 4000;

export interface Paste {
  id: number;
  slug: string;
  title: string;
  content: string;
  language: string;
  pinned: number;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  is_file: number;
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  file_count?: number;
  encrypted_paste_key?: string | null;
  share_wrapped_paste_key?: string | null;
  share_auth_salt?: string | null;
  share_auth_verifier?: string | null;
}

export interface FileEntry {
  id: number;
  slug: string;
  paste_slug: string | null;
  file_name: string;
  mime_type: string;
  file_size: number;
  created_at: string;
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

/**
 * Thrown when the server gave a definitive HTTP error response (as opposed
 * to a network failure/timeout). Carries the status code so callers can
 * distinguish "server said no" (401/403/404/410 — paste deleted, expired,
 * or access revoked) from "we couldn't reach the server" (which is the only
 * case that should fall back to the offline cache).
 */
class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

/** Status codes that mean "this resource is definitively not available to us" */
function isDefinitiveRemoval(err: unknown): boolean {
  return err instanceof HttpError && [401, 403, 404, 410].includes(err.status);
}

// ─── Core fetch helper (unchanged for write operations) ───

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 10000); // 10s hard timeout

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
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
      throw new Error((data as { error?: string }).error || "Request failed");
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
 *
 * Throws `HttpError` for definitive server responses (so callers can tell
 * "paste not found/expired/revoked" apart from "network is unreachable"),
 * and a plain `Error` for network-level failures (timeout, abort, malformed
 * response body).
 */
function fetchWithTimeout<T>(path: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      reject(new Error("Network timeout"));
    }, NETWORK_TIMEOUT_MS);

    fetch(`${API_BASE}${path}`, {
      signal: controller.signal,
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
    })
      .then(async (res) => {
        clearTimeout(timer);
        let data: unknown;
        try {
          data = await res.json();
        } catch {
          throw new Error(`Server error (${res.status})`);
        }
        if (!res.ok)
          throw new HttpError(
            res.status,
            (data as { error?: string }).error || "Request failed",
          );
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
      request<{ success: boolean }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ passphrase }),
      }),

    logout: () =>
      request<{ success: boolean }>("/auth/logout", { method: "POST" }),

    check: () => {
      return request<{ authenticated: boolean }>("/auth/login");
    },

    getSalt: () => request<{ salt: string }>("/auth/salt"),
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
      const myFetchId = ++listFetchId;

      // Try to get cached data (best-effort, don't let IDB errors break the flow)
      let cached: PasteListResponse | undefined;
      try {
        cached = (await getCachedPasteList(page)) ?? undefined;
      } catch {
        cached = undefined;
      }

      if (cached && cached.pastes) {
        // We have cached data — show it immediately
        // Then try to refresh in background (if online)
        if (navigator.onLine) {
          fetchWithTimeout<PasteListResponse>(
            `/paste?page=${page}&limit=${limit}`,
          )
            .then((fresh) => {
              if (myFetchId === listFetchId && fresh && fresh.pastes) {
                cachePasteList(page, fresh).catch(() => {});
                cachePastesFromList(fresh.pastes).catch(() => {});
                onUpdate?.({ data: fresh, fromCache: false });
              }
            })
            .catch(() => {});
        }

        return { data: cached, fromCache: true };
      }

      // No cache — must wait for network
      try {
        const fresh = await fetchWithTimeout<PasteListResponse>(
          `/paste?page=${page}&limit=${limit}`,
        );
        if (fresh && fresh.pastes) {
          if (myFetchId === listFetchId) {
            cachePasteList(page, fresh).catch(() => {});
            cachePastesFromList(fresh.pastes).catch(() => {});
          }
          return { data: fresh, fromCache: false };
        }
        throw new Error("Invalid response from server");
      } catch (err) {
        // A definitive server response (e.g. 401 Unauthorized) is not a
        // reason to show stale cached data — only fall back to cache for
        // actual network failures (timeouts, unreachable server, etc).
        if (isDefinitiveRemoval(err)) {
          throw err;
        }

        // Network failed — try IndexedDB one more time
        try {
          const fallback = await getCachedPasteList(page);
          if (fallback && fallback.pastes)
            return { data: fallback, fromCache: true };
        } catch {
          // IDB also failed
        }
        throw err instanceof Error
          ? err
          : new Error("Failed to connect to server");
      }
    },

    /**
     * Get a single paste — same stale-while-revalidate pattern.
     */
    get: async (
      slug: string,
      onUpdate?: (
        result: CachedResult<{ paste: Paste; files: FileEntry[] }>,
      ) => void,
      onRemoved?: () => void,
    ): Promise<CachedResult<{ paste: Paste; files: FileEntry[] }>> => {
      const myFetchId = (pasteFetchIds[slug] = (pasteFetchIds[slug] || 0) + 1);

      let cached: Paste | undefined;
      try {
        const raw = (await getCachedPaste(slug)) ?? undefined;
        // Only use cache if it has full content (not just preview from list)
        cached = raw?.content ? raw : undefined;
      } catch {
        cached = undefined;
      }

      if (cached) {
        if (navigator.onLine) {
          fetchWithTimeout<{ paste: Paste; files: FileEntry[] }>(
            `/paste/${slug}`,
          )
            .then((fresh) => {
              if (myFetchId === pasteFetchIds[slug] && fresh?.paste) {
                cachePaste(slug, fresh.paste).catch(() => {});
                cachePasteFiles(slug, fresh.files || []).catch(() => {});
                onUpdate?.({ data: fresh, fromCache: false });
              }
            })
            .catch((err) => {
              // If the server has confirmed this paste is gone
              // (deleted/expired/revoked), drop the stale cached copy and
              // notify the mounted viewer so it clears immediately without
              // requiring a second manual reload.
              if (isDefinitiveRemoval(err)) {
                deleteCachedPaste(slug).catch(() => {});
                onRemoved?.();
              }
            });
        }

        const cachedFiles = await getCachedPasteFiles(slug).catch(() => undefined);
        return { data: { paste: cached, files: cachedFiles || [] }, fromCache: true };
      }

      try {
        const fresh = await fetchWithTimeout<{
          paste: Paste;
          files: FileEntry[];
        }>(`/paste/${slug}`);
        if (fresh?.paste) {
          if (myFetchId === pasteFetchIds[slug]) {
            cachePaste(slug, fresh.paste).catch(() => {});
            cachePasteFiles(slug, fresh.files || []).catch(() => {});
          }
          return { data: fresh, fromCache: false };
        }
        throw new Error("Paste not found");
      } catch (e) {
        // A definitive server response (paste deleted/expired/access
        // revoked) must not be masked by a stale cached copy.
        if (isDefinitiveRemoval(e)) {
          deleteCachedPaste(slug).catch(() => {});
          throw e;
        }

        try {
          const fallback = await getCachedPaste(slug);
          if (fallback) {
            const cachedFiles = await getCachedPasteFiles(slug).catch(() => undefined);
            return { data: { paste: fallback, files: cachedFiles || [] }, fromCache: true };
          }
        } catch {
          // IDB also failed
        }
        throw e instanceof Error
          ? e
          : new Error("Paste not found or server unavailable");
      }
    },

    create: (data: {
      title?: string;
      content: string;
      language?: string;
      pinned?: number;
      expires_in?: string;
      file_slugs?: string[];
      encrypted_paste_key?: string;
    }) =>
      request<{ success: boolean; slug: string }>("/paste", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    update: (
      slug: string,
      data: {
        title?: string;
        content?: string;
        language?: string;
        pinned?: number;
        expires_in?: string;
        new_file_slugs?: string[];
        removed_file_slugs?: string[];
        encrypted_paste_key?: string;
        share_wrapped_paste_key?: string;
        share_auth_salt?: string;
        share_auth_verifier?: string;
      },
    ) =>
      request<{ success: boolean }>(`/paste/${slug}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),

    delete: (slug: string) =>
      request<{ success: boolean }>(`/paste/${slug}`, {
        method: "DELETE",
      }),

    pin: (slug: string, pinned: boolean) =>
      request<{ success: boolean }>(`/paste/${slug}`, {
        method: "PUT",
        body: JSON.stringify({ pinned: pinned ? 1 : 0 }),
      }),

    share: (
      slug: string,
      shareWrappedPasteKey: string,
      shareAuthSalt: string,
      shareAuthVerifier: string,
    ) =>
      request<{ success: boolean }>(`/paste/${slug}`, {
        method: "PUT",
        body: JSON.stringify({
          share_wrapped_paste_key: shareWrappedPasteKey,
          share_auth_salt: shareAuthSalt,
          share_auth_verifier: shareAuthVerifier,
        }),
      }),

    revoke: (slug: string) =>
      request<{ success: boolean }>(`/paste/${slug}`, {
        method: "PUT",
        body: JSON.stringify({ share_wrapped_paste_key: "__revoke__" }),
      }),

    /**
     * Rate-limited unlock: POST /api/paste/:slug/unlock
     * Sends the browser-derived auth_secret (NOT the plaintext access code).
     * Server verifies auth_secret via slow hash and returns share_wrapped_paste_key
     * plus the full encrypted paste payload on success.
     * Throws an Error with message "TOO_MANY_ATTEMPTS" on HTTP 429.
     */
    unlock: async (
      slug: string,
      authSecret: string,
    ): Promise<{ share_wrapped_paste_key: string; paste: any; files: any[] }> => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 10000);
      try {
        const res = await fetch(`${API_BASE}/paste/${slug}/unlock`, {
          method: "POST",
          signal: controller.signal,
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ auth_secret: authSecret }),
        });
        clearTimeout(id);
        let data: unknown;
        try {
          data = await res.json();
        } catch {
          throw new Error(`Server error (${res.status})`);
        }
        if (res.status === 429) throw new Error("TOO_MANY_ATTEMPTS");
        if (!res.ok)
          throw new Error(
            (data as { error?: string }).error || "Unlock failed",
          );
        return data as { share_wrapped_paste_key: string; paste: any; files: any[] };
      } catch (err) {
        clearTimeout(id);
        if (err instanceof Error) throw err;
        throw new Error(String(err));
      }
    },
  },

  file: {
    getFileUrl: (slug: string): string => `${API_BASE}/file/${slug}`,

    upload: async (
      file: Blob,
      encName: string,
      encMime: string,
    ): Promise<{
      slug: string;
      file_name: string;
      mime_type: string;
      file_size: number;
    }> => {
      const formData = new FormData();
      formData.append("file", file, "encrypted_file");
      formData.append("file_name", encName);
      formData.append("mime_type", encMime);

      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 60000); // 60s timeout for uploads

      try {
        const res = await fetch(`${API_BASE}/file/upload`, {
          method: "POST",
          body: formData,
          signal: controller.signal,
          credentials: "include",
        });
        clearTimeout(id);

        let json: unknown;
        try {
          json = await res.json();
        } catch {
          throw new Error(`Server error (${res.status})`);
        }
        if (!res.ok)
          throw new Error(
            (json as { error?: string }).error || "Upload failed",
          );
        return json as {
          slug: string;
          file_name: string;
          mime_type: string;
          file_size: number;
        };
      } catch (err) {
        clearTimeout(id);
        if (err instanceof Error) throw err;
        throw new Error(String(err));
      }
    },

    delete: (slug: string) =>
      request<{ success: boolean }>(`/file/${slug}`, {
        method: "DELETE",
      }),
  },

  events: {
    /**
     * Subscribe to real-time paste events via WebSocket.
     * Returns an unsubscribe function to close the connection.
     */
    subscribe(
      onEvent: (event: { type: string; slug?: string }) => void,
    ): () => void {
      // No live sync when offline
      if (!navigator.onLine) {
        return () => {};
      }

      let ws: WebSocket | null = null;
      let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
      let pingTimer: ReturnType<typeof setInterval> | null = null;
      let closed = false;

      function connect() {
        if (closed) return;

        // Build WebSocket URL.
        // In dev, Vite proxies HTTP but WS upgrade through http-proxy
        // can be flaky with Bun — connect directly to the API server.
        const proto = location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = import.meta.env.DEV
          ? `ws://127.0.0.1:8788${API_BASE}/stream`
          : `${proto}//${location.host}${API_BASE}/stream`;

        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          // Send periodic pings to keep connection alive
          // (DO auto-responds with "pong" without waking)
          pingTimer = setInterval(() => {
            if (ws?.readyState === WebSocket.OPEN) {
              ws.send("ping");
            }
          }, 30_000);
        };

        ws.onmessage = (e) => {
          // Ignore pong responses
          if (e.data === "pong") return;
          try {
            const data = JSON.parse(e.data);
            onEvent(data);
          } catch {
            // ignore malformed messages
          }
        };

        ws.onclose = () => {
          cleanup();
          // Auto-reconnect after 2s (unless intentionally closed)
          if (!closed) {
            reconnectTimer = setTimeout(connect, 2000);
          }
        };

        ws.onerror = () => {
          // onclose will fire after onerror — reconnect handled there
        };
      }

      function cleanup() {
        if (pingTimer) {
          clearInterval(pingTimer);
          pingTimer = null;
        }
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
      }

      connect();

      // Return unsubscribe function
      return () => {
        closed = true;
        cleanup();
        if (ws) {
          ws.onclose = null; // prevent reconnect
          ws.close();
          ws = null;
        }
      };
    },
  },
};
