use std::collections::HashMap;
use std::path::PathBuf;
use tauri::AppHandle;

/// 权限存储 — 持久化插件的已授权权限
pub struct PermissionStore {
    app: AppHandle,
}

impl PermissionStore {
    pub fn new(app: AppHandle) -> Self {
        Self { app }
    }

    /// 权限文件路径 ~/.action-quick/permissions.json
    fn permissions_file(&self) -> PathBuf {
        let dir = crate::utils::app_data_dir(&self.app);
        std::fs::create_dir_all(&dir).ok();
        dir.join("permissions.json")
    }

    /// 读取所有权限记录
    fn load(&self) -> HashMap<String, Vec<String>> {
        let path = self.permissions_file();
        if !path.exists() {
            return HashMap::new();
        }
        let content = std::fs::read_to_string(&path).unwrap_or_default();
        if content.trim().is_empty() {
            return HashMap::new();
        }
        serde_json::from_str(&content).unwrap_or_default()
    }

    /// 保存所有权限记录
    fn save(&self, data: &HashMap<String, Vec<String>>) -> Result<(), String> {
        let path = self.permissions_file();
        let json = serde_json::to_string_pretty(data).map_err(|e| e.to_string())?;
        std::fs::write(&path, json).map_err(|e| e.to_string())?;
        Ok(())
    }

    /// 保存插件的权限
    pub fn save_permissions(&self, plugin_id: &str, permissions: &[String]) -> Result<(), String> {
        let mut data = self.load();
        data.insert(plugin_id.to_string(), permissions.to_vec());
        self.save(&data)
    }

    /// 移除插件的权限记录
    pub fn remove_permissions(&self, plugin_id: &str) -> Result<(), String> {
        let mut data = self.load();
        data.remove(plugin_id);
        self.save(&data)
    }

    /// 检查插件是否有某权限
    pub fn has_permission(&self, plugin_id: &str, permission: &str) -> bool {
        let data = self.load();
        if let Some(perms) = data.get(plugin_id) {
            perms.iter().any(|p| p == permission)
        } else {
            false
        }
    }
}
