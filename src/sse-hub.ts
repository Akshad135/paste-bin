/// <reference types="@cloudflare/workers-types" />

/**
 * SSEHub — Durable Object that manages global WebSocket broadcast.
 *
 * All clients connect here for real-time paste events (create/update/delete).
 * Uses Hibernatable WebSockets so the DO can sleep between broadcasts
 * without dropping connections or incurring idle costs.
 *
 * Two request paths:
 *  - GET  /connect  → WebSocket upgrade (clients)
 *  - POST /broadcast → internal notification from the worker
 */
export class SSEHub implements DurableObject {
    private state: DurableObjectState;

    constructor(state: DurableObjectState, _env: unknown) {
        this.state = state;

        // Auto-respond to "ping" with "pong" WITHOUT waking the DO.
        // This keeps connections alive through proxies / mobile browsers
        // and avoids the 10s sleep issue we had with plain SSE.
        this.state.setWebSocketAutoResponse(
            new WebSocketRequestResponsePair('ping', 'pong'),
        );
    }

    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);

        if (url.pathname === '/connect') {
            return this.handleConnect(request);
        }

        if (url.pathname === '/broadcast' && request.method === 'POST') {
            return this.handleBroadcast(request);
        }

        return new Response('Not found', { status: 404 });
    }

    /**
     * Client WebSocket upgrade — adds the socket to the hibernatable set.
     */
    private handleConnect(request: Request): Response {
        const upgradeHeader = request.headers.get('Upgrade');
        if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
            return new Response('Expected WebSocket upgrade', { status: 426 });
        }

        const pair = new WebSocketPair();
        const [client, server] = [pair[0], pair[1]];

        // Accept with hibernation — the DO can sleep while connections persist
        this.state.acceptWebSocket(server);

        return new Response(null, { status: 101, webSocket: client });
    }

    /**
     * Internal broadcast from the worker after a mutation.
     * Sends the event payload to every connected WebSocket client.
     */
    private async handleBroadcast(request: Request): Promise<Response> {
        const payload = await request.text();
        const sockets = this.state.getWebSockets();

        for (const ws of sockets) {
            try {
                ws.send(payload);
            } catch {
                // Socket is dead — close it so it gets cleaned up
                try { ws.close(1011, 'broadcast error'); } catch { /* already closed */ }
            }
        }

        return new Response('OK', { status: 200 });
    }

    // ── Hibernatable WebSocket event handlers ──────────────────────────

    /**
     * Called when a client sends a message. We don't expect any meaningful
     * client→server messages, but handle gracefully.
     * NOTE: "ping" messages are auto-responded to and never reach here.
     */
    webSocketMessage(_ws: WebSocket, _message: string | ArrayBuffer): void {
        // No-op — clients are receive-only
    }

    webSocketClose(ws: WebSocket, code: number, _reason: string, _wasClean: boolean): void {
        // Cloudflare automatically removes closed sockets from getWebSockets()
        try { ws.close(code, 'client closed'); } catch { /* already closed */ }
    }

    webSocketError(ws: WebSocket, _error: unknown): void {
        try { ws.close(1011, 'error'); } catch { /* already closed */ }
    }
}
