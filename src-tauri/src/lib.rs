// Scaffold desktop backend.
//
// Filesystem operations are handled via custom IPC commands to avoid
// Tauri v2's fs-plugin scope restrictions, which block access to
// arbitrary user directories (e.g. ~/Documents/Scaffold-projects).

use std::fs;
use std::path::PathBuf;
use tauri::{command, AppHandle, Emitter, Manager};

// ---------------------------------------------------------------------------
// Filesystem commands
// ---------------------------------------------------------------------------

/// Create a directory (and all parents) at `path`.
#[command]
fn scaffold_mkdir(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| format!("mkdir failed: {e}"))
}

/// Recursively remove a file or directory at `path`.
#[command]
fn scaffold_remove(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if p.is_dir() {
        fs::remove_dir_all(&path).map_err(|e| format!("remove_dir_all failed: {e}"))
    } else {
        fs::remove_file(&path).map_err(|e| format!("remove_file failed: {e}"))
    }
}

/// Rename / move `from` to `to`.
#[command]
fn scaffold_rename(from: String, to: String) -> Result<(), String> {
    fs::rename(&from, &to).map_err(|e| format!("rename failed: {e}"))
}

/// Move a directory tree from `from` to `to`.
///
/// Tries a fast `fs::rename`; if that fails (e.g. cross-device / different
/// volume), falls back to a recursive copy + remove. This is necessary for
/// the archive workflow because the archive dir may sit on a different mount.
#[command]
fn scaffold_move_dir(from: String, to: String) -> Result<(), String> {
    let from_path = PathBuf::from(&from);
    let to_path = PathBuf::from(&to);

    // Try a fast, atomic rename first.
    match fs::rename(&from_path, &to_path) {
        Ok(()) => Ok(()),
        Err(rename_err) => {
            // Fallback: recursive copy then remove the source.
            copy_dir_recursive(&from_path, &to_path)
                .map_err(|e| format!("move copy fallback failed: {e}"))?;
            fs::remove_dir_all(&from_path).map_err(|e| {
                format!("move cleanup failed (rename was: {rename_err}): {e}")
            })?;
            Ok(())
        }
    }
}

/// Recursively copy a directory tree into a new location, leaving the source
/// intact. Used by the duplicate-project workflow. Creates `dest` and all
/// intermediate dirs.
#[command]
fn scaffold_copy_dir(from: String, to: String) -> Result<(), String> {
    copy_dir_recursive(&PathBuf::from(&from), &PathBuf::from(&to))
}

/// Recursively copy a directory tree. Used as a cross-volume fallback by
/// `scaffold_move_dir`. Creates `dest` and all intermediate dirs.
fn copy_dir_recursive(src: &PathBuf, dest: &PathBuf) -> Result<(), String> {
    fs::create_dir_all(dest).map_err(|e| format!("create_dir_all failed: {e}"))?;
    for entry in fs::read_dir(src).map_err(|e| format!("read_dir failed: {e}"))? {
        let entry = entry.map_err(|e| format!("readdir entry: {e}"))?;
        let file_type = entry
            .file_type()
            .map_err(|e| format!("file_type failed: {e}"))?;
        let from_child = entry.path();
        let to_child = dest.join(entry.file_name());
        if file_type.is_dir() {
            copy_dir_recursive(&from_child, &to_child)?;
        } else if file_type.is_symlink() {
            let target = fs::read_link(&from_child)
                .map_err(|e| format!("read_link failed: {e}"))?;
            #[cfg(unix)]
            std::os::unix::fs::symlink(&target, &to_child)
                .map_err(|e| format!("symlink failed: {e}"))?;
            #[cfg(not(unix))]
            fs::copy(&from_child, &to_child)
                .map_err(|e| format!("symlink fallback copy failed: {e}"))?;
        } else {
            fs::copy(&from_child, &to_child)
                .map_err(|e| format!("copy failed: {e}"))?;
        }
    }
    Ok(())
}

/// Write `contents` to a text file, creating parents as needed.
#[command]
fn scaffold_write_text_file(path: String, contents: String) -> Result<(), String> {
    if let Some(parent) = PathBuf::from(&path).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("mkdir parent failed: {e}"))?;
    }
    fs::write(&path, contents).map_err(|e| format!("write failed: {e}"))
}

