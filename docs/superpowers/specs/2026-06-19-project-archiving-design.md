# Project Archiving — Design

**Date:** 2026-06-19
**Status:** Approved (pending spec review)

## Summary

Allow users to "delete" a project from the Dashboard. Instead of permanently
removing files, the project is **moved to a dedicated archive folder** on disk
and hidden from the active project list. An **Archive tab** in the left sidebar
lists archived projects, each with a countdown to automatic permanent deletion.
Archived projects are **purged 30 days after they were archived**, checked each
time the app starts. Users can **Restore** a project or **Delete forever** at any
time.

## Goals & Non-Goals

**Goals**
- "Delete" from a project card moves the folder into an archive location
  (reversible within 30 days).
- Archive is visible as a tab in the left sidebar with a count of items.
- Auto-purge archived projects older than 30 days, triggered on app startup.
- Restore returns a project to its original location.
- Delete forever permanently removes files + registry entry.

**Non-Goals**
- No background daemon / scheduler (local-first: purge runs at startup only).
- No cloud sync of the archive.
- No retention settings (30 days is fixed for v1).
- No undo beyond Restore (Delete forever is irreversible).

## Current State (what exists)

The feature is partially scaffolded but incomplete and broken:

- `src/lib/types.ts` — `Project` already has `archived?: boolean` and
  `archivedAt?: number`. A `Route` variant `{ name: "archive" }` is defined.
- `src/lib/projects.ts` — `archiveProject(id)`, `restoreProject(id)`, and
  `permanentlyDeleteProject(id)` exist, but they **only flip a registry flag**.
  They do **not** move files on disk, which the user's request ("gets moved to
  archive folder") requires.
- `src/screens/Dashboard.tsx` — the `ProjectCard` contains broken code:
  `Scaffold.store.removeProject(...)` references a global that does not exist.
- The router (`src/App.tsx`) does not handle `route.name === "archive"`.
- No `Archive` screen exists.
- The `Sidebar` has no Archive entry.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Auto-delete trigger | Purge on startup | Local-first apps cannot rely on a background daemon; startup sweep is reliable and standard. |
| Archive location | `~/Documents/Scaffold-archive` | Sibling of the default project dir; same volume → fast, atomic `rename`; predictable single location. |
| Archive actions | Restore + Delete forever | Lets users recover mistakes within the 30-day window; gives explicit control over irrevocable deletion. |
| Confirmation UI | Themed modal (not native OS dialog) | Matches app design tokens; consistent across platforms. |

## Data Model

### `Project` (`src/lib/types.ts`)

Already present:
- `archived?: boolean`
- `archivedAt?: number`

**Added:**
- `archivedFrom?: string` — the project's filesystem path **before** it was
  archived, so Restore can return it to its original location. Cleared on
  Restore.

`Route` already includes `{ name: "archive" }`. No other type changes.

## Paths

### `archiveDir()` (`src/lib/paths.ts`)

Returns the archive root:

- **Tauri:** `join(dirname(defaultProjectDir), "Scaffold-archive")` — i.e.
  `~/Documents/Scaffold-archive` (sibling of `~/Documents/Scaffold-projects`).
- **Browser fallback:** `/tmp/Scaffold-archive`.

Computed relative to `defaultProjectDir()` so it always tracks wherever the
user's projects live.

## Project Operations (`src/lib/projects.ts`)

All three existing stubs are rewritten to perform real filesystem work. A new
`purgeExpiredArchives` is added. `listProjects` is unchanged (returns all
entries; callers filter by `archived`).

### `archiveProject(id: string): Promise<void>`

1. Load registry, find project by id. Throw if not found.
2. Resolve destination `archiveDir()`.
3. Ensure archive dir exists (`fsMkdir`).
4. Compute dest folder name = `basename(project.path)`. If a folder with that
   name already exists in the archive, append `-<shortid>` to avoid collision.
5. Move the project folder to the destination (see Backend).
6. **Only on success:** update the registry entry —
   `archivedFrom = project.path`, `path = destination`,
   `archived = true`, `archivedAt = Date.now()` — and save.
   If the move fails, the entry is left untouched (no data loss).

### `restoreProject(id: string): Promise<void>`

1. Load registry, find project. Throw if not archived.
2. `target = project.archivedFrom`. If empty/missing, fall back to
   `join(defaultProjectDir(), basename(project.path))`.
3. Ensure target parent exists (`fsMkdir` on the parent).
4. If `target` already exists (e.g. another project took the slot), append
   `-<shortid>` to avoid collision.
5. Move folder back to target.
6. Update entry: `path = target`, clear `archived`, `archivedAt`, `archivedFrom`.

### `permanentlyDeleteProject(id: string): Promise<void>`

1. Load registry, find project.
2. `fsRemove(project.path)` (best-effort — ignore failure; registry is the
   source of truth).
3. Drop entry from registry; save.

### `purgeExpiredArchives(): Promise<number>` (new)

1. Load registry.
2. For each entry where `archived && (Date.now() - archivedAt) > RETENTION_MS`:
   - `fsRemove(project.path)`.
   - Remove from registry.
