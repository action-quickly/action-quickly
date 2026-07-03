use enigo::{Enigo, Key, Keyboard, Settings};
use tauri::AppHandle;
use tauri_plugin_clipboard_manager::ClipboardExt;

/// 模拟 Ctrl+C 获取当前选中文本
pub fn get_selected_text(app: &AppHandle) -> Result<String, String> {
    // 保存当前剪贴板内容
    let original = app.clipboard()
        .read_text()
        .unwrap_or_default();

    // 模拟 Ctrl+C
    let mut enigo = Enigo::new(&Settings::default())
        .map_err(|e| format!("Failed to create Enigo: {}", e))?;

    enigo.key(Key::Control, enigo::Direction::Press)
        .map_err(|e| format!("key down failed: {}", e))?;
    enigo.key(Key::Unicode('c'), enigo::Direction::Click)
        .map_err(|e| format!("key click failed: {}", e))?;
    enigo.key(Key::Control, enigo::Direction::Release)
        .map_err(|e| format!("key up failed: {}", e))?;

    // 等待剪贴板更新
    std::thread::sleep(std::time::Duration::from_millis(100));

    // 读取选中的文本
    let selected = app.clipboard()
        .read_text()
        .map_err(|e| e.to_string())?;

    // 恢复原剪贴板内容
    let _ = app.clipboard().write_text(original);

    if selected.is_empty() {
        Err("No text selected".to_string())
    } else {
        Ok(selected)
    }
}
