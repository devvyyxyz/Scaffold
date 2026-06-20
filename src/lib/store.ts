// Global app store (Zustand).
//
// Holds persisted settings + navigation state, and applies theme side-effects
// to the document. The store is the single source of truth for "where am I"
// and "what does the user prefer"; project data lives in lib/projects.ts.

import { create } from "zustand";
import { load } from "@tauri-apps/plugin-store";
import {
  AppSettings,
  DEFAULT_SETTINGS,
  DEFAULT_KEYBOARD_SHORTCUTS,
  KeyboardShortcuts,
  Project,
  Route,
  ThemePref,
} from "./types";
import { isTauri, isOnboardingWindow, showOnboardingWindow } from "./ipc";
import { purgeExpiredArchives, unloadProject } from "./projects";

const STORE_FILE = "settings.json";

/** Sidebar resize bounds (px). */
export const SIDEBAR_MIN = 200;
export const SIDEBAR_MAX = 400;
/** Width used when the sidebar is collapsed (icon-only rail). */
export const SIDEBAR_COLLAPSED_WIDTH = 64;

/** Resolve a theme pref to the concrete theme to apply to <html>. */
function resolveTheme(pref: ThemePref): "light" | "dark" {
  if (pref === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return pref;
}

/** Apply the resolved theme attribute to the document root. */
export function applyTheme(pref: ThemePref): void {
  const resolved = resolveTheme(pref);
  document.documentElement.setAttribute("data-theme", resolved);
}

interface AppState {
  // ---- bootstrap ----
  ready: boolean;
  /** True on first launch until onboarding completes. */
  needsOnboarding: boolean;

  // ---- persisted settings ----
  settings: AppSettings;

  // ---- ephemeral navigation ----
  route: Route;
  /** Cached list of projects from the registry. */
  projects: Project[];

  // ---- current project (single-load guarantee) ----
  /** The id of the currently-loaded project, or null when no project is open.
   *  Set automatically by `navigate` when entering/leaving the editor. */
  currentProjectId: string | null;

  // ---- actions ----
  init: () => Promise<void>;
  navigate: (route: Route) => Promise<void>;
  setTheme: (pref: ThemePref) => Promise<void>;
  setDefaultProjectDir: (dir: string | null) => Promise<void>;
  completeOnboarding: (dir: string, theme: ThemePref, extra?: Partial<AppSettings>) => Promise<void>;
  resetOnboarding: () => Promise<void>;
  setProjects: (projects: Project[]) => void;
  upsertProject: (project: Project) => void;
  setSidebarWidth: (px: number) => Promise<void>;
  toggleSidebar: () => Promise<void>;
  setDashboardView: (view: "grid" | "list") => Promise<void>;
  setKeyboardShortcuts: (shortcuts: KeyboardShortcuts) => Promise<void>;
  /** Replace the current project id without side-effects (used by Editor after
   *  the project is actually loaded). Callers should normally use `navigate`. */
  _setCurrentProjectId: (id: string | null) => void;
}

async function readStore() {
  if (!isTauri()) return null;
  return await load(STORE_FILE, { autoSave: false, defaults: {} });
}

/**
 * Merge saved shortcut bindings over the built-in defaults.
 *
 * Metadata (label, description, category, defaults) always comes from
 * DEFAULT_KEYBOARD_SHORTCUTS so stale entries from an older version can't
 * outlive a schema change; only the user's customised `keys` are kept.
 * Newly-added shortcuts (absent from the saved blob) fall through to defaults.
 */
function mergeKeyboardShortcuts(
  saved: Partial<KeyboardShortcuts> | undefined,
): KeyboardShortcuts {
  const merged: KeyboardShortcuts = {};
  for (const [id, def] of Object.entries(DEFAULT_KEYBOARD_SHORTCUTS)) {
    const s = saved?.[id];
    merged[id] = {
      ...def,
      keys: Array.isArray(s?.keys) && s!.keys.length
        ? s!.keys.map((c) => [...c])
        : def.keys.map((c) => [...c]),
    };
  }
  return merged;
}

async function loadSettings(): Promise<AppSettings> {
  try {
    const store = await readStore();
    if (!store) return { ...DEFAULT_SETTINGS };
    const saved = (await store.get<Partial<AppSettings>>("settings")) ?? {};
    return {
      ...DEFAULT_SETTINGS,
      ...saved,
      keyboardShortcuts: mergeKeyboardShortcuts(saved.keyboardShortcuts),
    };
  } catch {
    // If the store plugin is unavailable (e.g., permission denied in a
    // sub-window before capabilities are updated), fall back to defaults
    // so the app doesn't hang on the boot screen forever.
    return { ...DEFAULT_SETTINGS };
  }
}

async function saveSettings(settings: AppSettings): Promise<void> {
  try {
    const store = await readStore();
    if (!store) return;
    await store.set("settings", settings);
    await store.save();
  } catch {
    // Silently ignore — settings are in-memory until the next save.
  }
}

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  needsOnboarding: true,
  settings: { ...DEFAULT_SETTINGS },
  route: { name: "onboarding" },
  projects: [],
  currentProjectId: null,

  async init() {
    const settings = await loadSettings();
    applyTheme(settings.theme);

    // Purge archived projects older than the retention window before the
    // dashboard renders. Best-effort; never blocks startup.
    await purgeExpiredArchives();

    const needsOnboarding = !settings.onboarded;
    const onboardingWin = isOnboardingWindow();

    if (needsOnboarding && !onboardingWin) {
      // Main window: onboarding is needed → show the onboarding window
      set({
        settings,
        needsOnboarding: true,
        route: { name: "dashboard" },
        ready: true,
      });
      showOnboardingWindow();
    } else {
      // Either onboarding is complete, or this IS the onboarding window.
      set({
        settings,
        needsOnboarding,
        route: needsOnboarding && onboardingWin
          ? { name: "onboarding" }
          : settings.onboarded
            ? { name: "dashboard" }
            : { name: "dashboard" },
        ready: true,
      });
    }
  },

  async navigate(route) {
    const prev = get().route;

    // If we're navigating away from the editor (or switching to a different
    // project in the editor), unload the current project first.
    if (prev.name === "editor") {
      const nextIsDifferentEditor =
        route.name === "editor" && route.projectId !== prev.projectId;
      const leavingEditor = route.name !== "editor";
      if (nextIsDifferentEditor || leavingEditor) {
        await unloadProject(prev.projectId);
        set({ currentProjectId: null });
      }
    }

    // Set the new current project id *before* setting the route so the Editor
    // component sees the new id in its effect.
    if (route.name === "editor") {
      set({ currentProjectId: route.projectId });
    }

    set({ route });
  },

  async setTheme(pref) {
    const settings = { ...get().settings, theme: pref };
    applyTheme(pref);
    set({ settings });
    await saveSettings(settings);
  },

  async setDefaultProjectDir(dir) {
    const settings = { ...get().settings, defaultProjectDir: dir };
    set({ settings });
    await saveSettings(settings);
  },

  async completeOnboarding(dir, theme, extra) {
    const settings: AppSettings = {
      ...get().settings,
      ...extra,
      onboarded: true,
      defaultProjectDir: dir,
      theme,
    };
    applyTheme(theme);
    set({ settings, needsOnboarding: false, route: { name: "dashboard" } });
    await saveSettings(settings);
  },

  async resetOnboarding() {
    const settings: AppSettings = { ...get().settings, onboarded: false };
    set({ settings, needsOnboarding: true, route: { name: "onboarding" } });
    await saveSettings(settings);
    // Open the onboarding window if we're in the main window.
    if (!isOnboardingWindow()) {
      showOnboardingWindow();
    }
  },

  setProjects(projects) {
    set({ projects });
  },

  upsertProject(project) {
    const existing = get().projects;
    const idx = existing.findIndex((p) => p.id === project.id);
    const next =
      idx >= 0
        ? existing.map((p) => (p.id === project.id ? project : p))
        : [project, ...existing];
    set({ projects: next });
  },

  async setSidebarWidth(px) {
    const clamped = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, Math.round(px)));
    const settings = { ...get().settings, sidebarWidth: clamped };
    set({ settings });
    await saveSettings(settings);
  },

  async toggleSidebar() {
    const settings = { ...get().settings, sidebarCollapsed: !get().settings.sidebarCollapsed };
    set({ settings });
    await saveSettings(settings);
  },

  async setDashboardView(view) {
    const settings = { ...get().settings, dashboardView: view };
    set({ settings });
    await saveSettings(settings);
  },

  async setKeyboardShortcuts(keyboardShortcuts) {
    const settings = { ...get().settings, keyboardShortcuts };
    set({ settings });
    await saveSettings(settings);
  },

  _setCurrentProjectId(id) {
    set({ currentProjectId: id });
  },
}));

// Keep the resolved theme in sync with the OS when pref is "system".
if (typeof window !== "undefined") {
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      const { settings } = useAppStore.getState();
      if (settings.theme === "system") applyTheme("system");
    });
}