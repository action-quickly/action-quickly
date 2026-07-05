use std::path::PathBuf;
use std::sync::OnceLock;
use tauri::{AppHandle, Manager};

/// 获取应用数据根目录 ~/.action-quick
pub fn app_data_dir(app: &AppHandle) -> PathBuf {
    let base = app.path().home_dir().unwrap_or_else(|_| {
        dirs::home_dir().unwrap_or_else(|| PathBuf::from("."))
    });
    base.join(".action-quick")
}

/// 共享 HTTP 客户端（复用连接池，避免每次请求重建）
static HTTP_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

pub fn http_client() -> &'static reqwest::Client {
    HTTP_CLIENT.get_or_init(reqwest::Client::new)
}

/// 生成简单伪 UUID（基于时间戳的十六进制字符串）
pub fn uuid_like() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    format!("{:x}", ts)
}
