# Project Archiving Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users "delete" a project by moving its folder into a dedicated archive, show archived projects in a new Archive tab with a 30-day auto-delete countdown, and support Restore / Delete forever — with expired archives purged on startup.

**Architecture:** Archiving is a real filesystem move (via a new Rust `scaffold_move_dir` command with cross-volume fallback) into `~/Documents/Scaffold-archive`. The registry records the new path plus `archivedFrom`, `archived`, and `archivedAt`. Restore moves the folder back; Delete forever removes files + registry entry. On startup, `purgeExpiredArchives` removes anything archived >30 days. The UI adds an Archive nav entry, a new Archive screen, a reusable themed ConfirmDialog, and fixes the broken Dashboard card.

**Tech Stack:** React 19 + TypeScript, Zustand, Tauri v2 (Rust backend), `@tauri-apps/plugin-store`, custom CSS tokens.

**Testing note:** This project has no test runner. The automated gate is `pnpm build` (`tsc -b && vite build`) which must pass with zero type errors after each task that touches TS/Rust. Each task also includes manual verification steps that require running the app (`pnpm tauri:dev`).

---

## File Structure

**Create:**
- `src/components/ui/ConfirmDialog.tsx` — reusable themed modal for confirmations (archive, restore, delete forever).
- `src/components/ui/ConfirmDialog.css` — modal styling using existing design tokens.
- `src/screens/Archive.tsx` — the Archive screen (list of archived projects + actions).

**Modify:**
- `src/lib/types.ts` — add `archivedFrom?` to `Project`.
- `src/lib/paths.ts` — add `archiveDir()`.
- `src/lib/ipc.ts` — add `fsMoveDir(from, to)`.
- `src/lib/projects.ts` — rewrite `archiveProject`/`restoreProject`/`permanentlyDeleteProject` to do real filesystem moves; add `purgeExpiredArchives` + retention constant; add `deleteDaysLeft` helper.
- `src/lib/store.ts` — call `purgeExpiredArchives()` in `init()`.
- `src-tauri/src/lib.rs` — add `scaffold_move_dir` command (rename + cross-volume fallback); register in handler list.
- `src/components/ui/Icon.tsx` — add `archive` and `trash` icons.
- `src/components/shell/Sidebar.tsx` — add Archive nav entry with count badge; exclude archived from Recent.
- `src/screens/Dashboard.tsx` — filter to active projects; replace broken `Scaffold.store.removeProject` button with an Archive button + confirm dialog.
- `src/screens/screens.css` — add archive list/row/countdown styles.
- `src/App.tsx` — add `case "archive"` to the router.

---

### Task 1: Backend — `scaffold_move_dir` Rust command

This task adds the filesystem primitive that all the archive moves depend on. It must come first because `ipc.ts` and `projects.ts` reference it.

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add the `scaffold_move_dir` command**

In `src-tauri/src/lib.rs`, add this command after the existing `scaffold_rename` function (around line 36, after the `scaffold_rename` closing brace):

```rust
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
            fs::remove_dir_all(&from_path)
                .map_err(|e| format!("move cleanup failed (rename was: {rename_err}): {e}"))?;
            Ok(())
        }
    }
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
```

- [ ] **Step 2: Register the command in the handler list**

In the same file, find the `invoke_handler(tauri::generate_handler![...])` block (around line 136) and add `scaffold_move_dir,` to the list. Add it right after `scaffold_rename,`:

```rust
        .invoke_handler(tauri::generate_handler![
            greet,
            scaffold_mkdir,
            scaffold_remove,
            scaffold_rename,
            scaffold_move_dir,
            scaffold_write_text_file,
            scaffold_read_text_file,
            scaffold_exists,
            scaffold_read_dir,
            show_onboarding_window,
            close_onboarding_window,
        ])
```

- [ ] **Step 3: Verify it compiles**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: completes with no errors (warnings about unused code are fine).

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: add scaffold_move_dir rust command with cross-volume fallback"
```

---

### Task 2: IPC wrapper — `fsMoveDir`

**Files:**
- Modify: `src/lib/ipc.ts`

- [ ] **Step 1: Add the `fsMoveDir` wrapper**

In `src/lib/ipc.ts`, add this function at the end of the "Filesystem commands" section (after `fsRename`, around line 87):

```ts
/** Move a directory tree from `from` to `to` (rename with cross-volume fallback). */
export async function fsMoveDir(from: string, to: string): Promise<void> {
  if (!isTauri()) return;
  await invoke("scaffold_move_dir", { from, to });
}
```

- [ ] **Step 2: Verify the build passes**

Run: `pnpm build`
Expected: `tsc -b && vite build` succeeds with no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/ipc.ts
git commit -m "feat: add fsMoveDir ipc wrapper"
```

