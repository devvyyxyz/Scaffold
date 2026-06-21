// Window state persistence — saves and restores the main window's geometry
// (size, position, maximized, fullscreen) across app launches.
//
// State is stored in `window-state.json` inside the Tauri app-data directory,
// completely separate from the settings file for clean separation of concerns.

import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize, LogicalPosition } from "@tauri-apps/api/dpi";
import { appLocalDataDir } from "@tauri-apps/api/path";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { isTauri, fsReadTextFile, fsWriteTextFile, fsRemove } from "./ipc";
import type { WindowState } from "./types";
import { useAppStore } from "./store";

const WINDOW_STATE_FILE = "window-state.json";
let WINDOW_STATE_PATH: string | null = null;

/** Debounce delay (ms) for writing window state during resize drags. */
const SAVE_DEBOUNCE_MS = 300;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

async function getWindowStatePath(): Promise<string> {
  if (!WINDOW_STATE_PATH) {
    const dir = await appLocalDataDir();
    const normalized = dir.endsWith("/") ? dir : dir + "/";
    WINDOW_STATE_PATH = normalized + WINDOW_STATE_FILE;
  }
  return WINDOW_STATE_PATH;
}

/** Read the persisted window state, or null if none exists. */
async function readWindowState(): Promise<WindowState | null> {
  try {
    const path = await getWindowStatePath();
    const json = await fsReadTextFile(path);
    if (json) return JSON.parse(json) as WindowState;
  } catch {
    // File doesn't exist yet or is corrupt — that's fine.
  }
  return null;
}

/** Write window state to disk (best-effort). */
async function writeWindowState(state: WindowState): Promise<void> {
  try {
    const path = await getWindowStatePath();
    await fsWriteTextFile(path, JSON.stringify(state, null, 2));
  } catch (error) {
    console.error("Failed to save window state:", error);
  }
}

/** Debounced save of the current window state. */
function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void saveCurrentState(), SAVE_DEBOUNCE_MS);
}

/** Read the current window geometry and persist it. */
async function saveCurrentState(): Promise<void> {
  if (!isTauri()) return;

  // Respect the user's preference at the time of saving.
  const { rememberWindowState } = useAppStore.getState().settings;
  if (!rememberWindowState) return;

  try {
    const win = getCurrentWindow();
    const maximized = await win.isMaximized();
    const fullscreen = await win.isFullscreen();

    // When maximized or fullscreen, only save the flag — not the tiny
    // underlying size/position which would be the pre-maximize values.
    if (maximized || fullscreen) {
      await writeWindowState({ maximized, fullscreen });
      return;
    }

    const size = await win.innerSize();
    const pos = await win.outerPosition();

    await writeWindowState({
      x: pos.x,
      y: pos.y,
      width: size.width,
      height: size.height,
      maximized: false,
      fullscreen: false,
    });
  } catch (error) {
    console.error("Failed to capture window state:", error);
  }
}

/**
 * Restore the main window's geometry from the persisted state file.
 *
 * If `enabled` is false, the saved state file is deleted so the window
 * reverts to the defaults from tauri.conf.json on the next launch.
 *
 * Called early during `init()` — before the onboarding window decision — so
 * the window is already in the right place when it becomes visible.
 */
export async function restoreMainWindowState(enabled: boolean): Promise<void> {
  if (!isTauri()) return;

  try {
    const win = getCurrentWindow();

    if (!enabled) {
      // User opted out — delete any stale state and reset to defaults.
      try {
        const path = await getWindowStatePath();
        await fsRemove(path);
      } catch {
        // File may not exist; that's fine.
      }
      return;
    }

    const state = await readWindowState();
    if (!state) return;

    // Restore fullscreen first (takes priority over maximized).
    if (state.fullscreen) {
      await win.setFullscreen(true);
      return;
    }

    // Restore maximized state.
    if (state.maximized) {
      await win.maximize();
      return;
    }

    // Restore size and position. Clamp to the window's declared minimums
    // (900×600 for the main window) so we never create an unusable window.
    const MIN_W = 900;
    const MIN_H = 600;
    const w = Math.max(MIN_W, state.width ?? 1280);
    const h = Math.max(MIN_H, state.height ?? 800);
    await win.setSize(new LogicalSize(w, h));

    if (state.x != null && state.y != null) {
      await win.setPosition(new LogicalPosition(state.x, state.y));
    }
  } catch (error) {
    console.error("Failed to restore window state:", error);
  }
}

/**
 * Start listening to window geometry events (resize, move) and persisting
 * them. Called once from App.tsx after the store is ready and settings are
 * loaded.
 *
 * Tauri v2 doesn't expose `onMaximizedChanged`/`onFullscreenChanged`, so we
 * hook into `onResized` and `onMoved` which cover all geometry changes
 * including those triggered by the window manager (e.g. double-clicking the
 * title bar to maximize).
 *
 * Returns a cleanup function that stops all listeners.
 */
export function startWindowStateTracking(): () => void {
  if (!isTauri()) return () => {};

  const win = getCurrentWindow();
  const unlisteners: UnlistenFn[] = [];

  // onResized fires on every size change (drag resize, maximize, fullscreen,
  // etc.) and also when the window is restored from maximized/fullscreen.
  win.onResized(() => {
    // Use a non-debounced save on resize so we capture maximized/fullscreen
    // transitions immediately (they fire as a single resize event).
    void saveCurrentState();
  });

  // onMoved fires when the user drags the window. Debounce to avoid
  // excessive writes during the drag.
  win.onMoved(() => scheduleSave());

  // Also save the initial state once after a short delay so the first
  // launch writes a baseline.
  setTimeout(() => void saveCurrentState(), 1000);

  return () => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    // Clean up all event listeners.
    for (const fn of unlisteners) void fn();
  };
}

/** Delete the persisted window state file. Used when the user disables
 *  the "Remember window size & position" setting. */
export async function clearWindowState(): Promise<void> {
  if (!isTauri()) return;
  try {
    const path = await getWindowStatePath();
    await fsRemove(path);
  } catch {
    // File may not exist; that's fine.
  }
}
