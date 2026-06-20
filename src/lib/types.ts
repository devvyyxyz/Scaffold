// Shared domain types for the Scaffold app.

/** Visual stack a generated project targets. */
export type ProjectStack = "vite" | "next" | "remix" | "plain";

/** Starter template for the visual canvas. */
export type ProjectTemplate = "landing" | "blog" | "docs" | "blank";

/** A project as stored in the registry + on-disk manifest. */
export interface Project {
  /** Stable opaque id (uuid-ish). */
  id: string;
  name: string;
  stack: ProjectStack;
  template: ProjectTemplate;
  /** Absolute filesystem path to the project folder. */
  path: string;
  createdAt: number;
  updatedAt: number;
  /** ISO timestamp of last edit in the builder; null until first save. */
  lastEditedAt: number | null;
  /** Optional banner image URL for the dashboard card (e.g. "/Scaffold/banner.png"). Defaults to the bundled banner. */
  bannerPath?: string;
  /** Whether the project is archived (moved to archive folder). */
  archived?: boolean;
  /** When the project was archived. */
  archivedAt?: number;
  /** The project path before archiving, so Restore can return it. */
  archivedFrom?: string;
}

/** The `.scaffold/manifest.json` shape written into each project folder. */
export interface ProjectManifest {
  schemaVersion: 1;
  id: string;
  name: string;
  stack: ProjectStack;
  template: ProjectTemplate;
  createdAt: number;
  updatedAt: number;
  /** Pages/routes known to the builder. Empty until the editor adds them. */
  pages: ProjectPage[];
}

export interface ProjectPage {
  id: string;
  /** Route path, e.g. "/", "/about". */
  route: string;
  title: string;
  /** Ordered tree of nested page ids (for nav nesting). */
  children: string[];
}

/** Theme preference stored in settings. */
export type ThemePref = "light" | "dark" | "system";

/** Auto-save interval in seconds. 0 = off. */
export type AutoSaveInterval = 0 | 30 | 60 | 120 | 300;

/** Default canvas zoom level in the editor. */
export type CanvasZoom = "fit" | "75" | "100" | "125" | "150";

/** App-level settings persisted via plugin-store. */
export interface AppSettings {
  /** True until the user completes first-run onboarding. */
  onboarded: boolean;
  /** Default folder for new projects. */
  defaultProjectDir: string | null;
  theme: ThemePref;
  defaultStack: ProjectStack;
  defaultTemplate: ProjectTemplate;
  language: string;
  /** Telemetry opt-in (off by default — local-first). */
  telemetry: boolean;
  /** itch.io short tagline (shown when linking to the project). */
  itchTagline: string;
  /** itch.io long description (game page content). */
  itchDescription: string;

  // ── General ──
  /** Prefix prepended to page titles, e.g. "Scaffold — ". */
  pageTitlePrefix: string;
  /** Default meta description template for new pages. */
  metaDescriptionTemplate: string;
  /** Auto-save interval in seconds (0 = off). */
  autoSaveInterval: AutoSaveInterval;
  /** Show the welcome / getting-started screen on launch. */
  showWelcomeScreen: boolean;

  // ── Layout ──
  /** Sidebar width in px (clamped 200–400). */
  sidebarWidth: number;
  /** Whether the left sidebar is collapsed to an icon-only rail. */
  sidebarCollapsed: boolean;
  /** Dashboard project presentation: grid of cards or a dense list. */
  dashboardView: "grid" | "list";

  // ── Editor ──
  /** Default zoom level for the canvas. */
  canvasZoom: CanvasZoom;
  /** Snap dragged blocks to a grid. */
  snapToGrid: boolean;
  /** Show thin outlines around components on the canvas. */
  showComponentOutlines: boolean;
  /** Default accent colour applied to generated sites. */
  accentColour: string;
  /** Enable CSS transitions/animations in the live preview. */
  enableAnimations: boolean;

  // ── Experimental ──
  /** Unlock the Developer settings tab. */
  developerMode: boolean;

  // ── Developer ──
  /** Enable verbose/debug logging in the frontend. */
  verboseLogging: boolean;
  /** Automatically open DevTools when the app starts. */
  openDevToolsOnStart: boolean;
  /** Rust backend log level. */
  backendLogLevel: "off" | "error" | "warn" | "info" | "debug" | "trace";

