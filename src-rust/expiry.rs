use std::time::{SystemTime, UNIX_EPOCH};

/// Map an `expires_in` string to a number of seconds.
fn expires_in_seconds(expires_in: &str) -> Option<u64> {
    match expires_in {
        "10m" => Some(10 * 60),
        "45m" => Some(45 * 60),
        "2h" => Some(2 * 60 * 60),
        "1d" => Some(24 * 60 * 60),
        "1w" => Some(7 * 24 * 60 * 60),
        _ => None,
    }
}

/// Format a Unix timestamp as `YYYY-MM-DD HH:MM:SS` (UTC).
fn format_datetime(secs: u64) -> String {
    // Days since epoch calculation
    let total_secs = secs;
    let sec = (total_secs % 60) as u32;
    let total_mins = total_secs / 60;
    let min = (total_mins % 60) as u32;
    let total_hours = total_mins / 60;
    let hour = (total_hours % 24) as u32;
    let mut total_days = (total_hours / 24) as i64;

    // Convert days since epoch to year/month/day (civil_from_days algorithm)
    total_days += 719_468; // shift epoch from 1970-01-01 to 0000-03-01
    let era = if total_days >= 0 {
        total_days / 146_097
    } else {
        (total_days - 146_096) / 146_097
    };
    let doe = (total_days - era * 146_097) as u32; // day of era [0, 146096]
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365; // year of era [0, 399]
    let y = (yoe as i64) + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100); // day of year [0, 365]
    let mp = (5 * doy + 2) / 153; // [0, 11]
    let d = doy - (153 * mp + 2) / 5 + 1; // day [1, 31]
    let m = if mp < 10 { mp + 3 } else { mp - 9 }; // month [1, 12]
    let y = if m <= 2 { y + 1 } else { y };

    format!("{y:04}-{m:02}-{d:02} {hour:02}:{min:02}:{sec:02}")
}

/// Compute an `expires_at` datetime string from an `expires_in` value.
/// Returns `None` for "never" or unknown values.
pub fn compute_expires_at(expires_in: Option<&str>) -> Option<String> {
    let key = expires_in?;
    if key == "never" {
        return None;
    }
    let seconds = expires_in_seconds(key)?;
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();
    Some(format_datetime(now + seconds))
}

/// SQL clause to filter out expired pastes.
pub const NOT_EXPIRED_CLAUSE: &str = "(expires_at IS NULL OR expires_at > datetime('now'))";
