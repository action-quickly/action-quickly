use super::DesktopApp;
use base64::Engine;
use std::path::PathBuf;
use std::os::windows::process::CommandExt;

/// Scan all Windows .lnk shortcuts from common locations using a single
/// PowerShell invocation for batch parsing (avoids per-file process overhead).
pub fn scan_windows_apps() -> Vec<DesktopApp> {
    // Collect all directories to scan
    let mut dirs = get_start_menu_dirs();
    dirs.extend(get_desktop_dirs());

    // Collect all .lnk file paths
    let mut all_lnks: Vec<PathBuf> = Vec::new();
    for dir in &dirs {
        all_lnks.extend(collect_lnk_files(dir));
    }

    if all_lnks.is_empty() {
        eprintln!("[apps] No .lnk files found");
        return vec![];
    }

    eprintln!("[apps] Found {} .lnk files, parsing...", all_lnks.len());

    // Parse all .lnk files in one PowerShell call
    let apps = batch_parse_lnks(&all_lnks);

    eprintln!("[apps] Scanned {} apps total", apps.len());
    for app in &apps {
        eprintln!(
            "[apps]   - {} | target={:?} | icon={:?}",
            app.name, app.target, app.icon
        );
    }

    apps
}

// ── Lnk parsing ──────────────────────────────────────────────────────────

/// Parse .lnk files using a single PowerShell invocation per chunk.
/// icon is NOT extracted (set to None) for efficiency — PowerShell COM is slow.
const BATCH_SIZE: usize = 30;

fn batch_parse_lnks(lnk_paths: &[PathBuf]) -> Vec<DesktopApp> {
    let mut apps = Vec::new();
    let mut seen = std::collections::HashSet::new();

    for chunk in lnk_paths.chunks(BATCH_SIZE) {
        // Write paths to a temp file (one per line) to avoid all quoting issues
        let temp_dir = std::env::temp_dir();
        let temp_file = temp_dir.join(format!("action_quick_lnk_{}.txt", apps.len()));
        let paths_content: String = chunk
            .iter()
            .map(|p| p.to_string_lossy().to_string())
            .collect::<Vec<_>>()
            .join("\n");
        if let Err(e) = std::fs::write(&temp_file, &paths_content) {
            eprintln!("[apps] Failed to write temp file: {}", e);
            continue;
        }

        // PowerShell reads from file, no quoting issues
        let script = format!(
            "$ws=New-Object -ComObject WScript.Shell;Get-Content -LiteralPath '{}' | ForEach-Object {{ if (Test-Path $_) {{ $s=$ws.CreateShortcut($_); $t=$s.TargetPath.TrimEnd('\\'); $n=[System.IO.Path]::GetFileNameWithoutExtension($_); Write-Output ('ITEM|'+$n+'|'+$_+'|'+$t) }} }}",
            temp_file.to_string_lossy().replace('\'', "''")
        );

        // Encode to UTF-16LE then base64 for -EncodedCommand
        let utf16le_bytes: Vec<u8> = script.encode_utf16().flat_map(|u| u.to_le_bytes()).collect();
        let b64 = base64::engine::general_purpose::STANDARD.encode(&utf16le_bytes);

        let output = match std::process::Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-EncodedCommand", &b64])
            .creation_flags(0x08000000) // CREATE_NO_WINDOW
            .output()
        {
            Ok(o) => o,
            Err(e) => {
                eprintln!("[apps] PowerShell chunk failed: {}", e);
                let _ = std::fs::remove_file(&temp_file);
                continue;
            }
        };

        let _ = std::fs::remove_file(&temp_file);

        if !output.status.success() {
            eprintln!(
                "[apps] PowerShell chunk stderr: {}",
                String::from_utf8_lossy(&output.stderr)
            );
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let preview: String = stdout.chars().take(500).collect();
        eprintln!("[apps] chunk output (first 500 chars): {}", preview);
        for line in stdout.lines() {
            let line = line.trim();
            if !line.starts_with("ITEM|") {
                continue;
            }

            // Format: ITEM|<name>|<lnk_path>|<target_path>
            let payload = &line[5..];
            let parts: Vec<&str> = payload.splitn(3, '|').collect();
            if parts.len() < 2 {
                eprintln!("[apps] SKIP line (too few parts): {}", line);
                continue;
            }

            let name = parts[0].to_string();
            let lnk_path = parts[1].to_string();
            let target_raw = parts.get(2).map(|s| s.to_string()).unwrap_or_default();

            if name.is_empty() {
                continue;
            }

            let target = if target_raw.is_empty() {
                None
            } else {
                Some(target_raw)
            };

            // Deduplicate by name (case-insensitive)
            let name_lower = name.to_lowercase();
            if !seen.insert(name_lower) {
                continue;
            }

            apps.push(DesktopApp {
                name,
                path: lnk_path,
                target,
                icon: None,
            });
        }
    }

    apps
}

// ── Directory helpers ────────────────────────────────────────────────────

fn get_start_menu_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();

    // %APPDATA%\Microsoft\Windows\Start Menu\Programs (user-specific)
    if let Ok(appdata) = std::env::var("APPDATA") {
        dirs.push(PathBuf::from(appdata).join(r"Microsoft\Windows\Start Menu\Programs"));
    }

    // %PROGRAMDATA%\Microsoft\Windows\Start Menu\Programs (all users)
    if let Ok(programdata) = std::env::var("PROGRAMDATA") {
        dirs.push(PathBuf::from(programdata).join(r"Microsoft\Windows\Start Menu\Programs"));
    }

    // %LOCALAPPDATA%\Microsoft\Windows\Start Menu\Programs
    // (JetBrains Toolbox and some installers place shortcuts here)
    if let Ok(localappdata) = std::env::var("LOCALAPPDATA") {
        let local_start = PathBuf::from(localappdata)
            .join(r"Microsoft\Windows\Start Menu\Programs");
        if local_start.exists() && !dirs.contains(&local_start) {
            dirs.push(local_start);
        }
    }

    dirs
}

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

// ── Recursive .lnk collector ────────────────────────────────────────────

fn collect_lnk_files(dir: &PathBuf) -> Vec<PathBuf> {
    let mut lnk_files = Vec::new();

    if !dir.exists() {
        eprintln!("[apps] Directory does not exist: {:?}", dir);
        return lnk_files;
    }

    collect_lnk_recursive(dir, &mut lnk_files);
    lnk_files
}

fn collect_lnk_recursive(dir: &PathBuf, out: &mut Vec<PathBuf>) {
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                collect_lnk_recursive(&path, out);
            } else if path.extension().map(|e| e == "lnk").unwrap_or(false) {
                out.push(path);
            }
        }
    }
}
