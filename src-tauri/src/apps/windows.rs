use super::DesktopApp;
use std::path::PathBuf;

/// Parse a .lnk shortcut file using the Windows IShellLink COM interface.
fn parse_lnk(path: &std::path::Path) -> Option<DesktopApp> {
    // Use powershell to parse .lnk files since the windows crate COM interfaces
    // can be complex. This is a pragmatic approach that works reliably.
    let output = std::process::Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            &format!(
                r#"$WScript = New-Object -ComObject WScript.Shell; $shortcut = $WScript.CreateShortcut('{}'); Write-Output "TARGET=$($shortcut.TargetPath)"; Write-Output "ICON=$($shortcut.IconLocation)" "#,
                path.to_string_lossy().replace('\'', "''")
            ),
        ])
        .output()
        .ok()?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut target: Option<String> = None;
    let mut icon: Option<String> = None;

    for line in stdout.lines() {
        if let Some(rest) = line.strip_prefix("TARGET=") {
            let t = rest.trim();
            if !t.is_empty() {
                target = Some(t.to_string());
            }
        } else if let Some(rest) = line.strip_prefix("ICON=") {
            let i = rest.trim();
            if !i.is_empty() {
                // IconLocation may be "path,index" - extract just the path
                let icon_path = i.split(',').next().unwrap_or(i);
                if !icon_path.is_empty() {
                    icon = Some(icon_path.to_string());
                }
            }
        }
    }

    // Use the .lnk name (without extension) as the display name
    let name = path
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();

    if name.is_empty() {
        return None;
    }

    Some(DesktopApp {
        name,
        path: path.to_string_lossy().to_string(),
        target,
        icon,
    })
}

/// Get the Start Menu Programs directories
fn get_start_menu_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();

    // %APPDATA%\Microsoft\Windows\Start Menu\Programs
    if let Ok(appdata) = std::env::var("APPDATA") {
        dirs.push(PathBuf::from(appdata).join(r"Microsoft\Windows\Start Menu\Programs"));
    }

    // %PROGRAMDATA%\Microsoft\Windows\Start Menu\Programs (Common start menu)
    if let Ok(programdata) = std::env::var("PROGRAMDATA") {
        dirs.push(PathBuf::from(programdata).join(r"Microsoft\Windows\Start Menu\Programs"));
    }

    dirs
}

/// Get desktop directories
fn get_desktop_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();

    // %USERPROFILE%\Desktop
    if let Ok(userprofile) = std::env::var("USERPROFILE") {
        dirs.push(PathBuf::from(userprofile).join("Desktop"));
    }

    // %PUBLIC%\Desktop
    if let Ok(public) = std::env::var("PUBLIC") {
        dirs.push(PathBuf::from(public).join("Desktop"));
    }

    dirs
}

/// Collect all .lnk files from a directory (non-recursive)
fn collect_lnk_files(dir: &PathBuf) -> Vec<PathBuf> {
    let mut lnk_files = Vec::new();

    if !dir.exists() {
        return lnk_files;
    }

    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map(|e| e == "lnk").unwrap_or(false) {
                lnk_files.push(path);
            }
        }
    }

    lnk_files
}

/// Scan all Windows .lnk shortcuts from common locations.
pub fn scan_windows_apps() -> Vec<DesktopApp> {
    let mut apps = Vec::new();
    let mut seen = std::collections::HashSet::new();

    // Collect all directories to scan
    let mut dirs = get_start_menu_dirs();
    dirs.extend(get_desktop_dirs());

    for dir in &dirs {
        let lnk_files = collect_lnk_files(dir);
        for lnk_path in &lnk_files {
            if let Some(app) = parse_lnk(lnk_path) {
                // Deduplicate by name (case-insensitive)
                let name_lower = app.name.to_lowercase();
                if seen.insert(name_lower) {
                    apps.push(app);
                }
            }
        }
    }

    apps
}