/// Read a text file to string.
#[command]
fn scaffold_read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("read failed: {e}"))
}

/// Return `true` if `path` exists (file or directory).
#[command]
fn scaffold_exists(path: String) -> Result<bool, String> {
    Ok(PathBuf::from(&path).exists())
}

/// List immediate children of a directory. Returns file/folder names.
#[command]
fn scaffold_read_dir(path: String) -> Result<Vec<String>, String> {
    let entries = fs::read_dir(&path).map_err(|e| format!("readdir failed: {e}"))?;
    let mut names = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| format!("readdir entry: {e}"))?;
        if let Some(name) = entry.file_name().to_str() {
            names.push(name.to_owned());
        }
    }
    Ok(names)
}

// ---------------------------------------------------------------------------
// Sample IPC command
// ---------------------------------------------------------------------------

#[command]
fn greet(name: &str) -> String {
    format!("Hello from Scaffold, {}!", name)
}

// ---------------------------------------------------------------------------
// Window management commands
// ---------------------------------------------------------------------------

/// Show the onboarding window and hide the main window.
///
/// The onboarding window is declared statically in tauri.conf.json with
/// `visible: false`, so it already exists — we just reveal it. We never
/// `close()` these auxiliary windows; `close()` destroys them in Tauri v2
/// and they can't be recreated, so `hide()`/`show()` is used everywhere.
#[command]
fn show_onboarding_window(app: AppHandle) -> Result<(), String> {
    // Reveal onboarding first, then hide main so there's never a frame with
    // no visible window.
    if let Some(win) = app.get_webview_window("onboarding") {
        win.show().map_err(|e| e.to_string())?;
        win.set_focus().map_err(|e| e.to_string())?;
    } else {
        return Err("onboarding window not found".to_string());
    }
    if let Some(main) = app.get_webview_window("main") {
        main.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Hide the onboarding window and reveal the main window.
///
/// Ordering matters: we show + focus the main window and emit the
/// `onboarding-complete` event *before* hiding the onboarding window. That
/// way the invoking webview is still alive when the command returns, so the
/// frontend `invoke()` resolves cleanly instead of rejecting mid-flight.
#[command]
fn close_onboarding_window(app: AppHandle) -> Result<(), String> {
    // 1. Bring the main window back and tell it to re-read saved settings.
    if let Some(main) = app.get_webview_window("main") {
        main.show().map_err(|e| e.to_string())?;
        main.set_focus().map_err(|e| e.to_string())?;
        main.emit("onboarding-complete", ()).map_err(|e| e.to_string())?;
    } else {
        return Err("main window not found".to_string());
    }
    // 2. Now hide the onboarding window (keep it around for reuse).
    if let Some(win) = app.get_webview_window("onboarding") {
        win.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Show the projects window and hide the main window.
#[command]
fn show_projects_window(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("projects") {
        win.show().map_err(|e| e.to_string())?;
        win.set_focus().map_err(|e| e.to_string())?;
    } else {
        return Err("projects window not found".to_string());
    }
    if let Some(main) = app.get_webview_window("main") {
        main.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Hide the projects window and reveal the main window.
#[command]
fn close_projects_window(app: AppHandle) -> Result<(), String> {
    if let Some(main) = app.get_webview_window("main") {
        main.show().map_err(|e| e.to_string())?;
        main.set_focus().map_err(|e| e.to_string())?;
    } else {
        return Err("main window not found".to_string());
    }
    if let Some(win) = app.get_webview_window("projects") {
        win.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// App entry
// ---------------------------------------------------------------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // If onboarding hasn't been completed, show the onboarding window
            // and hide the main window on startup.
            let main_window = app.get_webview_window("main").unwrap();
            // We'll check settings in the frontend and invoke these commands;
            // for now just ensure both windows exist.
            let _ = app.get_webview_window("onboarding");
            // Store the main window handle — the frontend decides visibility.
            drop(main_window);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            scaffold_mkdir,
            scaffold_remove,
            scaffold_rename,
            scaffold_move_dir,
            scaffold_copy_dir,
            scaffold_write_text_file,
            scaffold_read_text_file,
            scaffold_exists,
            scaffold_read_dir,
            show_onboarding_window,
            close_onboarding_window,
            show_projects_window,
            close_projects_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Scaffold application");
}