---

### Task 3: Types — add `archivedFrom` to `Project`

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Add the `archivedFrom` field**

In `src/lib/types.ts`, find the `Project` interface (lines 10-26) and add `archivedFrom` right after `archivedAt`. The block currently looks like:

```ts
  /** Whether the project is archived (moved to archive folder). */
  archived?: boolean;
  /** When the project was archived. */
  archivedAt?: number;
}
```

Change it to:

```ts
  /** Whether the project is archived (moved to archive folder). */
  archived?: boolean;
  /** When the project was archived. */
  archivedAt?: number;
  /** The project path before archiving, so Restore can return it. */
  archivedFrom?: string;
}
```

- [ ] **Step 2: Verify the build passes**

Run: `pnpm build`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add archivedFrom field to Project type"
```

---

### Task 4: Paths — `archiveDir()`

**Files:**
- Modify: `src/lib/paths.ts`

- [ ] **Step 1: Import `dirname` and add `archiveDir`**

In `src/lib/paths.ts`, replace the import line (line 6) to include `dirname`:

```ts
import { dirname, homeDir, join } from "@tauri-apps/api/path";
import { isTauri } from "./ipc";
```

Then add `archiveDir()` after `defaultProjectDir()` (after line 14):

```ts
/** Archive root — a sibling of the default project dir, so moves stay same-volume. */
export async function archiveDir(): Promise<string> {
  if (!isTauri()) return "/tmp/Scaffold-archive";
  const projects = await defaultProjectDir();
  return await join(dirname(projects), "Scaffold-archive");
}
```

- [ ] **Step 2: Verify the build passes**

Run: `pnpm build`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add src/lib/paths.ts
git commit -m "feat: add archiveDir path helper"
```

---

### Task 5: Project operations — rewrite archive/restore/delete + purge

This is the core logic task. It rewrites the three existing stubs to do real filesystem work, adds `purgeExpiredArchives`, and adds a `deleteDaysLeft` display helper.

**Files:**
- Modify: `src/lib/projects.ts`

- [ ] **Step 1: Update imports**

In `src/lib/projects.ts`, update the imports from `./ipc` (around lines 12-18) to add `fsMoveDir` and `fsRemove`:

```ts
import {
  isTauri,
  fsExists,
  fsMkdir,
  fsReadTextFile,
  fsWriteTextFile,
  fsRemove,
  fsMoveDir,
} from "./ipc";
```

And update the imports from `./paths` (line 19) to add `archiveDir`:

```ts
import { archiveDir, defaultProjectDir, joinPath } from "./paths";
```

- [ ] **Step 2: Add retention constant**

Add this near the top of the file, after the existing `MANIFEST_FILE` constant (after line 30):

```ts
/** Archived projects older than this are purged on startup. */
export const ARCHIVE_RETENTION_DAYS = 30;
const ARCHIVE_RETENTION_MS = ARCHIVE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
```

- [ ] **Step 3: Add a private helper to read the registry**

We currently read the registry inline via `withStore`. Add a small private helper near `withStore` (after line 45) so the new functions share it:

```ts
/** Read the current project registry (empty if none / not Tauri). */
async function readRegistry(): Promise<Project[]> {
  const result = await withStore(async (store) => {
    return (await store.get<Project[]>(REGISTRY_KEY)) ?? [];
  });
  return result ?? [];
}

/** Write the registry and persist. */
async function writeRegistry(projects: Project[]): Promise<void> {
  await withStore(async (store) => {
    await store.set(REGISTRY_KEY, projects);
    await store.save();
  });
}
```

- [ ] **Step 4: Rewrite `listProjects` to use the helper**

Replace the existing `listProjects` function (lines 273-278):

```ts
/** List all projects recorded in the registry. */
export async function listProjects(): Promise<Project[]> {
  return await readRegistry();
}
```

- [ ] **Step 5: Rewrite `archiveProject` to do a real move**

Replace the existing `archiveProject` function (lines 307-316) with:

```ts
/** Move a project's folder into the archive and mark it archived. */
export async function archiveProject(id: string): Promise<void> {
  if (!isTauri()) return;

  const projects = await readRegistry();
  const project = projects.find((p) => p.id === id);
  if (!project) throw new Error(`Project not found: ${id}`);
  if (project.archived) return; // already archived, no-op

  const archiveRoot = await archiveDir();
  await fsMkdir(archiveRoot);

  // Destination folder name, with collision avoidance.
  let destName = basename(project.path);
  let destPath = await joinPath(archiveRoot, destName);
  if (await fsExists(destPath)) {
    destName = `${basename(project.path)}-${uid().slice(0, 6)}`;
    destPath = await joinPath(archiveRoot, destName);
  }

  // Move the folder. If this throws, we leave the registry untouched
  // so there is no data loss and no inconsistent state.
  await fsMoveDir(project.path, destPath);

  const updated = projects.map((p) =>
    p.id === id
      ? {
          ...p,
          archivedFrom: p.path,
          path: destPath,
          archived: true,
          archivedAt: Date.now(),
        }
      : p
  );
  await writeRegistry(updated);
}
```

