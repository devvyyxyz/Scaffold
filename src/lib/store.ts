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
  Project,
  Route,
  ThemePref,
} from "./types";
import { isTauri, isOnboardingWindow, showOnboardingWindow } from "./ipc";

const STORE_FILE = "settings.json";

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

  // ---- actions ----
  init: () => Promise<void>;
  navigate: (route: Route) => void;
  setTheme: (pref: ThemePref) => Promise<void>;
  setDefaultProjectDir: (dir: string | null) => Promise<void>;
  completeOnboarding: (dir: string, theme: ThemePref, extra?: Partial<AppSettings>) => Promise<void>;
  resetOnboarding: () => Promise<void>;
  setProjects: (projects: Project[]) => void;
  upsertProject: (project: Project) => void;
}

async function readStore() {
  if (!isTauri()) return null;
  return await load(STORE_FILE, { autoSave: false });
}

async function loadSettings(): Promise<AppSettings> {
  try {
    const store = await readStore();
    if (!store) return { ...DEFAULT_SETTINGS };
    const saved = (await store.get<Partial<AppSettings>>("settings")) ?? {};
    return { ...DEFAULT_SETTINGS, ...saved };
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

  async init() {
    const settings = await loadSettings();
    applyTheme(settings.theme);
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

  navigate(route) {
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
