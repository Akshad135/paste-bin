use axum::http::{HeaderMap, HeaderValue};
use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64;
use sha2::{Digest, Sha256};

const COOKIE_NAME: &str = "pastebin_auth";
const COOKIE_MAX_AGE: u64 = 60 * 60 * 24 * 30; // 30 days

/// Create the auth token from the secret key.
///
/// This is a one-way hash (not a reversible encoding) so the session
/// cookie never leaks the underlying passphrase, which is also used
/// to derive the E2EE master key.
pub fn create_token(key: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(b"pastebin-session-v1:");
    hasher.update(key.as_bytes());
    BASE64.encode(hasher.finalize())
}

/// Parse cookies from a Cookie header string into key-value pairs.
fn parse_cookies(header: &str) -> Vec<(String, String)> {
    header
        .split(';')
        .filter_map(|c| {
            let c = c.trim();
            let idx = c.find('=')?;
            let name = c[..idx].trim().to_string();
            let value = c[idx + 1..].trim().to_string();
            Some((name, value))
        })
        .collect()
}

/// Check if the request is authenticated by examining the cookie.
pub fn is_authenticated(headers: &HeaderMap, auth_key: &str) -> bool {
    let cookie_header = match headers.get("cookie").or_else(|| headers.get("Cookie")) {
        Some(v) => v.to_str().unwrap_or(""),
        None => return false,
    };

    let cookies = parse_cookies(cookie_header);
    let expected = create_token(auth_key);

    cookies
        .iter()
        .any(|(name, value)| name == COOKIE_NAME && value == &expected)
}

/// Create a Set-Cookie header value for successful login.
pub fn create_auth_cookie(auth_key: &str) -> HeaderValue {
    let token = create_token(auth_key);
    let cookie = format!(
        "{COOKIE_NAME}={token}; Path=/; HttpOnly; SameSite=Lax; Max-Age={COOKIE_MAX_AGE}"
    );
    HeaderValue::from_str(&cookie).unwrap()
}

/// Create a Set-Cookie header value that clears the auth cookie.
pub fn clear_auth_cookie() -> HeaderValue {
    let cookie = format!("{COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
    HeaderValue::from_str(&cookie).unwrap()
}
