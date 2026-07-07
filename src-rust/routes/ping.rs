/// GET /api/ping — simple health check.
pub async fn handle_ping() -> &'static str {
    "pong"
}