3. Save registry if anything changed. Return count purged (for logging).

Constant: `ARCHIVE_RETENTION_DAYS = 30`;
`RETENTION_MS = ARCHIVE_RETENTION_DAYS * 24 * 60 * 60 * 1000`.

## Backend (`src-tauri/src/lib.rs`)

Add a `scaffold_move_dir(from, to)` command:

1. `fs::rename(from, to)`.
2. On error (commonly a cross-device `ErrorKind::CrossesDevices`), fall back to
   recursive `fs::copy` of the tree then `fs::remove_dir_all(from)`.

This supersedes the bare `scaffold_rename` for project moves because the latter
fails across volumes. `scaffold_rename` is left in place for other uses.

Register `scaffold_move_dir` in `invoke_handler`.

### `ipc.ts`

Add `fsMoveDir(from, to)` wrapping `invoke("scaffold_move_dir", { from, to })`
with the usual `isTauri()` guard. `archiveProject`/`restoreProject` use it.

## Startup Purge (`src/lib/store.ts`)

In `init()`, after settings are loaded and **before** rendering the dashboard,
call `purgeExpiredArchives()`. Wrap in try/catch and log only — never block or
crash startup on a purge failure.

## UI

### Sidebar (`src/components/shell/Sidebar.tsx`)

Add an "Archive" nav entry between "Projects" and "Settings":

- Icon: `archive`.
- Matches `route.name === "archive"`.
- Small count badge showing the number of archived projects
  (`projects.filter(p => p.archived).length`), hidden when 0.

The "Recent" list already filters by recency; it should also exclude archived
projects (`!p.archived`).

### Dashboard (`src/screens/Dashboard.tsx`)

- Active list: `projects.filter(p => !p.archived)`.
- Fix the broken `ProjectCard` — remove the `Scaffold.store.removeProject(...)`
  call and the misnamed "Action" button.
- Add an **Archive** button (ghost, small) on each card. On click → confirm
  dialog → on confirm, `archiveProject(p.id)` → refresh `projects`.

### New screen `src/screens/Archive.tsx`

- Header: title "Archive", subtitle noting 30-day auto-delete.
- A **list** layout (denser than the Dashboard grid — these are trash items).
- Each row: project name, stack badge, original location (`archivedFrom`),
  countdown ("Deletes in 12 days" / "Deletes today"), and two actions:
  - **Restore** → confirm → `restoreProject` → refresh + navigate to Dashboard.
  - **Delete forever** → confirm (stronger wording) → `permanentlyDeleteProject`
    → refresh.
- Empty state when no archived projects (reuse the `EmptyState` component with
  an appropriate icon/copy).

### Router (`src/App.tsx`)

Add `case "archive": return <Archive />;` to `renderRoute`.

### Confirm dialog (`src/components/ui/ConfirmDialog.tsx`)

Reusable themed modal. Props:
- `open: boolean`
- `title: string`
- `message: ReactNode`
- `confirmLabel: string`
- `cancelLabel?: string` (default "Cancel")
- `tone?: "default" | "danger"` — danger renders the confirm button with a
  destructive style (red/accent).
- `onConfirm: () => Promise<void> | void`
- `onCancel: () => void`

Handles async confirm, loading state, and an error message slot. Built with
existing design tokens (overlay backdrop, centered card, Button components).
Matches the visual language of the rest of the app.

### Icons (`src/components/ui/Icon.tsx`)

Add two entries to `IconName` and `PATHS`:
- `archive` — a box with a line near the top and a downward arrow
  (standard "archive/trash-to-archive" glyph).
- `trash` — a wastebasket.

### Styles

- `src/screens/screens.css` — add `.archiveList` and `.archiveRow` styles
  (row layout, hover, action buttons) plus a countdown pill style.
- `src/components/ui/ConfirmDialog.css` — overlay + modal card.

## Error Handling

- A move failure (permission, cross-volume even after fallback) throws from
  `archiveProject`/`restoreProject`. The UI catches it and surfaces it in the
  confirm dialog's error slot (or a toast). **The registry entry is never
  updated on failure**, so there is no data loss and no inconsistent state.
- `purgeExpiredArchives` failures are swallowed and logged — they must never
  block app startup.
- `permanentlyDeleteProject` ignores filesystem errors (the registry entry is
  removed regardless) so a missing folder doesn't trap the user.

## Testing

Manual verification:
1. Create a project → archive → confirm folder moved to `Scaffold-archive`,
   Dashboard updates, Archive tab shows the item with a countdown.
2. Restore → confirm folder returned to original location, Dashboard shows it
   again.
3. Archive again → manually edit `archivedAt` to 31 days ago (or temporarily
   set `ARCHIVE_RETENTION_DAYS = 0`) → restart app → confirm item is purged.
4. Delete forever → confirm folder gone, registry entry gone.

Automated gate: `pnpm build` (`tsc -b && vite build`) must pass with no type
errors after the changes.

## Out of Scope / Future

- Configurable retention period.
- Background purge timer while the app runs.
- Bulk archive / restore / delete.
- Undo toast after archiving.
