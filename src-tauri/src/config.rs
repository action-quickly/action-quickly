use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub shortcut: String,
    pub theme: String,
    pub developer_mode: bool,
    pub plugin_source: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            shortcut: "Alt+Space".to_string(),
            theme: "system".to_string(),
            developer_mode: false,
            plugin_source: "https://raw.githubusercontent.com/action-quick/plugins/main/index.json".to_string(),
        }
    }
}

const STORE_FILE: &str = "config.json";

pub fn get_config(app: &AppHandle) -> AppConfig {
    let store = match app.store(STORE_FILE) {
        Ok(s) => s,
        Err(_) => return AppConfig::default(),
    };

    let shortcut = store.get("shortcut")
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .unwrap_or_else(|| AppConfig::default().shortcut);

    let theme = store.get("theme")
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .unwrap_or_else(|| AppConfig::default().theme);

    let developer_mode = store.get("developer_mode")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    let plugin_source = store.get("plugin_source")
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .unwrap_or_else(|| AppConfig::default().plugin_source);

    AppConfig {
        shortcut,
        theme,
        developer_mode,
        plugin_source,
    }
}

pub fn save_config(app: &AppHandle, config: &AppConfig) -> Result<(), String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    store.set("shortcut", serde_json::json!(config.shortcut));
    store.set("theme", serde_json::json!(config.theme));
    store.set("developer_mode", serde_json::json!(config.developer_mode));
    store.set("plugin_source", serde_json::json!(config.plugin_source));
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_app_config(app: AppHandle) -> Result<AppConfig, String> {
    Ok(get_config(&app))
}

#[tauri::command]
pub fn save_app_config(app: AppHandle, config: AppConfig) -> Result<(), String> {
    save_config(&app, &config)
}
