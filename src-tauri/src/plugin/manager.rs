use crate::permission::store::PermissionStore;
use crate::plugin::manifest::{InstalledPlugin, ManifestError, PluginManifest};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

/// 插件管理器
pub struct PluginManager {
    app: AppHandle,
}

impl PluginManager {
    pub fn new(app: AppHandle) -> Self {
        Self { app }
    }

    /// 获取插件根目录 ~/.action-quick/plugins/
    pub fn plugins_dir(&self) -> PathBuf {
        let base = self.app.path().home_dir().unwrap_or_else(|_| {
            dirs::home_dir().unwrap_or_else(|| PathBuf::from("."))
        });
        base.join(".action-quick").join("plugins")
    }

    /// 获取数据存储目录 ~/.action-quick/storage/
    #[allow(dead_code)]
    pub fn storage_dir(&self) -> PathBuf {
        let base = self.app.path().home_dir().unwrap_or_else(|_| {
            dirs::home_dir().unwrap_or_else(|| PathBuf::from("."))
        });
        base.join(".action-quick").join("storage")
    }

    /// 列出所有已安装插件
    pub fn list_plugins(&self) -> Vec<InstalledPlugin> {
        let plugins_dir = self.plugins_dir();
        let mut plugins = Vec::new();

        if let Ok(entries) = std::fs::read_dir(&plugins_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    let manifest_path = path.join("plugin.json");
                    if manifest_path.exists() {
                        if let Ok(manifest) = PluginManifest::from_file(&manifest_path) {
                            plugins.push(InstalledPlugin {
                                manifest,
                                path: path.to_string_lossy().to_string(),
                            });
                        }
                    }
                }
            }
        }

        plugins
    }

    /// 获取单个插件信息
    pub fn get_plugin(&self, plugin_id: &str) -> Option<InstalledPlugin> {
        self.list_plugins()
            .into_iter()
            .find(|p| p.manifest.id == plugin_id)
    }

    /// 从目录安装插件（开发测试用）
    pub fn install_from_dir(&self, source_dir: &Path) -> Result<PluginManifest, InstallError> {
        let manifest_path = source_dir.join("plugin.json");
        if !manifest_path.exists() {
            return Err(InstallError::ManifestNotFound);
        }

        let manifest = PluginManifest::from_file(&manifest_path)
            .map_err(InstallError::ManifestError)?;
        manifest.validate_permissions()
            .map_err(InstallError::ManifestError)?;

        // 目标目录
        let plugin_dir = self.plugins_dir().join(&manifest.id);
        std::fs::create_dir_all(self.plugins_dir())
            .map_err(|e| InstallError::IoError(e.to_string()))?;

        // 如果已存在则先删除
        if plugin_dir.exists() {
            std::fs::remove_dir_all(&plugin_dir)
                .map_err(|e| InstallError::IoError(e.to_string()))?;
        }

        // 复制目录内容
        copy_dir_recursive(source_dir, &plugin_dir)
            .map_err(|e| InstallError::IoError(e))?;

        // 保存权限记录
        let perm_store = PermissionStore::new(self.app.clone());
        perm_store.save_permissions(&manifest.id, &manifest.permissions)
            .map_err(|e| InstallError::IoError(e))?;

        Ok(manifest)
    }


    /// 安装插件（从 zip 文件）
    pub fn install_from_zip(&self, zip_path: &Path) -> Result<PluginManifest, InstallError> {
        let file = std::fs::File::open(zip_path)
            .map_err(|e| InstallError::IoError(e.to_string()))?;
        let mut archive = zip::ZipArchive::new(file)
            .map_err(|e| InstallError::ZipError(e.to_string()))?;

        // 先解压到临时目录，读取 manifest 校验后再移动到正式目录
        let temp_dir = std::env::temp_dir().join(format!("aq-install-{}", crate::utils::uuid_like()));
        std::fs::create_dir_all(&temp_dir)
            .map_err(|e| InstallError::IoError(e.to_string()))?;

        for i in 0..archive.len() {
            let mut file = archive.by_index(i)
                .map_err(|e| InstallError::ZipError(e.to_string()))?;
            let outpath = match file.enclosed_name() {
                Some(path) => temp_dir.join(path),
                None => continue,
            };
            if file.is_dir() {
                std::fs::create_dir_all(&outpath)
                    .map_err(|e| InstallError::IoError(e.to_string()))?;
            } else {
                if let Some(parent) = outpath.parent() {
                    std::fs::create_dir_all(parent)
                        .map_err(|e| InstallError::IoError(e.to_string()))?;
                }
                let mut outfile = std::fs::File::create(&outpath)
                    .map_err(|e| InstallError::IoError(e.to_string()))?;
                std::io::copy(&mut file, &mut outfile)
                    .map_err(|e| InstallError::IoError(e.to_string()))?;
            }
        }

        // 查找 plugin.json（可能在根目录或子目录）
        let manifest_path = self.find_manifest(&temp_dir)
            .ok_or(InstallError::ManifestNotFound)?;

        let manifest = PluginManifest::from_file(&manifest_path)
            .map_err(InstallError::ManifestError)?;
        manifest.validate_permissions()
            .map_err(InstallError::ManifestError)?;

        // 检查主程序版本兼容性
        if !crate::version::is_host_compatible(crate::HOST_VERSION, &manifest.min_host_version) {
            return Err(InstallError::IncompatibleHost {
                required: manifest.min_host_version.clone(),
                current: crate::HOST_VERSION.to_string(),
            });
        }

        // 移动到正式目录
        let plugin_dir = self.plugins_dir().join(&manifest.id);
        // 如果已存在则先删除（覆盖安装）
        if plugin_dir.exists() {
            std::fs::remove_dir_all(&plugin_dir)
                .map_err(|e| InstallError::IoError(e.to_string()))?;
        }
        std::fs::create_dir_all(self.plugins_dir())
            .map_err(|e| InstallError::IoError(e.to_string()))?;

        // 移动 manifest 所在目录的内容
        let manifest_parent = manifest_path.parent()
            .ok_or(InstallError::ManifestNotFound)?;
        // 如果 manifest 在 temp_dir 根目录，直接移动 temp_dir 内容
        // 如果在子目录，移动子目录内容
        let source_dir = if manifest_parent == temp_dir.as_path() {
            temp_dir.clone()
        } else {
            manifest_parent.to_path_buf()
        };

        move_dir_contents(&source_dir, &plugin_dir)
            .map_err(|e| InstallError::IoError(e))?;

        // 清理临时目录
        let _ = std::fs::remove_dir_all(&temp_dir);

        // 保存权限记录
        let perm_store = PermissionStore::new(self.app.clone());
        perm_store.save_permissions(&manifest.id, &manifest.permissions)
            .map_err(|e| InstallError::IoError(e))?;

        Ok(manifest)
    }

    /// 卸载插件
    pub fn uninstall_plugin(&self, plugin_id: &str) -> Result<(), InstallError> {
        let plugin_dir = self.plugins_dir().join(plugin_id);
        if plugin_dir.exists() {
            std::fs::remove_dir_all(&plugin_dir)
                .map_err(|e| InstallError::IoError(e.to_string()))?;
        }
        Ok(())
    }

    /// 在目录中递归查找 plugin.json
    fn find_manifest(&self, dir: &Path) -> Option<PathBuf> {
        // 先检查根目录
        let direct = dir.join("plugin.json");
        if direct.exists() {
            return Some(direct);
        }
        // 检查一级子目录
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    let manifest = path.join("plugin.json");
                    if manifest.exists() {
                        return Some(manifest);
                    }
                }
            }
        }
        None
    }

    /// 从 zip 文件中读取 plugin.json（不解压全量）
    #[allow(dead_code)]
    pub fn read_manifest_from_zip(zip_path: &Path) -> Result<PluginManifest, InstallError> {
        let file = std::fs::File::open(zip_path)
            .map_err(|e| InstallError::IoError(e.to_string()))?;
        let mut archive = zip::ZipArchive::new(file)
            .map_err(|e| InstallError::ZipError(e.to_string()))?;

        // 查找 plugin.json
        for i in 0..archive.len() {
            let name = {
                let file = archive.by_index(i)
                    .map_err(|e| InstallError::ZipError(e.to_string()))?;
                file.name().to_string()
            };

            // 匹配根目录或一级子目录的 plugin.json
            if name == "plugin.json" || name.ends_with("/plugin.json") {
                let mut content = String::new();
                use std::io::Read;
                let mut file = archive.by_index(i)
                    .map_err(|e| InstallError::ZipError(e.to_string()))?;
                file.read_to_string(&mut content)
                    .map_err(|e| InstallError::IoError(e.to_string()))?;
                return PluginManifest::from_json(&content)
                    .map_err(InstallError::ManifestError);
            }
        }
        Err(InstallError::ManifestNotFound)
    }
}