  // ── Export ──
  /** Output format for exported code. */
  exportFormat: "clean" | "minified";
  /** Include source maps in exported builds. */
  includeSourceMaps: boolean;
  /** Custom output directory for exports (null = project default). */
  exportOutputDir: string | null;
  /** Auto-open the generated site in the default browser after export. */
  autoOpenAfterExport: boolean;

  // ── Keyboard ──
  /** User-customised keyboard shortcut bindings (keyed by shortcut id). */
  keyboardShortcuts: KeyboardShortcuts;
}

/** A single keyboard shortcut binding. */
export interface KeyboardShortcut {
  id: string;
  /** Logical group for categorising in the overlay. */
  category: "General" | "Navigation" | "Editor" | "Canvas";
  label: string;
  description?: string;
  /** Keys stored as an array of arrays so the UI can render & rebind. e.g. [["Cmd","K"]] */
  keys: string[][];
  /** The default key chord(s) — never mutated, used for reset. */
  defaults: string[][];
}

/** All app-wide keyboard shortcuts, keyed by a stable id. */
export type KeyboardShortcuts = Record<string, KeyboardShortcut>;

export const DEFAULT_KEYBOARD_SHORTCUTS: KeyboardShortcuts = {
  "cmd-palette": {
    id: "cmd-palette",
    category: "General",
    label: "Command palette",
    description: "Search projects, settings, and actions",
    keys: [["Cmd", "K"]],
    defaults: [["Cmd", "K"]],
  },
  "shortcuts-overlay": {
    id: "shortcuts-overlay",
    category: "General",
    label: "Keyboard shortcuts",
    description: "Open this reference overlay",
    keys: [["?"]],
    defaults: [["?"]],
  },
  "toggle-sidebar": {
    id: "toggle-sidebar",
    category: "General",
    label: "Toggle sidebar",
    description: "Collapse or expand the sidebar",
    keys: [["Cmd", "B"]],
    defaults: [["Cmd", "B"]],
  },
  "toggle-theme": {
    id: "toggle-theme",
    category: "General",
    label: "Toggle theme",
    description: "Switch between light and dark",
    keys: [["Cmd", "Shift", "T"]],
    defaults: [["Cmd", "Shift", "T"]],
  },
  "new-project": {
    id: "new-project",
    category: "Navigation",
    label: "New project",
    description: "Start the new-project wizard",
    keys: [["Cmd", "Shift", "N"]],
    defaults: [["Cmd", "Shift", "N"]],
  },
  "go-dashboard": {
    id: "go-dashboard",
    category: "Navigation",
    label: "Go to dashboard",
    description: "Return to the project library",
    keys: [["Cmd", "Shift", "D"]],
    defaults: [["Cmd", "Shift", "D"]],
  },
  "go-settings": {
    id: "go-settings",
    category: "Navigation",
    label: "Go to settings",
    description: "Open the settings page",
    keys: [["Cmd", ","]],
    defaults: [["Cmd", ","]],
  },
  "edit-undo": {
    id: "edit-undo",
    category: "Editor",
    label: "Undo",
    description: "Undo the last edit",
    keys: [["Cmd", "Z"]],
    defaults: [["Cmd", "Z"]],
  },
  "edit-redo": {
    id: "edit-redo",
    category: "Editor",
    label: "Redo",
    description: "Redo the last undone edit",
    keys: [["Cmd", "Shift", "Z"]],
    defaults: [["Cmd", "Shift", "Z"]],
  },
  "edit-save": {
    id: "edit-save",
    category: "Editor",
    label: "Save",
    description: "Save the current project",
    keys: [["Cmd", "S"]],
    defaults: [["Cmd", "S"]],
  },
  "edit-delete": {
    id: "edit-delete",
    category: "Editor",
    label: "Delete selected",
    description: "Delete the selected block on the canvas",
    keys: [["Backspace"], ["Delete"]],
    defaults: [["Backspace"], ["Delete"]],
  },
  "canvas-zoom-in": {
    id: "canvas-zoom-in",
    category: "Canvas",
    label: "Zoom in",
    keys: [["Cmd", "+"]],
    defaults: [["Cmd", "+"]],
  },
  "canvas-zoom-out": {
    id: "canvas-zoom-out",
    category: "Canvas",
    label: "Zoom out",
    keys: [["Cmd", "-"]],
    defaults: [["Cmd", "-"]],
  },
  "canvas-zoom-reset": {
    id: "canvas-zoom-reset",
    category: "Canvas",
    label: "Reset zoom",
    keys: [["Cmd", "0"]],
    defaults: [["Cmd", "0"]],
  },
  "canvas-preview": {
    id: "canvas-preview",
    category: "Canvas",
    label: "Toggle preview",
    description: "Show or hide the live preview",
    keys: [["Cmd", "Shift", "P"]],
    defaults: [["Cmd", "Shift", "P"]],
  },
};