We need `basename` — add it to the import from `./paths`:

```ts
import { archiveDir, basename, defaultProjectDir, joinPath } from "./paths";
```

- [ ] **Step 6: Rewrite `restoreProject` to move the folder back**

Replace the existing `restoreProject` function (lines 319-328) with:

```ts
/** Restore an archived project: move the folder back to its original location. */
export async function restoreProject(id: string): Promise<void> {
  if (!isTauri()) return;

  const projects = await readRegistry();
  const project = projects.find((p) => p.id === id);
  if (!project) throw new Error(`Project not found: ${id}`);
  if (!project.archived) return; // not archived, no-op

  // Prefer the recorded original location; fall back to default dir.
  const baseDir = project.archivedFrom ?? (await defaultProjectDir());
  const parent = dirnameSafe(baseDir) ?? (await defaultProjectDir());
  await fsMkdir(parent);

  let target = baseDir;
  if (await fsExists(target)) {
    // Slot was taken in the meantime; append a suffix.
    target = await joinPath(parent, `${basename(baseDir)}-${uid().slice(0, 6)}`);
  }

  await fsMoveDir(project.path, target);

  const updated = projects.map((p) =>
    p.id === id
      ? {
          ...p,
          path: target,
          archived: false,
          archivedAt: undefined,
          archivedFrom: undefined,
        }
      : p
  );
  await writeRegistry(updated);
}
```

