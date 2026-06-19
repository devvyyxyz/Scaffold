# Project Banners, Editor Loading & Recovery — Design

**Date:** 2026-06-19
**Status:** Approved

## Summary

Three related improvements to the project-opening experience:
1. **Project card banners** — replace the generic icon/gradient thumbnail with an
   image. Per-project `bannerPath` field, defaulting to the bundled
   `public/Scaffold/banner.png`.
2. **Editor loading screen** — the Editor reads the project manifest from disk
   on open; shows a loading state while doing so.
3. **Corrupt/missing project recovery** — if the manifest is missing or
   unreadable, the Editor shows a recovery screen with a "Repair project" button
   that re-scaffolds boilerplate files while preserving the manifest where
   possible.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Error trigger | Corrupt/missing manifest only | A valid manifest with empty `pages` (fresh project) loads normally. |
| Banner | Per-project `bannerPath`, default to bundled banner | Flexible; no picker UI now (YAGNI). |
| Recovery | Re-scaffold files, preserve manifest | Recovers from broken/missing source files without clobbering page data. |

## 1. Per-project banner

### `Project` type (`src/lib/types.ts`)

Add field:
- `bannerPath?: string` — optional path to a banner image (resolved as a Vite
  asset URL, e.g. `/Scaffold/banner.png`). When unset, cards use the default.

### `Dashboard.tsx`

`ProjectCard` replaces the `<div className="projectThumb"><Icon .../></div>`
with:
```tsx
<div className="projectThumb" onClick={onOpen}>
  <img src={project.bannerPath || "/Scaffold/banner.png"} alt="" />
</div>
```
`/Scaffold/banner.png` is served from the Vite `public/` dir. The Archive screen
keeps its icon thumbnails (banners are for active cards only).

### Styles (`screens.css`)

```css
.projectThumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
```
`.projectThumb` keeps its existing height/flex centering; the img fills it.

## 2. Editor loading + validation

### `projects.ts`

New functions:

```ts
export type ProjectLoadResult =
  | { status: "ok"; project: Project; manifest: ProjectManifest }
  | { status: "missing"; project: Project }     // manifest file absent
  | { status: "corrupt"; project: Project };    // manifest present but unreadable

/** Read a project from the registry and validate its on-disk manifest. */
export async function loadProject(projectId: string): Promise<ProjectLoadResult | null>;
```

`loadProject`:
1. Find project in registry. Return `null` if not in registry at all
   (Editor shows "not found" — existing behavior).
2. Check manifest path exists.
   - Absent → `{ status: "missing", project }`.
3. Try read + JSON.parse.
   - Throws/fails → `{ status: "corrupt", project }`.
   - Success but missing required fields (`id`, `name`) → `{ status: "corrupt" }`.
4. Otherwise `{ status: "ok", project, manifest }`.

## 3. Recovery

### `projects.ts`

```ts
/** Re-scaffold a project's files, preserving the manifest where possible.
 *  Returns the recovered manifest. */
export async function recoverProject(projectId: string): Promise<ProjectManifest>;
```

`recoverProject`:
1. Find project. Throw if not in registry.
2. Re-run `scaffoldProjectFiles(project)` — writes fresh `package.json`,
   `index.html`, `src/*` boilerplate. (Best-effort; overwrites existing files.)
3. Read the existing manifest if readable (best-effort). Keep its `pages`,
   `name`, `id`, timestamps. If unreadable, build a fresh manifest from the
   registry `Project`.
4. Write the (preserved or fresh) manifest back to `.scaffold/manifest.json`.
5. Return the manifest.

The existing `MANIFEST_DIR`/`MANIFEST_FILE` constants and `readManifest` helper
are reused. A small `writeManifest(project, manifest)` private helper is added
to avoid duplicating the manifest-path join.

### `Editor.tsx`

Becomes async-loading with three states driven by local state
`phase: "loading" | "error" | "ready"`:

- On mount: `setPhase("loading")` → `loadProject(projectId)`:
  - `null` → show "Project not found" EmptyState (existing behavior).
  - `missing` / `corrupt` → `setPhase("error")` with the failure reason.
  - `ok` → `setPhase("ready")`, store manifest in state.
- **loading**: a simple project-loading screen (centered spinner + project name).
- **error**: recovery screen via `EmptyState` — title "This project can't be
  opened", desc with the reason, buttons **Repair project** (→ `recoverProject`
  → reload → ready; disable + show spinner while running) and **Back to
  projects**.
- **ready**: existing editor canvas (unchanged).

`phase` resets to `loading` if `projectId` changes (Re-render safety).

### Error handling

- `loadProject` never throws for manifest problems (returns a status); only
  throws for registry access failure, which the Editor catches → error screen.
- `recoverProject` failures surface as an inline error message on the recovery
  screen (button stays available to retry); the screen does not crash.

## Testing

Automated gate: `npx vite build` exits 0.
Manual:
1. Open a healthy project → brief loading screen → editor.
2. Delete a project's `.scaffold/manifest.json` → open → recovery screen →
   Repair → loads into editor with fresh files.
3. Corrupt the manifest (bad JSON) → open → recovery screen → Repair → loads.
4. Card shows the banner image (default when `bannerPath` unset).

## Out of scope

- Banner picker / uploader UI.
- Per-page loading.
- Recovery of arbitrary user-edited source files (only boilerplate is restored;
  user content in `pages` manifest data is preserved, but file-tree content
  beyond boilerplate is not).
