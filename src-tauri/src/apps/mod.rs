use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesktopApp {
    pub name: String,
    pub path: String,
    pub target: Option<String>,
    pub icon: Option<String>,
}

#[cfg(target_os = "windows")]
pub mod windows;

#[cfg(target_os = "macos")]
pub mod macos;

/// Scan desktop applications on the current platform.
/// Returns an empty vector on unsupported platforms.
pub fn scan_desktop_apps() -> Vec<DesktopApp> {
    #[cfg(target_os = "windows")]
    {
        windows::scan_windows_apps()
    }
    #[cfg(target_os = "macos")]
    {
        macos::scan_macos_apps()
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        vec![]
    }
}
