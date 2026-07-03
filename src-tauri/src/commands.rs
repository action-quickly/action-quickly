use tauri::{AppHandle, Manager};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_notification::NotificationExt;
use crate::permission::store::PermissionStore;

/// 检查插件权限
fn check_permission(app: &AppHandle, plugin_id: &str, permission: &str) -> Result<(), String> {
    let store = PermissionStore::new(app.clone());
    if !store.has_permission(plugin_id, permission) {
        return Err(format!("插件 {} 未授权权限: {}", plugin_id, permission));
    }
    Ok(())
}

// === 剪贴板 ===

#[tauri::command]
pub fn aq_clipboard_write(app: AppHandle, plugin_id: String, text: String) -> Result<(), String> {
    check_permission(&app, &plugin_id, "clipboard")?;
    app.clipboard().write_text(text).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn aq_clipboard_read(app: AppHandle, plugin_id: String) -> Result<String, String> {
    check_permission(&app, &plugin_id, "clipboard")?;
    app.clipboard().read_text().map_err(|e| e.to_string())
}

// === 系统通知 ===

#[tauri::command]
pub fn aq_notification(app: AppHandle, plugin_id: String, title: String, body: Option<String>) -> Result<(), String> {
    check_permission(&app, &plugin_id, "notification")?;
    let mut builder = app.notification().builder().title(title);
    if let Some(b) = body {
        builder = builder.body(b);
    }
    builder.show().map_err(|e| e.to_string())
}

// === 文件读写 ===

#[tauri::command]
pub fn aq_fs_read(app: AppHandle, plugin_id: String, path: String) -> Result<String, String> {
    check_permission(&app, &plugin_id, "fs:read")?;
    std::fs::read_to_string(&path).map_err(|e| format!("读取文件失败: {}", e))
}

#[tauri::command]
pub fn aq_fs_write(app: AppHandle, plugin_id: String, path: String, content: String) -> Result<(), String> {
    check_permission(&app, &plugin_id, "fs:write")?;
    std::fs::write(&path, content).map_err(|e| format!("写入文件失败: {}", e))
}

// === HTTP 请求 ===

#[tauri::command]
pub async fn aq_http_get(app: AppHandle, plugin_id: String, url: String) -> Result<String, String> {
    check_permission(&app, &plugin_id, "http")?;
    let client = reqwest::Client::new();
    let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
    resp.text().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn aq_http_post(app: AppHandle, plugin_id: String, url: String, body: String) -> Result<String, String> {
    check_permission(&app, &plugin_id, "http")?;
    let client = reqwest::Client::new();
    let resp = client.post(&url).body(body).send().await.map_err(|e| e.to_string())?;
    resp.text().await.map_err(|e| e.to_string())
}

// === 插件 KV 存储 ===

use std::collections::HashMap;
use std::path::PathBuf;

fn storage_path(app: &AppHandle, plugin_id: &str) -> PathBuf {
    let base = app.path().home_dir().unwrap_or_else(|_| {
        dirs::home_dir().unwrap_or_else(|| PathBuf::from("."))
    });
    let dir = base.join(".action-quick").join("storage");
    let _ = std::fs::create_dir_all(&dir);
    dir.join(format!("{}.json", plugin_id))
}

fn load_kv(app: &AppHandle, plugin_id: &str) -> HashMap<String, serde_json::Value> {
    let path = storage_path(app, plugin_id);
    if !path.exists() {
        return HashMap::new();
    }
    let content = std::fs::read_to_string(&path).unwrap_or_default();
    if content.trim().is_empty() {
        return HashMap::new();
    }
    serde_json::from_str(&content).unwrap_or_default()
}

fn save_kv(app: &AppHandle, plugin_id: &str, data: &HashMap<String, serde_json::Value>) -> Result<(), String> {
    let path = storage_path(app, plugin_id);
    let json = serde_json::to_string_pretty(data).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn aq_storage_get(app: AppHandle, plugin_id: String, key: String) -> Result<Option<serde_json::Value>, String> {
    check_permission(&app, &plugin_id, "storage")?;
    let data = load_kv(&app, &plugin_id);
    Ok(data.get(&key).cloned())
}

#[tauri::command]
pub fn aq_storage_set(app: AppHandle, plugin_id: String, key: String, value: serde_json::Value) -> Result<(), String> {
    check_permission(&app, &plugin_id, "storage")?;
    let mut data = load_kv(&app, &plugin_id);
    data.insert(key, value);
    save_kv(&app, &plugin_id, &data)
}

#[tauri::command]
pub fn aq_storage_delete(app: AppHandle, plugin_id: String, key: String) -> Result<(), String> {
    check_permission(&app, &plugin_id, "storage")?;
    let mut data = load_kv(&app, &plugin_id);
    data.remove(&key);
    save_kv(&app, &plugin_id, &data)
}

#[tauri::command]
pub fn aq_storage_keys(app: AppHandle, plugin_id: String) -> Result<Vec<String>, String> {
    check_permission(&app, &plugin_id, "storage")?;
    let data = load_kv(&app, &plugin_id);
    Ok(data.keys().cloned().collect())
}

/// 删除插件的 KV 存储文件（卸载时调用）
pub fn remove_plugin_storage(app: &AppHandle, plugin_id: &str) {
    let path = storage_path(app, plugin_id);
    if path.exists() {
        let _ = std::fs::remove_file(&path);
    }
}
