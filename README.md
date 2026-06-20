# Scaffold

> A local-first visual React site builder that runs entirely on your desktop. Drag, drop, ship.

Scaffold is a desktop application that lets you compose React websites visually — from pre-built blocks — and export clean, framework-ready code. No cloud, no accounts, no vendor lock-in: every project lives in a standard folder on your machine, ready to deploy anywhere.

---

## ✨ Features

- **Visual block editor** — Compose pages from pre-built components (Hero, Features, Navbar, Footer, CTA, Testimonial) and reorder them with a click.
- **Multiple stacks** — Export to **Vite**, **Next.js**, **Remix**, or **plain HTML**. Your code, your framework.
- **Device preview** — Toggle between Desktop, Tablet, and Mobile to see how your site looks on every screen.
- **Page management** — Add, rename, and organise pages and routes from a built-in panel.
- **Local-first** — Everything lives on your machine. No accounts, no cloud sync, no surprises.
- **Theming** — Light, dark, and system themes with a clean, minimal UI.
- **One-click publish** — Built-in itch.io upload via [butler](https://itch.io/docs/butler/) (macOS, Linux, Windows).
- **Command palette** — Press `⌘/Ctrl + K` to jump anywhere in the app.

---

## 🧱 Tech Stack

| Layer      | Technology                       |
| ---------- | -------------------------------- |
| Frontend   | React 19 + TypeScript (Vite)     |
| Desktop    | Tauri v2 (Rust backend)          |
| State      | Zustand                          |
| Styling    | Custom CSS design tokens         |

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS)
- [pnpm](https://pnpm.io/)
- [Rust](https://www.rust-lang.org/) toolchain (for the Tauri backend)
- Platform build dependencies ([Tauri prerequisites](https://tauri.app/start/prerequisites/))

### Install & run

```bash
# install frontend dependencies
pnpm install

# run the full desktop app in development
pnpm tauri:dev

# build a production bundle for your OS
pnpm tauri:build
```

The dev app is served at `http://localhost:1420` and wrapped by the Tauri window.

### Scripts

| Script                | Description                                      |
| --------------------- | ------------------------------------------------ |
| `pnpm dev`            | Start the Vite dev server (frontend only)        |
| `pnpm build`          | Type-check and build the frontend                |
| `pnpm tauri:dev`      | Run the desktop app in development               |
| `pnpm tauri:build`    | Produce a production build / installer           |
| `pnpm itch:upload`    | Upload builds to itch.io via butler              |

---

## 🏗️ Architecture

Scaffold is a Tauri v2 app: a React frontend talks to a small Rust backend over IPC.

```
┌─────────────────────────────────────────────┐
│  Frontend  (React 19 + Vite + Zustand)      │
│  src/screens  ·  src/components  ·  src/lib │
└──────────────────────┬──────────────────────┘
                       │  Tauri IPC commands
┌──────────────────────┴──────────────────────┐
│  Backend  (src-tauri/src/lib.rs)            │
│  Filesystem ops · window management         │
└─────────────────────────────────────────────┘
```

- **State & routing** — A client-side router in [src/lib/store.ts](src/lib/store.ts) drives which screen is rendered in [src/App.tsx](src/App.tsx).
- **Project model** — Projects are tracked in a registry plus an on-disk `.scaffold/manifest.json` per project. See [src/lib/types.ts](src/lib/types.ts) for the full schema.
- **Filesystem** — Rather than Tauri's scoped `fs` plugin (which can't reach arbitrary user folders like `~/Documents/Scaffold-projects`), Scaffold exposes custom IPC commands (`scaffold_mkdir`, `scaffold_write_text_file`, `scaffold_move_dir`, …) in [src-tauri/src/lib.rs](src-tauri/src/lib.rs) for unrestricted local access.
- **Windows** — Three Tauri windows: `main`, `onboarding`, and `docs`. The frontend decides which to show based on settings and first-run state.

### Project layout

```
src/
├── App.tsx              # Root: routing + window selection + command palette
├── components/
│   ├── shell/           # AppShell, Sidebar, TopBar, BootScreen
│   ├── ui/              # Field, Icon, Setting, EmptyState
│   └── CommandPalette/  # Cmd/Ctrl-K palette
├── screens/             # Dashboard, Editor, Publish, Settings, Archive, …
└── lib/
    ├── store.ts         # Zustand app store + router
    ├── types.ts         # Shared domain types & default settings
    ├── projects.ts      # Project registry / manifest I/O
    ├── ipc.ts           # Tauri command wrappers
    └── paths.ts         # Local path helpers
src-tauri/
└── src/lib.rs           # Rust IPC commands + window management
scripts/
├── upload-itch.sh       # butler upload to itch.io
└── gen_icons.py         # Regenerate app icons
```

---

## 📦 Publishing to itch.io

Builds can be pushed to itch.io with [butler](https://itch.io/docs/butler/).

```bash
# 1. install & authenticate butler
brew install butler        # macOS
butler login

# 2. set your itch.io target (or rely on the defaults below)
export ITCH_USER=your-username
export ITCH_GAME=scaffold

# 3. build and upload
pnpm tauri:build
pnpm itch:upload           # or: itch:mac · itch:linux · itch:windows · itch:all
```

Defaults: `ITCH_USER=Devvyyxyz`, `ITCH_GAME=scaffold`. See [scripts/upload-itch.sh](scripts/upload-itch.sh) for details.

---

## ⚙️ Configuration

App settings are persisted locally via Tauri's store plugin and exposed in the in-app **Settings** screen — theme, default stack/template, auto-save, canvas behaviour, export options, developer flags, and more. The complete list of keys and their defaults lives in [src/lib/types.ts](src/lib/types.ts) (`AppSettings` / `DEFAULT_SETTINGS`).

---

## 📋 Status

Scaffold is in early development (**v0.2.0**). The core builder and project scaffolding work; expect rapid iteration on new blocks, export formats, and publishing workflows.

---

## 🤝 Contributing

Contributions are welcome. Please open an issue first to discuss significant changes, and keep PRs focused.

---

*Made with care. Local first.*
