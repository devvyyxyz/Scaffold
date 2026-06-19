// IPC helpers — typed wrappers around Tauri invoke + plugin APIs.
//
// Everything that crosses the Rust<->JS boundary goes through here so the
// call sites stay clean and we have one place to add error mapping.
//
// Filesystem operations use custom Rust commands (scaffold_*) instead of the
// @tauri-apps/plugin-fs to avoid Tauri v2 scope restrictions that block
// access to arbitrary user directories.

import { invoke } from "@tauri-apps/api/core";

/** Whether we're running inside the Tauri webview (vs. a plain browser). */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Whether this window is the onboarding window (detected via URL param). */
export function isOnboardingWindow(): boolean {
  return new URLSearchParams(window.location.search).get("window") === "onboarding";
}

/** Show the onboarding window and hide the main window. */
export async function showOnboardingWindow(): Promise<void> {
  if (!isTauri()) return;
  await invoke("show_onboarding_window");
}

/** Close the onboarding window and show the main window. */
export async function closeOnboardingWindow(): Promise<void> {
  if (!isTauri()) return;
  await invoke("close_onboarding_window");
}

/** Sample command — proves the Rust bridge works. Returns a greeting. */
export async function greet(name: string): Promise<string> {
  if (!isTauri()) return `Hello from Scaffold, ${name}! (browser fallback)`;
  return invoke<string>("greet", { name });
}

// ---------------------------------------------------------------------------
// Filesystem commands (Rust-backed, scope-free)
// ---------------------------------------------------------------------------

/** Create a directory (and all parents) at `path`. */
export async function fsMkdir(path: string): Promise<void> {
  if (!isTauri()) return;
  await invoke("scaffold_mkdir", { path });
}

/** Write `contents` to a text file, creating parents as needed. */
export async function fsWriteTextFile(
  path: string,
  contents: string
): Promise<void> {
  if (!isTauri()) return;
  await invoke("scaffold_write_text_file", { path, contents });
}

/** Read a text file to string. */
export async function fsReadTextFile(path: string): Promise<string> {
  if (!isTauri()) return "";
  return invoke<string>("scaffold_read_text_file", { path });
}

/** Return true if `path` exists (file or directory). */
export async function fsExists(path: string): Promise<boolean> {
  if (!isTauri()) return false;
  return invoke<boolean>("scaffold_exists", { path });
}

/** List immediate children of a directory. Returns file/folder names. */
export async function fsReadDir(path: string): Promise<string[]> {
  if (!isTauri()) return [];
  return invoke<string[]>("scaffold_read_dir", { path });
}

/** Remove a file or directory recursively. */
export async function fsRemove(path: string): Promise<void> {
  if (!isTauri()) return;
  await invoke("scaffold_remove", { path });
}

/** Rename / move `from` to `to`. */
export async function fsRename(from: string, to: string): Promise<void> {
  if (!isTauri()) return;
  await invoke("scaffold_rename", { from, to });
}

/** Move a directory tree from `from` to `to` (rename with cross-volume fallback). */
export async function fsMoveDir(from: string, to: string): Promise<void> {
  if (!isTauri()) return;
  await invoke("scaffold_move_dir", { from, to });
}
