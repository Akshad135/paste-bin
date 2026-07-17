use std::time::{SystemTime, UNIX_EPOCH};

pub const MAX_BURN_SECONDS: u64 = 30 * 24 * 60 * 60;
pub const ACTIVE_PASTE_CLAUSE: &str = "burn_pending_delete_at IS NULL";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BurnAction {
    RevokeShare,
    Delete,
}

impl BurnAction {
    pub fn as_str(self) -> &'static str {
        match self {
            BurnAction::RevokeShare => "revoke_share",
            BurnAction::Delete => "delete",
        }
    }
}

pub fn parse_burn_action(action: Option<&str>) -> Result<BurnAction, &'static str> {
    match action.unwrap_or("delete") {
        "revoke_share" => Ok(BurnAction::RevokeShare),
        "delete" => Ok(BurnAction::Delete),
        _ => Err("Invalid burn action"),
    }
}

fn duration_seconds(value: i64, unit: &str) -> Result<u64, &'static str> {
    if value <= 0 {
        return Err("Burn time must be at least 1 minute");
    }

    let multiplier = match unit {
        "minute" => 60,
        "hour" => 60 * 60,
        "day" => 24 * 60 * 60,
        _ => return Err("Invalid burn time unit"),
    };

    let seconds = (value as u64)
        .checked_mul(multiplier)
        .ok_or("Burn time is too large")?;

    if seconds < 60 {
        return Err("Burn time must be at least 1 minute");
    }
    if seconds > MAX_BURN_SECONDS {
        return Err("Burn time cannot exceed 30 days");
    }

    Ok(seconds)
}

pub fn compute_burn_at(
    value: Option<i64>,
    unit: Option<&str>,
) -> Result<Option<String>, &'static str> {
    let Some(value) = value else {
        return Ok(None);
    };
    let unit = unit.unwrap_or("hour");
    let seconds = duration_seconds(value, unit)?;
    Ok(Some(format_datetime(now_secs() + seconds)))
}

pub fn pending_delete_at(total_bytes: u64) -> String {
    let total_mb = total_bytes as f64 / 1_048_576.0;
    let minutes = 15.0f64.min(5.0f64.max(total_mb * 2.0));
    let grace_seconds = (minutes * 60.0) as u64;
    format_datetime(now_secs() + grace_seconds)
}

pub fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
}

pub fn format_datetime(secs: u64) -> String {
    use chrono::DateTime;
    let dt = DateTime::from_timestamp(secs as i64, 0).unwrap_or_default();
    dt.format("%Y-%m-%d %H:%M:%S").to_string()
}