export const DEFAULT_SETTINGS: AppSettings = {
  onboarded: false,
  defaultProjectDir: null,
  theme: "system",
  defaultStack: "vite",
  defaultTemplate: "landing",
  language: "en",
  telemetry: false,
  itchTagline: "A local-first visual site builder — drag, drop, ship.",
  itchDescription: `# Scaffold

A local-first visual React site builder that runs entirely on your desktop.

## What is Scaffold?

Scaffold is a drag-and-drop website builder that generates clean React code. No cloud required, no vendor lock-in — just open the app, pick a template, and start building.

## Features

- **Visual block editor** — Compose pages from pre-built components (Hero, Features, Navbar, Footer, CTA, Testimonial) and reorder them with a click.
- **Multiple stacks** — Export to Vite, Next.js, Remix, or plain HTML. Your code, your framework.
- **Device preview** — Toggle between Desktop, Tablet, and Mobile views to see how your site looks on every screen.
- **Page management** — Add, rename, and organise pages and routes from a built-in panel.
- **Local-first** — Everything lives on your machine. No accounts, no cloud sync, no surprises.
- **Theming** — Light, dark, and system themes with a clean, minimal UI.
- **One-click publish** — Built-in itch.io upload via butler (macOS, Linux, Windows).

## Why Scaffold?

Most site builders lock your work into a proprietary platform. Scaffold gives you a visual editing experience while keeping your source code in a standard project folder — ready to deploy anywhere.

## Status

Scaffold is in early development (v0.1.0). The core builder and project scaffolding work; expect rapid iteration on new blocks, export formats, and publishing workflows.

## Tech Stack

- **Frontend:** React 19 + TypeScript (Vite)
- **Desktop:** Tauri v2 (Rust backend)
- **State:** Zustand
- **Styling:** Custom CSS tokens

---

Made with care. Open source. Local first.`,
  // ── General defaults ──
  pageTitlePrefix: "",
  metaDescriptionTemplate: "{{page}} — Built with Scaffold",
  autoSaveInterval: 60,
  showWelcomeScreen: true,
  // ── Layout defaults ──
  sidebarWidth: 240,
  sidebarCollapsed: false,
  dashboardView: "grid",
  // ── Editor defaults ──
  canvasZoom: "fit",
  snapToGrid: true,
  showComponentOutlines: false,
  accentColour: "#6366f1",
  enableAnimations: true,
  // ── Experimental defaults ──
  developerMode: false,
  // ── Developer defaults ──
  verboseLogging: false,
  openDevToolsOnStart: false,
  backendLogLevel: "info",
  // ── Export defaults ──
  exportFormat: "clean",
  includeSourceMaps: true,
  exportOutputDir: null,
  autoOpenAfterExport: true,
  // ── Keyboard defaults ──
  keyboardShortcuts: DEFAULT_KEYBOARD_SHORTCUTS,
};

/** Settings tab identifiers (mirrors `Section` in Settings.tsx). */
export type SettingsSection =
  | "general"
  | "appearance"
  | "editor"
  | "keyboard"
  | "export"
  | "runtime"
  | "updates"
  | "itchio"
  | "developer"
  | "about";

/** A minimal client-side route descriptor for the state-based router. */
export type Route =
  | { name: "onboarding" }
  | { name: "dashboard" }
  | { name: "new-project" }
  | { name: "editor"; projectId: string }
  | { name: "publish"; projectId: string }
  | { name: "settings"; section?: SettingsSection }
  | { name: "archive" }
  | { name: "deployment-manager" }
  | { name: "plugins" };
