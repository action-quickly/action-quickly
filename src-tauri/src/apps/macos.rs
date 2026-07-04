use super::DesktopApp;
use std::path::PathBuf;

/// Read a value from an Info.plist file (very basic parser).
fn read_plist_string(plist_path: &std::path::Path, key: &str) -> Option<String> {
    let content = std::fs::read_to_string(plist_path).ok()?;

    // Simple XML plist parsing: look for <key>key</key><string>value</string>
    let pattern = format!("<key>{}</key>", key);
    let start = content.find(&pattern)?;
    let after_key = &content[start + pattern.len()..];

    let string_start = after_key.find("<string>")?;
    let string_content_start = string_start + "<string>".len();
    let after_string_start = &after_key[string_content_start..];

    let string_end = after_string_start.find("</string>")?;
    Some(after_string_start[..string_end].to_string())
}

/// Scan a single .app bundle.
fn scan_app_bundle(path: &std::path::Path) -> Option<DesktopApp> {
    let plist_path = path.join("Contents").join("Info.plist");
    if !plist_path.exists() {
        return None;
    }

    let bundle_name = read_plist_string(&plist_path, "CFBundleName")
        .or_else(|| read_plist_string(&plist_path, "CFBundleDisplayName"))
        .unwrap_or_else(|| {
            path.file_stem()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_default()
        });

    let executable = read_plist_string(&plist_path, "CFBundleExecutable");
    let target = executable.map(|exe| {
        path.join("Contents")
            .join("MacOS")
            .join(exe)
            .to_string_lossy()
            .to_string()
    });

    let icon_name = read_plist_string(&plist_path, "CFBundleIconFile");
    let icon = icon_name.map(|name| {
        let icon_path = path.join("Contents").join("Resources").join(&name);
        // Add .icns extension if not present
        if icon_path.extension().is_some() {
            icon_path.to_string_lossy().to_string()
        } else {
            icon_path.with_extension("icns").to_string_lossy().to_string()
        }
    });

    let name = bundle_name
        .strip_suffix(".app")
        .unwrap_or(&bundle_name)
        .to_string();

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

/// Scan all .app bundles from /Applications and ~/Applications.
pub fn scan_macos_apps() -> Vec<DesktopApp> {
    let mut apps = Vec::new();
    let mut seen = std::collections::HashSet::new();

    let dirs = vec![
        PathBuf::from("/Applications"),
        dirs::home_dir()
            .unwrap_or_default()
            .join("Applications"),
    ];

    for dir in &dirs {
        if !dir.exists() {
            continue;
        }

        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().map(|e| e == "app").unwrap_or(false) {
                    if let Some(app) = scan_app_bundle(&path) {
                        let name_lower = app.name.to_lowercase();
                        if seen.insert(name_lower) {
                            apps.push(app);
                        }
                    }
                }
            }
        }
    }

    apps
}
