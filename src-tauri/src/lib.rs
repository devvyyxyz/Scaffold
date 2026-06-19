// Scaffold desktop backend.
//
// Filesystem operations are handled via custom IPC commands to avoid
// Tauri v2's fs-plugin scope restrictions, which block access to
// arbitrary user directories (e.g. ~/Documents/Scaffold-projects).

use std::fs;
use std::path::PathBuf;
use tauri::{command, AppHandle, Manager};

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

/// Show the onboarding window and optionally hide the main window.
#[command]
fn show_onboarding_window(app: AppHandle) -> Result<(), String> {
    // Show the onboarding window
    if let Some(win) = app.get_webview_window("onboarding") {
        win.show().map_err(|e| e.to_string())?;
        win.set_focus().map_err(|e| e.to_string())?;
    }
    // Hide main window while onboarding is open
    if let Some(main) = app.get_webview_window("main") {
        main.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Close the onboarding window and show the main window.
#[command]
fn close_onboarding_window(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("onboarding") {
        win.close().map_err(|e| e.to_string())?;
    }
    if let Some(main) = app.get_webview_window("main") {
        main.show().map_err(|e| e.to_string())?;
        main.set_focus().map_err(|e| e.to_string())?;
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
            scaffold_write_text_file,
            scaffold_read_text_file,
            scaffold_exists,
            scaffold_read_dir,
            show_onboarding_window,
            close_onboarding_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Scaffold application");
}