Add a small path helper above `restoreProject` (Tauri's `dirname` is async and platform-aware; for the registry value we just need the parent directory string). Add it near the other private helpers:

```ts
/** Sync parent-directory extraction from a path string. */
function dirnameSafe(p: string): string | null {
  const norm = p.replace(/\\/g, "/");
  const idx = norm.lastIndexOf("/");
  return idx > 0 ? norm.slice(0, idx) : null;
}
```

- [ ] **Step 7: Rewrite `permanentlyDeleteProject` to remove files**

Replace the existing `permanentlyDeleteProject` function (lines 331-338) with:

```ts
/** Permanently delete an archived project: remove its files + registry entry. */
export async function permanentlyDeleteProject(id: string): Promise<void> {
  const projects = await readRegistry();
  const project = projects.find((p) => p.id === id);
  if (!project) return;

  // Best-effort filesystem removal; the registry is the source of truth,
  // so a missing folder must not trap the user.
  if (isTauri()) {
    try {
      await fsRemove(project.path);
    } catch {
      // ignore — folder may already be gone
    }
  }

  await writeRegistry(projects.filter((p) => p.id !== id));
}
```

- [ ] **Step 8: Add `purgeExpiredArchives`**

Add this after `permanentlyDeleteProject`:

```ts
/** Permanently delete archived projects older than the retention window.
 *  Called once on startup. Never throws. Returns the count purged. */
export async function purgeExpiredArchives(): Promise<number> {
  if (!isTauri()) return 0;
  try {
    const projects = await readRegistry();
    const now = Date.now();
    const expired = projects.filter(
      (p) =>
        p.archived === true &&
        typeof p.archivedAt === "number" &&
        now - p.archivedAt > ARCHIVE_RETENTION_MS
    );
    if (expired.length === 0) return 0;

    for (const p of expired) {
      try {
        await fsRemove(p.path);
      } catch {
        // ignore — folder may already be gone
      }
    }

    const expiredIds = new Set(expired.map((p) => p.id));
    await writeRegistry(projects.filter((p) => !expiredIds.has(p.id)));
    return expired.length;
  } catch {
    return 0; // never break startup
  }
}
```

- [ ] **Step 9: Add `deleteDaysLeft` display helper**

Add this near `formatRelative` (after line 361):

```ts
/** Whole days remaining before an archived project is auto-deleted (min 0). */
export function deleteDaysLeft(archivedAt: number | undefined): number | null {
  if (typeof archivedAt !== "number") return null;
  const msLeft = ARCHIVE_RETENTION_MS - (Date.now() - archivedAt);
  return Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
}
```

- [ ] **Step 10: Verify the build passes**

Run: `pnpm build`
Expected: `tsc -b && vite build` succeeds with no type errors.

- [ ] **Step 11: Commit**

```bash
git add src/lib/projects.ts
git commit -m "feat: archive/restore/delete move folders; add startup purge"
```

---

### Task 6: Startup purge — call from store init

**Files:**
- Modify: `src/lib/store.ts`

- [ ] **Step 1: Import `purgeExpiredArchives`**

In `src/lib/store.ts`, add the import. After the existing imports (around lines 7-16), add:

```ts
import { purgeExpiredArchives } from "./projects";
```

- [ ] **Step 2: Call purge in `init()`**

Find the `init()` function (around line 98). Currently it begins:

```ts
  async init() {
    const settings = await loadSettings();
    applyTheme(settings.theme);
    const needsOnboarding = !settings.onboarded;
    ...
```

Insert the purge call right after `applyTheme(settings.theme);` and before `const needsOnboarding`:

```ts
  async init() {
    const settings = await loadSettings();
    applyTheme(settings.theme);

    // Purge archived projects older than the retention window before the
    // dashboard renders. Best-effort; never blocks startup.
    await purgeExpiredArchives();

    const needsOnboarding = !settings.onboarded;
    ...
```

- [ ] **Step 3: Verify the build passes**

Run: `pnpm build`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add src/lib/store.ts
git commit -m "feat: purge expired archives on startup"
```

---

### Task 7: Icons — `archive` and `trash`

**Files:**
- Modify: `src/components/ui/Icon.tsx`

- [ ] **Step 1: Add the two icon names to the type**

In `src/components/ui/Icon.tsx`, add `archive` and `trash` to the `IconName` union (lines 7-31). Add them alphabetically — `"archive"` at the top and `"trash"` near the end:

```ts
export type IconName =
  | "archive"
  | "dashboard"
  | "plus"
  ...
  | "sparkles"
  | "trash";
```

- [ ] **Step 2: Add the two icon paths**

In the `PATHS` record (after line 40), add entries for `archive` (insert as the first key) and `trash` (after `sparkles`):

```ts
const PATHS: Record<IconName, JSX.Element> = {
  archive: (
    <>
      <rect x="2" y="4" width="20" height="5" rx="1" />
      <path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" />
      <line x1="10" y1="13" x2="14" y2="13" />
    </>
  ),
  dashboard: (
    ...
  ),
  ...
  sparkles: (
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
  ),
  trash: (
    <>
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </>
  ),
};
```

(Insert the `archive` entry as the first key after `const PATHS: Record<...> = {`, and the `trash` entry as the last key before the closing `};`.)

- [ ] **Step 3: Verify the build passes**

Run: `pnpm build`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/Icon.tsx
git commit -m "feat: add archive and trash icons"
```

---

### Task 8: ConfirmDialog component

A reusable themed modal used by Dashboard (archive) and Archive screen (restore, delete forever).

**Files:**
- Create: `src/components/ui/ConfirmDialog.tsx`
- Create: `src/components/ui/ConfirmDialog.css`

- [ ] **Step 1: Create `ConfirmDialog.tsx`**

Create `src/components/ui/ConfirmDialog.tsx`:

```tsx
import { ReactNode, useEffect, useState } from "react";
import { Button } from "./Button";
import "./ConfirmDialog.css";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** "danger" styles the confirm button destructively (red). */
  tone?: "default" | "danger";
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset internal state whenever the dialog is (re)opened.
  useEffect(() => {
    if (open) {
      setBusy(false);
      setError(null);
    }
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const handleConfirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false); // keep dialog open so the user sees the error
    }
  };

  return (
    <div className="confirmOverlay" onClick={() => !busy && onCancel()}>
      <div
        className="confirmDialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmTitle"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirmTitle" className="confirmTitle">{title}</h2>
        <div className="confirmMessage">{message}</div>
        {error && <div className="confirmError">{error}</div>}
        <div className="confirmActions">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            onClick={handleConfirm}
            disabled={busy}
          >
            {busy ? "…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `ConfirmDialog.css`**

Create `src/components/ui/ConfirmDialog.css`:

```css
.confirmOverlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: confirmFade var(--dur-fast) var(--ease-out);
}

@keyframes confirmFade {
  from { opacity: 0; }
  to { opacity: 1; }
}

.confirmDialog {
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: var(--sp-5);
  max-width: 420px;
  width: calc(100% - var(--sp-8));
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  animation: confirmPop var(--dur-base) var(--ease-out);
}

