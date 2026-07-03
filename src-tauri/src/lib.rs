use tauri::{AppHandle, Manager, Window, Emitter};
use tauri::plugin::TauriPlugin;
use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut, ShortcutState};

/// 主程序版本（从 Cargo.toml 读取）
pub const HOST_VERSION: &str = env!("CARGO_PKG_VERSION");

mod plugin;
mod permission;
mod context;
mod commands;
mod config;
mod version;

use plugin::manager::PluginManager;
use plugin::manifest::{InstalledPlugin, PluginManifest};
use permission::store::PermissionStore;
use commands::remove_plugin_storage;

// 将窗口定位到当前屏幕中心偏上位置
fn position_window_center_top(window: &tauri::WebviewWindow) {
    let win_size = window.outer_size().unwrap_or(tauri::PhysicalSize {
        width: 750,
        height: 500,
    });

    if let Ok(Some(monitor)) = window.current_monitor() {
        let monitor_pos = monitor.position();
        let monitor_size = monitor.size();

        let x = monitor_pos.x + (monitor_size.width as i32 - win_size.width as i32) / 2;
        let y = monitor_pos.y + (monitor_size.height as i32 - win_size.height as i32) / 4;

        let _ = window.set_position(tauri::PhysicalPosition { x, y });
    }
}

pub fn init_global_shortcut() -> TauriPlugin<tauri::Wry> {
    tauri_plugin_global_shortcut::Builder::new()
        .with_shortcut(Shortcut::new(Some(Modifiers::ALT), Code::Space))
        .unwrap()
        .with_handler(|app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        let context_text = context::get_selected_text(app).ok();
                        position_window_center_top(&window);
                        let _ = window.show();
                        let _ = window.set_focus();
                        let _ = window.emit("window-shown", context_text);
                    }
                }
            }
        })
        .build()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(init_global_shortcut())
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Focused(false) = event {
                if window.label() == "main" {
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            hide_window,
            list_plugins,
            install_plugin,
            install_plugin_from_dir,
            uninstall_plugin,
            get_plugin_url,
            get_selected_text,
            aq_download_plugin,
            // 配置命令
            config::get_app_config,
            config::save_app_config,
            // 插件能力命令
            commands::aq_clipboard_write,
            commands::aq_clipboard_read,
            commands::aq_notification,
            commands::aq_fs_read,
            commands::aq_fs_write,
            commands::aq_http_get,
            commands::aq_http_post,
            commands::aq_storage_get,
            commands::aq_storage_set,
            commands::aq_storage_delete,
            commands::aq_storage_keys,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// === 主窗口命令 ===

#[tauri::command]
fn hide_window(window: Window) {
    let _ = window.hide();
}

/// 获取系统当前选中的文本（模拟 Ctrl+C）
#[tauri::command]
fn get_selected_text(app: AppHandle) -> Result<String, String> {
    context::get_selected_text(&app)
}

/// 下载插件 zip 到临时目录
#[tauri::command]
async fn aq_download_plugin(url: String) -> Result<String, String> {
    let client = reqwest::Client::new();
    let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let bytes = resp.bytes().await.map_err(|e| e.to_string())?;

    let temp_dir = std::env::temp_dir();
    let filename = format!("aq-download-{}.zip", uuid_like());
    let zip_path = temp_dir.join(filename);
    std::fs::write(&zip_path, bytes).map_err(|e| e.to_string())?;

    Ok(zip_path.to_string_lossy().to_string())
}

/// 生成简单伪 UUID
fn uuid_like() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    format!("{:x}", ts)
}

// === 插件管理命令 ===

#[tauri::command]
fn list_plugins(app: AppHandle) -> Vec<InstalledPlugin> {
    let manager = PluginManager::new(app);
    manager.list_plugins()
}

#[tauri::command]
fn install_plugin(app: AppHandle, zip_path: String) -> Result<PluginManifest, String> {
    let manager = PluginManager::new(app);
    manager
        .install_from_zip(std::path::Path::new(&zip_path))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn install_plugin_from_dir(app: AppHandle, source_dir: String) -> Result<PluginManifest, String> {
    let manager = PluginManager::new(app);
    manager
        .install_from_dir(std::path::Path::new(&source_dir))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn uninstall_plugin(app: AppHandle, plugin_id: String) -> Result<(), String> {
    let manager = PluginManager::new(app.clone());
    manager.uninstall_plugin(&plugin_id).map_err(|e| e.to_string())?;

    // 清理 KV 存储
    remove_plugin_storage(&app, &plugin_id);

    // 清理权限记录
    let perm_store = PermissionStore::new(app);
    perm_store.remove_permissions(&plugin_id).map_err(|e| e.to_string())?;

    Ok(())
}

/// 获取插件的 asset protocol URL
#[tauri::command]
fn get_plugin_url(app: AppHandle, plugin_id: String) -> Result<String, String> {
    let manager = PluginManager::new(app.clone());
    let plugin = manager
        .get_plugin(&plugin_id)
        .ok_or(format!("插件未找到: {}", plugin_id))?;

    let full_path = std::path::Path::new(&plugin.path).join(&plugin.manifest.main);
    let path_str = full_path.to_string_lossy().replace('\\', "/");
    let trimmed = path_str.trim_start_matches('/');

    #[cfg(target_os = "windows")]
    let url = format!("http://asset.localhost/{}", trimmed);
    #[cfg(not(target_os = "windows"))]
    let url = format!("asset://localhost/{}", trimmed);

    Ok(url)
}
