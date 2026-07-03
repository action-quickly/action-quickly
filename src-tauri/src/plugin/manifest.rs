use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// 插件清单 — 对应 plugin.json
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    pub author: String,
    pub description: String,
    pub icon: String,
    pub main: String,
    #[serde(default)]
    pub keywords: Vec<String>,
    #[serde(default)]
    pub context: Option<PluginContext>,
    #[serde(default)]
    pub permissions: Vec<String>,
    #[serde(default)]
    pub min_host_version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginContext {
    #[serde(default)]
    pub text: Option<PluginContextText>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginContextText {
    pub pattern: String,
    pub label: String,
}

/// 已安装插件的完整信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledPlugin {
    #[serde(flatten)]
    pub manifest: PluginManifest,
    pub path: String,
}

impl PluginManifest {
    /// 从 JSON 字符串解析并校验
    pub fn from_json(json: &str) -> Result<Self, ManifestError> {
        let manifest: PluginManifest = serde_json::from_str(json)?;
        manifest.validate()?;
        Ok(manifest)
    }

    /// 从文件路径解析
    pub fn from_file(path: &PathBuf) -> Result<Self, ManifestError> {
        let content = std::fs::read_to_string(path)
            .map_err(|e| ManifestError::IoError(e.to_string()))?;
        Self::from_json(&content)
    }

    /// 校验必填字段
    pub fn validate(&self) -> Result<(), ManifestError> {
        if self.id.trim().is_empty() {
            return Err(ManifestError::MissingField("id".into()));
        }
        // id 只允许小写字母、数字、连字符
        if !self.id.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-') {
            return Err(ManifestError::InvalidId(self.id.clone()));
        }
        if self.name.trim().is_empty() {
            return Err(ManifestError::MissingField("name".into()));
        }
        if self.version.trim().is_empty() {
            return Err(ManifestError::MissingField("version".into()));
        }
        if self.main.trim().is_empty() {
            return Err(ManifestError::MissingField("main".into()));
        }
        Ok(())
    }

    /// 校验权限是否合法
    pub fn validate_permissions(&self) -> Result<(), ManifestError> {
        let valid_perms = [
            "clipboard", "storage", "notification",
            "fs:read", "fs:write", "shell:exec", "http", "window",
        ];
        for perm in &self.permissions {
            if !valid_perms.contains(&perm.as_str()) {
                return Err(ManifestError::InvalidPermission(perm.clone()));
            }
        }
        Ok(())
    }
}

#[derive(Debug, thiserror::Error)]
pub enum ManifestError {
    #[error("JSON 解析失败: {0}")]
    ParseError(String),
    #[error("缺少必填字段: {0}")]
    MissingField(String),
    #[error("插件 ID 格式非法: {0}（只允许小写字母、数字、连字符）")]
    InvalidId(String),
    #[error("非法权限: {0}")]
    InvalidPermission(String),
    #[error("IO 错误: {0}")]
    IoError(String),
}

impl From<serde_json::Error> for ManifestError {
    fn from(e: serde_json::Error) -> Self {
        ManifestError::ParseError(e.to_string())
    }
}