@keyframes confirmPop {
  from { transform: scale(0.96); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.confirmTitle {
  font-size: var(--fs-base);
  font-weight: var(--fw-bold);
  margin: 0;
}

.confirmMessage {
  font-size: var(--fs-sm);
  color: var(--fg-secondary);
  line-height: 1.5;
}

.confirmError {
  font-size: var(--fs-xs);
  color: var(--danger, var(--accent));
  background: var(--accent-subtle);
  padding: var(--sp-2) var(--sp-3);
  border-radius: var(--radius-md);
}

.confirmActions {
  display: flex;
  justify-content: flex-end;
  gap: var(--sp-2);
  margin-top: var(--sp-2);
}
```

- [ ] **Step 3: Verify the build passes**

Run: `pnpm build`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/ConfirmDialog.tsx src/components/ui/ConfirmDialog.css
git commit -m "feat: add reusable ConfirmDialog component"
```

---

### Task 9: Dashboard — fix broken card, add Archive action

**Files:**
- Modify: `src/screens/Dashboard.tsx`

- [ ] **Step 1: Update imports**

Replace the imports at the top of `src/screens/Dashboard.tsx` (lines 1-9) with:

```tsx
import { useEffect, useState } from "react";
import { useAppStore } from "../lib/store";
import {
  archiveProject,
  deleteDaysLeft,
  listProjects,
  formatRelative,
} from "../lib/projects";
import { basename } from "../lib/paths";
import { EmptyState } from "../components/EmptyState";
import { Button } from "../components/ui/Button";
import { Icon } from "../components/ui/Icon";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Project, ProjectStack, ProjectTemplate } from "../lib/types";
import "./screens.css";
```

- [ ] **Step 2: Filter active projects and track projects in store**

The current `Dashboard` calls `listProjects().then(setProjects)` directly. We want to refresh after archiving, so introduce a local `reload` function and filter archived out. Replace the `Dashboard` component body (lines 11-64) with:

```tsx
export function Dashboard() {
  const navigate = useAppStore((s) => s.navigate);
  const setProjects = useAppStore((s) => s.setProjects);
  const settings = useAppStore((s) => s.settings);

  const active = useAppStore((s) => s.projects.filter((p) => !p.archived));

  const reload = () => {
    listProjects().then(setProjects);
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="screen">
      <div className="screenHeader">
        <div>
          <h1 className="screenTitle">Projects</h1>
          <p className="screenSub">
            {active.length > 0
              ? `${active.length} project${active.length === 1 ? "" : "s"}`
              : "Create your first visual React site."}
          </p>
        </div>
        <Button variant="primary" icon="plus" onClick={() => navigate({ name: "new-project" })}>
          New Project
        </Button>
      </div>

      {active.length === 0 ? (
        <EmptyState
          icon="sparkles"
          title="No projects yet"
          desc="Spin up a new React site from a template. Everything runs locally on your machine."
          actions={
            <Button variant="primary" icon="plus" onClick={() => navigate({ name: "new-project" })}>
              Create your first project
            </Button>
          }
        />
      ) : (
        <div className="projectGrid">
          {active.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onOpen={() => navigate({ name: "editor", projectId: p.id })}
              onChanged={reload}
            />
          ))}
        </div>
      )}

      {settings.defaultProjectDir && (
        <div className="faint" style={{ fontSize: "var(--fs-xs)", marginTop: "var(--sp-4)" }}>
          <Icon name="folder" size={13} style={{ verticalAlign: "-2px", marginRight: 6 }} />
          Projects are saved to <span className="mono">{settings.defaultProjectDir}</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Rewrite `ProjectCard` with Archive action + confirm**

Replace the entire `ProjectCard` function (lines 66-88) with:

```tsx
function ProjectCard({
  project,
  onOpen,
  onChanged,
}: {
  project: Project;
  onOpen: () => void;
  onChanged: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  const handleArchive = async () => {
    await archiveProject(project.id);
    setConfirming(false);
    onChanged();
  };

  return (
    <div className="projectCard">
      <div className="projectThumb" onClick={onOpen}>
        <Icon name="layers" size={36} />
      </div>
      <div className="projectBody">
        <span className="projectName" onClick={onOpen}>{project.name}</span>
        <div className="projectMeta">
          <span className="stackBadge">{project.stack}</span>
          <span>{formatRelative(project.lastEditedAt ?? project.updatedAt)}</span>
        </div>
        <span className="faint mono projectPath" title={project.path}>
          {basename(project.path)}
        </span>
        <div className="projectActions">
          <Button
            variant="ghost"
            size="sm"
            icon="archive"
            onClick={() => setConfirming(true)}
          >
            Archive
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        title={`Archive "${project.name}"?`}
        message={
          <>
            It will be moved to the Archive and permanently deleted in{" "}
            {deleteDaysLeft(Date.now())} days. You can restore it any time before then.
          </>
        }
        confirmLabel="Archive"
        tone="default"
        onConfirm={handleArchive}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}

export type { ProjectStack, ProjectTemplate };
```

Note: `deleteDaysLeft(Date.now())` returns the full retention (30) — used here purely to show the retention window to the user at archive time.

- [ ] **Step 4: Verify the build passes**

Run: `pnpm build`
Expected: success, no type errors. The previous broken `Scaffold.store.removeProject` reference is gone.

- [ ] **Step 5: Commit**

```bash
git add src/screens/Dashboard.tsx
git commit -m "feat: dashboard card archive action with confirm dialog"
```

---

### Task 10: Sidebar — Archive nav entry + count badge

**Files:**
- Modify: `src/components/shell/Sidebar.tsx`

- [ ] **Step 1: Add Archive to the NAV array**

In `src/components/shell/Sidebar.tsx`, update the `NAV` array (lines 14-17) to insert Archive between Projects and Settings. Replace it with:

```ts
const NAV: NavEntry[] = [
  { route: { name: "dashboard" }, label: "Projects", icon: "dashboard", match: ["dashboard", "new-project", "editor", "publish"] },
  { route: { name: "archive" }, label: "Archive", icon: "archive", match: ["archive"] },
  { route: { name: "settings" }, label: "Settings", icon: "settings", match: ["settings"] },
];
```

- [ ] **Step 2: Render a count badge on the Archive entry**

In the `NAV.map` block (lines 45-54), the button currently renders the icon + label. Update it to render an optional count badge for the Archive entry. Replace the map block with:

```tsx
        {NAV.map((entry) => {
          const count =
            entry.label === "Archive"
              ? projects.filter((p) => p.archived).length
              : 0;
          return (
            <button
              key={entry.label}
              className={`navItem ${entry.match.includes(route.name) ? "active" : ""}`}
              onClick={() => navigate(entry.route)}
            >
              <Icon name={entry.icon} size={17} />
              <span className="navLabel">{entry.label}</span>
              {count > 0 && <span className="navBadge">{count}</span>}
            </button>
          );
        })}
```

- [ ] **Step 3: Exclude archived projects from Recent**

In the Recent list (around line 56), filter out archived projects. Change:

```ts
  const recent = projects.slice(0, 4);
```

to:

```ts
  const recent = projects.filter((p) => !p.archived).slice(0, 4);
```

- [ ] **Step 4: Verify the build passes**

Run: `pnpm build`
Expected: success.

- [ ] **Step 5: Commit**

```bash
git add src/components/shell/Sidebar.tsx
git commit -m "feat: add Archive nav entry with count badge"
```

---

### Task 11: Archive screen

**Files:**
- Create: `src/screens/Archive.tsx`

- [ ] **Step 1: Create the Archive screen**

Create `src/screens/Archive.tsx`:

```tsx
import { useEffect, useState } from "react";
import { useAppStore } from "../lib/store";
import {
  deleteDaysLeft,
  formatRelative,
  listProjects,
  permanentlyDeleteProject,
  restoreProject,
} from "../lib/projects";
import { basename } from "../lib/paths";
import { EmptyState } from "../components/EmptyState";
import { Button } from "../components/ui/Button";
import { Icon } from "../components/ui/Icon";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Project } from "../lib/types";
import "./screens.css";

export function Archive() {
  const navigate = useAppStore((s) => s.navigate);
  const setProjects = useAppStore((s) => s.setProjects);
  const archived = useAppStore((s) => s.projects.filter((p) => p.archived));
  const [dialog, setDialog] = useState<
    | { kind: "restore"; project: Project }
    | { kind: "delete"; project: Project }
    | null
  >(null);

  const reload = () => {
    listProjects().then(setProjects);
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRestore = async () => {
    if (!dialog) return;
    await restoreProject(dialog.project.id);
    setDialog(null);
    reload();
    navigate({ name: "dashboard" });
  };

  const handleDelete = async () => {
    if (!dialog) return;
    await permanentlyDeleteProject(dialog.project.id);
    setDialog(null);
    reload();
  };

  return (
    <div className="screen">
      <div className="screenHeader">
        <div>
          <h1 className="screenTitle">Archive</h1>
          <p className="screenSub">
            Archived projects are permanently deleted after 30 days. Restore
            them any time before then.
          </p>
        </div>
      </div>

      {archived.length === 0 ? (
        <EmptyState
          icon="archive"
          title="Archive is empty"
          desc="Projects you archive will appear here for 30 days before being permanently deleted."
        />
      ) : (
        <div className="archiveList">
          {archived.map((p) => {
            const days = deleteDaysLeft(p.archivedAt);
            return (
              <div className="archiveRow" key={p.id}>
                <div className="archiveRowIcon">
                  <Icon name="layers" size={20} />
                </div>
                <div className="archiveRowMain">
                  <div className="archiveRowName">{p.name}</div>
                  <div className="archiveRowMeta">
                    <span className="stackBadge">{p.stack}</span>
                    <span className="faint mono" title={p.archivedFrom ?? p.path}>
                      {basename(p.archivedFrom ?? p.path)}
                    </span>
                  </div>
                </div>
                <div className="archiveRowRight">
                  <span
                    className={`countdownPill ${days !== null && days <= 3 ? "urgent" : ""}`}
                  >
                    {days === null
                      ? "—"
                      : days === 0
                        ? "Deletes today"
                        : `Deletes in ${days}d`}
                  </span>
                  <div className="archiveRowActions">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="folder-open"
                      onClick={() => setDialog({ kind: "restore", project: p })}
                    >
                      Restore
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="trash"
                      onClick={() => setDialog({ kind: "delete", project: p })}
                    >
                      Delete forever
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={dialog?.kind === "restore"}
        title={`Restore "${dialog?.project.name ?? ""}"?`}
        message="Move it back to your active projects so you can keep editing it."
        confirmLabel="Restore"
        onConfirm={handleRestore}
        onCancel={() => setDialog(null)}
      />

      <ConfirmDialog
        open={dialog?.kind === "delete"}
        title={`Delete "${dialog?.project.name ?? ""}" forever?`}
        message={
          <>
            This permanently removes the project folder and cannot be undone.
            Archived {formatRelative(dialog?.project.archivedAt ?? null)}.
          </>
        }
        confirmLabel="Delete forever"
        tone="danger"
        onConfirm={handleDelete}
        onCancel={() => setDialog(null)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify the build passes**

Run: `pnpm build`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add src/screens/Archive.tsx
git commit -m "feat: add Archive screen with restore + delete forever"
```

---

### Task 12: Router — wire the `archive` route

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Import the Archive screen**

In `src/App.tsx`, add the import after the `Settings` import (around line 11):

```tsx
import { Archive } from "./screens/Archive";
```

- [ ] **Step 2: Add the `archive` case to the router**

In the `renderRoute` function's switch (lines 49-62), add an `archive` case before `settings`:

```tsx
function renderRoute(route: ReturnType<typeof useAppStore.getState>["route"]) {
  switch (route.name) {
    case "dashboard":
      return <Dashboard />;
    case "new-project":
      return <NewProjectWizard />;
    case "editor":
      return <Editor projectId={route.projectId} />;
    case "publish":
      return <Publish projectId={route.projectId} />;
    case "archive":
      return <Archive />;
    case "settings":
      return <Settings />;
    default:
      return <Dashboard />;
  }
}
```

- [ ] **Step 3: Verify the build passes**

Run: `pnpm build`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire archive route into the router"
```

---

### Task 13: Styles — archive list, nav badge, card actions

**Files:**
- Modify: `src/screens/screens.css`
- Modify: `src/components/shell/Sidebar.css`

- [ ] **Step 1: Add Dashboard card action styles**

In `src/screens/screens.css`, find the `.projectMeta` block (around line 81) and add these blocks after it:

```css
.projectPath {
  font-size: 11px;
  margin-top: 2px;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.projectActions {
  display: flex;
  gap: var(--sp-2);
  margin-top: var(--sp-3);
}
```

- [ ] **Step 2: Add Archive list styles**

At the end of `src/screens/screens.css`, append:

```css
/* ---- Archive list ---- */
.archiveList {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.archiveRow {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-4);
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  transition: border-color var(--dur-fast) var(--ease-out);
}
.archiveRow:hover {
  border-color: var(--border-default);
}
.archiveRowIcon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  background: var(--bg-sunken);
  color: var(--fg-muted);
  flex-shrink: 0;
}
.archiveRowMain {
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
  flex: 1;
  min-width: 0;
}
.archiveRowName {
  font-size: var(--fs-sm);
  font-weight: var(--fw-semibold);
}
.archiveRowMeta {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  font-size: var(--fs-xs);
}
.archiveRowRight {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  flex-shrink: 0;
}
.archiveRowActions {
  display: flex;
  gap: var(--sp-1);
}
.countdownPill {
  display: inline-flex;
  align-items: center;
  padding: 2px var(--sp-2);
  border-radius: var(--radius-full);
  background: var(--bg-sunken);
  font-size: var(--fs-xs);
  font-weight: var(--fw-medium);
  color: var(--fg-secondary);
  white-space: nowrap;
}
.countdownPill.urgent {
  background: var(--accent-subtle);
  color: var(--accent);
}
```

- [ ] **Step 3: Add nav badge style**

In `src/components/shell/Sidebar.css`, append at the end:

```css
.navLabel {
  flex: 1;
}
.navBadge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: var(--radius-full);
  background: var(--accent-subtle);
  color: var(--accent);
  font-size: 11px;
  font-weight: var(--fw-semibold);
  flex-shrink: 0;
}
```

- [ ] **Step 4: Verify the build passes**

Run: `pnpm build`
Expected: success.

- [ ] **Step 5: Commit**

```bash
git add src/screens/screens.css src/components/shell/Sidebar.css
git commit -m "style: archive list, countdown pill, nav badge, card actions"
```

---

### Task 14: End-to-end manual verification

This task verifies the whole feature works in the running app. No code changes — just behavior checks.

**Prerequisite:** The app should run via `pnpm tauri:dev`. If `tauri:dev` is unavailable in this environment, fall back to `pnpm dev` (browser mode) and note that the filesystem move/purge code paths require Tauri and are verified by the passing Rust check + build.

- [ ] **Step 1: Confirm a clean build**

Run: `pnpm build`
Expected: `tsc -b && vite build` completes with zero errors.

- [ ] **Step 2: (If Tauri available) Start the app**

Run: `pnpm tauri:dev`
Expected: app window opens to the Dashboard.

- [ ] **Step 3: Verify archiving moves the folder**

- Create a project (or use an existing one). Note its path shown on the card.
- Click **Archive** on its card → confirm in the dialog.
- Confirm: the card disappears from the Dashboard.
- Confirm: the **Archive** sidebar entry now shows a count badge of `1`.
- On disk, confirm the project folder moved to `~/Documents/Scaffold-archive/<folderName>`.
- Confirm the original location is empty.

- [ ] **Step 4: Verify the Archive screen**

- Click the **Archive** nav entry.
- Confirm: the archived project appears with its name, stack badge, original folder name, and a countdown reading "Deletes in 30d".

- [ ] **Step 5: Verify Restore**

- Click **Restore** → confirm.
- Confirm: the Archive list empties (badge disappears from sidebar) and the project reappears on the Dashboard.
- On disk, confirm the folder returned to its original location.

- [ ] **Step 6: Verify Delete forever**

- Archive the project again.
- In the Archive screen, click **Delete forever** → confirm.
- Confirm: the row disappears and the folder is gone from disk.

- [ ] **Step 7: Verify startup purge**

- Archive a project (so it's in the archive dir + registry with `archivedAt`).
- Temporarily edit `src/lib/projects.ts`: change `ARCHIVE_RETENTION_DAYS = 30` to `0` for this test.
- Rebuild/restart the app.
- Confirm: the archived project is gone from the Archive screen and the folder is removed from disk.
- Revert the constant back to `30`.

- [ ] **Step 8: Verify error handling**

- Archive a project, then manually delete its folder from the archive dir on disk.
- In the Archive screen, click **Delete forever** → confirm.
- Confirm: the row disappears without an error (the missing-folder case is tolerated).

- [ ] **Step 9: Final commit if any revert was needed**

If you changed `ARCHIVE_RETENTION_DAYS` for Step 7, ensure it's back to `30`:

```bash
git status
git diff src/lib/projects.ts
```
If the revert is pending, commit it:
```bash
git add src/lib/projects.ts
git commit -m "chore: restore ARCHIVE_RETENTION_DAYS to 30"
```

---

## Self-Review

**Spec coverage:**
- Physical move to archive dir → Task 5 (`archiveProject`) + Task 1 (`scaffold_move_dir`).
- `archivedFrom` for restore → Task 3 (type) + Task 5 (`restoreProject`).
- Restore / Delete forever → Task 5 + Task 11 (UI).
- 30-day purge on startup → Task 5 (`purgeExpiredArchives`) + Task 6 (`init`).
- Archive tab in sidebar → Task 10.
- Archive screen with countdown → Task 11.
- Reusable themed ConfirmDialog → Task 8.
- Fix broken Dashboard card → Task 9.
- Router wiring → Task 12.
- Icons (`archive`, `trash`) → Task 7.
- `archiveDir()` sibling location → Task 4.
- Cross-volume fallback → Task 1 (`copy_dir_recursive`).
- Error handling (no registry update on move failure) → Task 5 (`archiveProject`/`restoreProject` update registry only after a successful move; `purgeExpiredArchives` swallows errors).
- `tsc -b` build gate → every code task.
- Manual verification matrix → Task 14.

**Placeholder scan:** No TBD/TODO/placeholder steps. Every code step contains the full code to write.

**Type/name consistency:** `fsMoveDir`, `archiveDir`, `archivedFrom`, `purgeExpiredArchives`, `deleteDaysLeft`, `ARCHIVE_RETENTION_DAYS`, `ConfirmDialog` (props: `open/title/message/confirmLabel/cancelLabel/tone/onConfirm/onCancel`), `archive`/`trash` icon names — all used identically across the tasks that reference them. `basename` is exported from `./paths` and imported in both `projects.ts` and the screens.
