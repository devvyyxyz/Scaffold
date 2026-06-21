// IPC helpers — typed wrappers around Tauri invoke + plugin APIs.
//
// Everything that crosses the Rust<->JS boundary goes through here so the
// call sites stay clean and we have one place to add error mapping.
//
// Filesystem operations use custom Rust commands (scaffold_*) instead of the
// @tauri-apps/plugin-fs to avoid Tauri v2 scope restrictions that block
// access to arbitrary user directories.

import { invoke } from "@tauri-apps/api/core";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { getVersion } from "@tauri-apps/api/app";
import { open as openWithShell } from "@tauri-apps/plugin-shell";

/** Whether we're running inside the Tauri webview (vs. a plain browser). */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Whether this window is the onboarding window (detected via URL param). */
export function isOnboardingWindow(): boolean {
  return new URLSearchParams(window.location.search).get("window") === "onboarding";
}

/** Whether this window is the documentation window (detected via URL param). */
export function isDocsWindow(): boolean {
  return new URLSearchParams(window.location.search).get("window") === "docs";
}

/** Whether this window is the projects window (detected via URL param). */
export function isProjectsWindow(): boolean {
  return new URLSearchParams(window.location.search).get("window") === "projects";
}

/** Whether this window is an editor window (detected via URL param). */
export function isEditorWindow(): boolean {
  return new URLSearchParams(window.location.search).get("window") === "editor";
}

/** Extract the projectId from the URL query params (used by editor windows). */
export function getProjectIdFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get("projectId");
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

/** Show the projects window and hide the main window. */
export async function showProjectsWindow(): Promise<void> {
  if (!isTauri()) return;
  await invoke("show_projects_window");
}

/** Close the projects window and show the main window. */
export async function closeProjectsWindow(): Promise<void> {
  if (!isTauri()) return;
  await invoke("close_projects_window");
}

/**
 * Open an external URL (https/mailto/etc.) in the user's default browser.
 *
 * Uses the shell plugin's `open()`, which dispatches to the OS default
 * handler (`open` on macOS, `start` on Windows, `xdg-open` on Linux) rather
 * than spawning a named CLI — so it's cross-platform and not subject to the
 * shell scope restrictions that block `Command.create("open", ...)`.
 * Falls back to a browser tab when running outside Tauri (dev mode).
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (!isTauri()) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  await openWithShell(url);
}

/**
 * Reveal a file or folder in the OS file manager (Finder / Explorer / the
 * desktop environment's file manager). Like {@link openExternalUrl} this goes
 * through the shell plugin's `open()`, which the `tauri.conf.json` shell scope
 * permits for local paths. Falls back to a no-op outside Tauri.
 */
export async function revealPath(path: string): Promise<void> {
  if (!isTauri()) return;
  await openWithShell(path);
}

/** Open the documentation window (a separate native window). Creates it if it
 *  doesn't exist, otherwise focuses the existing one. Falls back to a popup
 *  tab when running in a plain browser (dev mode). */
export async function openDocsWindow(): Promise<void> {
  if (!isTauri()) {
    // Browser fallback: open docs in a new tab or popup so dev tests work.
    const url = `${window.location.origin}${window.location.pathname}?window=docs`;
    window.open(url, "scaffold-docs", "width=1000,height=720");
    return;
  }

  // If a docs window already exists, just focus it rather than spawning a dupe.
  const existing = await WebviewWindow.getByLabel("docs");
  if (existing) {
    try {
      await existing.setFocus();
      await existing.show();
    } catch {
      // Focus can race on some platforms; creation below is a safe fallback.
    }
    return;
  }

  try {
    const win = new WebviewWindow("docs", {
      url: "/?window=docs",
      title: "Scaffold Documentation",
      width: 1000,
      height: 720,
      minWidth: 720,
      minHeight: 560,
      resizable: true,
      center: true,
      decorations: true,
    });

    // Listen for window-creation errors (Tauri v2 doesn't throw from the
    // constructor; errors are emitted on the window object).
    win.once("tauri://error", (e) => {
      console.error("Docs window creation failed:", e);
    });
  } catch (e) {
    console.error("Docs window creation threw:", e);
  }
}

/** Open a project in a new native window. If a window for this project already
 *  exists, focuses it. Falls back to a browser popup in dev mode. */
export async function openEditorWindow(
  projectId: string,
  projectName: string,
): Promise<void> {
  if (!isTauri()) {
    const url = `${window.location.origin}${window.location.pathname}?window=editor&projectId=${projectId}`;
    window.open(url, `scaffold-editor-${projectId}`, "width=1280,height=800");
    return;
  }

  const label = `editor-${projectId}`;

  // If an editor window for this project already exists, just focus it.
  const existing = await WebviewWindow.getByLabel(label);
  if (existing) {
    try {
      await existing.setFocus();
      await existing.show();
    } catch {
      // Focus can race on some platforms; creation below is a safe fallback.
    }
    return;
  }

  try {
    const win = new WebviewWindow(label, {
      url: `/?window=editor&projectId=${projectId}`,
      title: `${projectName} — Scaffold`,
      width: 1280,
      height: 800,
      minWidth: 900,
      minHeight: 600,
      resizable: true,
      center: true,
      decorations: true,
    });

    win.once("tauri://error", (e) => {
      console.error("Editor window creation failed:", e);
    });
  } catch (e) {
    console.error("Editor window creation threw:", e);
  }
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

/** Recursively copy a directory tree from `from` to `to`, leaving the source intact. */
export async function fsCopyDir(from: string, to: string): Promise<void> {
  if (!isTauri()) return;
  await invoke("scaffold_copy_dir", { from, to });
}

/** Get the current app version from the Tauri app metadata. */
export async function getAppVersion(): Promise<string> {
  if (!isTauri()) return "0.2.0";
  try {
    return await getVersion();
  } catch {
    return "0.2.0";
  }
}