#[derive(Debug, thiserror::Error)]
pub enum InstallError {
    #[error("IO 错误: {0}")]
    IoError(String),
    #[error("ZIP 解压失败: {0}")]
    ZipError(String),
    #[error("未找到 plugin.json")]
    ManifestNotFound,
    #[error("清单错误: {0}")]
    ManifestError(ManifestError),
    #[error("插件需要主程序 v{required}+，当前 v{current}，请先更新主程序")]
    IncompatibleHost { required: String, current: String },
}



/// 移动目录内容到目标目录
fn move_dir_contents(src: &Path, dst: &Path) -> Result<(), String> {
    std::fs::create_dir_all(dst).map_err(|e| e.to_string())?;
    if let Ok(entries) = std::fs::read_dir(src) {
        for entry in entries.flatten() {
            let src_path = entry.path();
            let file_name = entry.file_name();
            let dst_path = dst.join(&file_name);
            if src_path.is_dir() {
                std::fs::rename(&src_path, &dst_path)
                    .or_else(|_| {
                        // rename 跨盘符可能失败，用 copy + remove
                        copy_dir_recursive(&src_path, &dst_path)?;
                        std::fs::remove_dir_all(&src_path).map_err(|e| e.to_string())
                    })
                    .map_err(|e| e.to_string())?;
            } else {
                std::fs::copy(&src_path, &dst_path)
                    .map(|_| ())
                    .map_err(|e| e.to_string())?;
                let _ = std::fs::remove_file(&src_path);
            }
        }
    }
    Ok(())
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    std::fs::create_dir_all(dst).map_err(|e| e.to_string())?;
    if let Ok(entries) = std::fs::read_dir(src) {
        for entry in entries.flatten() {
            let src_path = entry.path();
            let dst_path = dst.join(entry.file_name());
            if src_path.is_dir() {
                copy_dir_recursive(&src_path, &dst_path)?;
            } else {
                std::fs::copy(&src_path, &dst_path).map_err(|e| e.to_string())?;
            }
        }
    }
    Ok(())
}
