use crate::permission::store::PermissionStore;
use tauri::{AppHandle, WebviewWindow};

/// 权限校验器
#[allow(dead_code)]
pub struct PermissionChecker {
    app: AppHandle,
}

#[allow(dead_code)]
impl PermissionChecker {
    pub fn new(app: AppHandle) -> Self {
        Self { app }
    }

    /// 从窗口 label 中解析插件 ID
    /// label 格式: "plugin:{plugin_id}"
    pub fn plugin_id_from_window(window: &WebviewWindow) -> Option<String> {
        let label = window.label();
        if label.starts_with("plugin:") {
            Some(label[7..].to_string())
        } else {
            None
        }
    }

    /// 校验当前窗口对应的插件是否有指定权限
    pub fn check_window_permission(
        &self,
        window: &WebviewWindow,
        permission: &str,
    ) -> Result<String, PermissionDenied> {
        match Self::plugin_id_from_window(window) {
            Some(plugin_id) => {
                let store = PermissionStore::new(self.app.clone());
                if store.has_permission(&plugin_id, permission) {
                    Ok(plugin_id)
                } else {
                    Err(PermissionDenied {
                        plugin_id,
                        permission: permission.to_string(),
                    })
                }
            }
            None => Err(PermissionDenied {
                plugin_id: "unknown".to_string(),
                permission: permission.to_string(),
            }),
        }
    }
}

#[derive(Debug, thiserror::Error)]
#[error("插件 {plugin_id} 未授权权限: {permission}")]
#[allow(dead_code)]
pub struct PermissionDenied {
    pub plugin_id: String,
    pub permission: String,
}

impl serde::Serialize for PermissionDenied {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut state = serializer.serialize_struct("PermissionDenied", 3)?;
        state.serialize_field("kind", "PermissionDenied")?;
        state.serialize_field("plugin_id", &self.plugin_id)?;
        state.serialize_field("permission", &self.permission)?;
        state.end()
    }
}
