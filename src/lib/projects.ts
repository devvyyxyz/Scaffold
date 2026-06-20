// Project registry.
//
// A "project" is a folder on disk containing a `.scaffold/manifest.json`
// marker plus an in-app registry entry. The registry (list of known projects
// by path) is persisted alongside settings in the plugin-store so the
// dashboard can populate without scanning the whole filesystem.
//
// NOTE: This phase creates folders + manifests only. Actual stack
// scaffolding (`npm create vite`, etc.) is deferred to a later phase.

import { load } from "@tauri-apps/plugin-store";
import {
  isTauri,
  fsExists,
  fsMkdir,
  fsReadTextFile,
  fsWriteTextFile,
  fsRemove,
  fsMoveDir,
  fsCopyDir,
} from "./ipc";
import { archiveDir, basename, defaultProjectDir, joinPath } from "./paths";
import {
  Project,
  ProjectManifest,
  ProjectStack,
  ProjectTemplate,
} from "./types";

const STORE_FILE = "settings.json";
const REGISTRY_KEY = "projectRegistry";
const MANIFEST_DIR = ".scaffold";
const MANIFEST_FILE = "manifest.json";

/** Archived projects older than this are purged on startup. */
export const ARCHIVE_RETENTION_DAYS = 30;
const ARCHIVE_RETENTION_MS = ARCHIVE_RETENTION_DAYS * 24 * 60 * 60 * 1000;

/** Generate a short unique id without a uuid dep. */
function uid(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  ).toLowerCase();
}

async function withStore<T>(
  fn: (store: Awaited<ReturnType<typeof load>>) => Promise<T>
): Promise<T | null> {
  if (!isTauri()) return null;
  const store = await load(STORE_FILE, { autoSave: false, defaults: {} });
  return await fn(store);
}

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

/** Sync parent-directory extraction from a path string. */
function dirnameSafe(p: string): string | null {
  const norm = p.replace(/\\/g, "/");
  const idx = norm.lastIndexOf("/");
  return idx > 0 ? norm.slice(0, idx) : null;
}

/** Scaffold boilerplate project files onto an already-created project folder. */
export async function scaffoldProjectFiles(project: Project): Promise<void> {
  if (!isTauri()) return;

  const { path: projectPath, template, name } = project;
  const srcDir = await joinPath(projectPath, "src");

  // ── Common files ──
  await fsMkdir(srcDir);

  // .gitignore
  await fsWriteTextFile(
    await joinPath(projectPath, ".gitignore"),
    `node_modules
dist
.DS_Store
*.local
`
  );

  // package.json
  await fsWriteTextFile(
    await joinPath(projectPath, "package.json"),
    JSON.stringify(
      {
        name: name.toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
        private: true,
        version: "0.0.1",
        type: "module",
        scripts: {
          dev: "vite",
          build: "vite build",
          preview: "vite preview",
        },
      },
      null,
      2
    )
  );

  // index.html
  const title = name;
  await fsWriteTextFile(
    await joinPath(projectPath, "index.html"),
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`
  );

  // src/main.tsx
  await fsWriteTextFile(
    await joinPath(srcDir, "main.tsx"),
    `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
`
  );

  // src/index.css
  await fsWriteTextFile(
    await joinPath(srcDir, "index.css"),
    `*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { font-family: system-ui, -apple-system, sans-serif; color: #111; background: #fff; }
`
  );

  // ── Template-specific component ──
  const tplComponent = template === "landing"
    ? `export default function App() {
  return (
    <main style={{ padding: "4rem 2rem", maxWidth: 720, margin: "0 auto" }}>
      <h1>${name}</h1>
      <p style={{ marginTop: "1rem", color: "#555" }}>
        Built with Scaffold &mdash; a local-first visual site builder.
      </p>
    </main>
  );
}`
    : template === "blog"
      ? `export default function App() {
  const posts = [
    { title: "Getting started", excerpt: "Learn how to build with Scaffold." },
    { title: "Customisation", excerpt: "Tweak styles, add blocks, export anytime." },
  ];
  return (
    <main style={{ padding: "4rem 2rem", maxWidth: 720, margin: "0 auto" }}>
      <h1>${name}</h1>
      <nav style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
        {posts.map((p) => (
          <article key={p.title} style={{ flex: 1, padding: "1rem", border: "1px solid #ddd", borderRadius: 8 }}>
            <h2 style={{ fontSize: "1.1rem" }}>{p.title}</h2>
            <p style={{ marginTop: "0.5rem", color: "#555" }}>{p.excerpt}</p>
          </article>
        ))}
      </nav>
    </main>
  );
}`
      : template === "docs"
        ? `export default function App() {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside style={{ width: 220, padding: "2rem 1rem", borderRight: "1px solid #ddd" }}>
        <h2 style={{ fontSize: "1rem" }}>${name}</h2>
        <nav style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem", color: "#555" }}>
          <span>Introduction</span>
          <span>Installation</span>
          <span>Usage</span>
          <span>API</span>
        </nav>
      </aside>
      <main style={{ flex: 1, padding: "4rem 2rem", maxWidth: 640 }}>
        <h1>Introduction</h1>
        <p style={{ marginTop: "1rem", color: "#555" }}>
          Welcome to the ${name} documentation.
        </p>
      </main>
    </div>
  );
}`
        : // blank
          `export default function App() {
  return (
    <main style={{ padding: "4rem 2rem", maxWidth: 720, margin: "0 auto" }}>
      <h1>${name}</h1>
    </main>
  );
}`;

  // src/App.tsx
  await fsWriteTextFile(await joinPath(srcDir, "App.tsx"), tplComponent);
}

/** Scaffolding steps displayed on the loading screen. */
export function getScaffoldSteps(): { label: string; weight: number }[] {
  return [
    { label: "Creating project folder…", weight: 10 },
    { label: "Writing config files…", weight: 20 },
    { label: "Scaffolding source code…", weight: 35 },
    { label: "Setting up template…", weight: 25 },
    { label: "Registering project…", weight: 10 },
  ];
}

/** Create a new project: makes the folder, writes the manifest, registers it. */
export async function createProject(input: {
  name: string;
  stack: ProjectStack;
  template: ProjectTemplate;
  /** Parent directory; defaults to the user's default project dir. */
  parentDir?: string;
}): Promise<Project> {
  const parent = input.parentDir ?? (await defaultProjectDir());
  const folderName = sanitizeFolderName(input.name);
  const projectPath = await joinPath(parent, folderName);
  const now = Date.now();

  const project: Project = {
    id: uid(),
    name: input.name.trim(),
    stack: input.stack,
    template: input.template,
    path: projectPath,
    createdAt: now,
    updatedAt: now,
    lastEditedAt: null,
  };

  const manifest: ProjectManifest = {
    schemaVersion: 1,
    id: project.id,
    name: project.name,
    stack: project.stack,
    template: project.template,
    createdAt: now,
    updatedAt: now,
    pages: [],
  };

  if (isTauri()) {
    // Create parent (recursive) + project folder + .scaffold subdir.
    await fsMkdir(parent);
    await fsMkdir(projectPath);
    const manifestDir = await joinPath(projectPath, MANIFEST_DIR);
    await fsMkdir(manifestDir);
    const manifestPath = await joinPath(manifestDir, MANIFEST_FILE);
    await fsWriteTextFile(manifestPath, JSON.stringify(manifest, null, 2));
  }

  await registerProject(project);
  return project;
}

/** Read the manifest from a project folder, if present. */
export async function readManifest(
  projectPath: string
): Promise<ProjectManifest | null> {
  if (!isTauri()) return null;
  const manifestPath = await joinPath(projectPath, MANIFEST_DIR, MANIFEST_FILE);
  if (!(await fsExists(manifestPath))) return null;
  try {
    const raw = await fsReadTextFile(manifestPath);
    return JSON.parse(raw) as ProjectManifest;
  } catch {
    return null;
  }
}

/** Write the manifest into a project folder, creating the .scaffold dir. */
async function writeManifest(
  projectPath: string,
  manifest: ProjectManifest
): Promise<void> {
  if (!isTauri()) return;
  const manifestDir = await joinPath(projectPath, MANIFEST_DIR);
  await fsMkdir(manifestDir);
  const manifestPath = await joinPath(manifestDir, MANIFEST_FILE);
  await fsWriteTextFile(manifestPath, JSON.stringify(manifest, null, 2));
}

/** Build a fresh manifest from a registry Project (used on create + recover). */
function freshManifest(project: Project): ProjectManifest {
  const now = Date.now();
  return {
    schemaVersion: 1,
    id: project.id,
    name: project.name,
    stack: project.stack,
    template: project.template,
    createdAt: project.createdAt || now,
    updatedAt: now,
    pages: [],
  };
}

/** List all projects recorded in the registry. */
export async function listProjects(): Promise<Project[]> {
  return await readRegistry();
}

/** Add or replace a project in the registry. */
export async function registerProject(project: Project): Promise<void> {
  await withStore(async (store) => {
    const current = (await store.get<Project[]>(REGISTRY_KEY)) ?? [];
    const idx = current.findIndex((p) => p.id === project.id);
    const next =
      idx >= 0
        ? current.map((p) => (p.id === project.id ? project : p))
        : [project, ...current];
    await store.set(REGISTRY_KEY, next);
    await store.save();
  });
}

/** Remove a project from the registry (does not delete files on disk). */
export async function unregisterProject(id: string): Promise<void> {
  await withStore(async (store) => {
    const current = (await store.get<Project[]>(REGISTRY_KEY)) ?? [];
    await store.set(
      REGISTRY_KEY,
      current.filter((p) => p.id !== id)
    );
    await store.save();
  });
}

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

/** Duplicate a project: copies its folder and registers the copy with a new
 *  id + name. The on-disk manifest of the copy is rewritten to match its new
 *  identity. Files on disk are duplicated; nothing in the original changes.
 *  Returns the newly created project, or null in browser/demo mode. */
export async function duplicateProject(id: string): Promise<Project | null> {
  const projects = await readRegistry();
  const project = projects.find((p) => p.id === id);
  if (!project) throw new Error(`Project not found: ${id}`);

  // New folder: sibling of the original, with a "copy" suffix, de-duplicated.
  const parent = dirnameSafe(project.path) ?? (await defaultProjectDir());
  const baseName = basename(project.path);
  const newPath = await uniquePath(parent, `${baseName}-copy`);

  // New registry entry: fresh id, name suffixed and de-duplicated vs siblings.
  const newName = uniqueName(project.name, projects);
  const now = Date.now();
  const copy: Project = {
    ...project,
    id: uid(),
    name: newName,
    path: newPath,
    createdAt: now,
    updatedAt: now,
    // The duplicate has never been opened in the editor of its own accord.
    lastEditedAt: null,
    // A duplicate is never archived.
    archived: undefined,
    archivedAt: undefined,
    archivedFrom: undefined,
  };

  if (isTauri()) {
    // Copy the folder tree first; if this throws we leave the registry alone.
    await fsMkdir(parent);
    await fsCopyDir(project.path, newPath);

    // Rewrite the copied manifest so it owns its new identity.
    const existing = await readManifest(newPath);
    const manifest: ProjectManifest = existing
      ? {
          ...existing,
          id: copy.id,
          name: copy.name,
          createdAt: now,
          updatedAt: now,
        }
      : freshManifest(copy);
    await writeManifest(newPath, manifest);
  }

  await registerProject(copy);
  return copy;
}

/** Pick a non-colliding folder path inside `parent` from a base name. */
async function uniquePath(parent: string, baseName: string): Promise<string> {
  let candidate = await joinPath(parent, baseName);
  if (!(await fsExists(candidate))) return candidate;
  for (let i = 2; i < 1000; i++) {
    candidate = await joinPath(parent, `${baseName}-${i}`);
    if (!(await fsExists(candidate))) return candidate;
  }
  // Extremely unlikely fallthrough: append a short unique id.
  return await joinPath(parent, `${baseName}-${uid().slice(0, 6)}`);
}

/** De-dupe a display name against existing project names ("My Site" -> "My Site copy", "My Site copy 2", …). */
function uniqueName(name: string, projects: Project[]): string {
  const taken = new Set(projects.map((p) => p.name));
  if (!taken.has(`${name} copy`)) return `${name} copy`;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${name} copy ${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${name} copy ${uid().slice(0, 6)}`;
}

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

// ---------------------------------------------------------------------------
// Project loading + recovery
// ---------------------------------------------------------------------------

/** Outcome of loading a project's on-disk data. */
export type ProjectLoadResult =
  | { status: "ok"; project: Project; manifest: ProjectManifest }
  | { status: "missing"; project: Project } // manifest file absent
  | { status: "corrupt"; project: Project }; // manifest present but unreadable

/** Load a project from the registry and validate its on-disk manifest.
 *  Returns `null` if the project is not in the registry at all. Never throws
 *  for manifest problems (those become a status). */
export async function loadProject(
  projectId: string
): Promise<ProjectLoadResult | null> {
  const projects = await readRegistry();
  const project = projects.find((p) => p.id === projectId);
  if (!project) return null;

  if (!isTauri()) {
    // Browser/demo mode: treat in-memory project as healthy.
    return { status: "ok", project, manifest: freshManifest(project) };
  }

  const manifestPath = await joinPath(project.path, MANIFEST_DIR, MANIFEST_FILE);
  if (!(await fsExists(manifestPath))) {
    return { status: "missing", project };
  }

  let manifest: ProjectManifest;
  try {
    const raw = await fsReadTextFile(manifestPath);
    manifest = JSON.parse(raw) as ProjectManifest;
  } catch {
    return { status: "corrupt", project };
  }

  // Shape sanity check: a usable manifest must identify itself.
  if (typeof manifest.id !== "string" || typeof manifest.name !== "string") {
    return { status: "corrupt", project };
  }

  return { status: "ok", project, manifest };
}

/** Re-scaffold a project's boilerplate files, preserving the manifest where
 *  possible. Returns the recovered manifest. Throws if the project isn't in
 *  the registry or if scaffolding itself fails. */
export async function recoverProject(
  projectId: string
): Promise<ProjectManifest> {
  const projects = await readRegistry();
  const project = projects.find((p) => p.id === projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);

  // Re-write the boilerplate files (package.json, index.html, src/*, ...).
  await scaffoldProjectFiles(project);

  // Preserve the existing manifest where we can; fall back to a fresh one.
  const existing = await readManifest(project.path);
  const manifest: ProjectManifest = existing
    ? { ...existing, updatedAt: Date.now() }
    : freshManifest(project);

  await writeManifest(project.path, manifest);
  return manifest;
}

function sanitizeFolderName(name: string): string {
  const cleaned = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "untitled-project";
}

/** Format a timestamp for display. */
export function formatRelative(ts: number | null): string {
  if (!ts) return "never";
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(ts).toLocaleDateString();
}

/** Whole days remaining before an archived project is auto-deleted (min 0). */
export function deleteDaysLeft(archivedAt: number | undefined): number | null {
  if (typeof archivedAt !== "number") return null;
  const msLeft = ARCHIVE_RETENTION_MS - (Date.now() - archivedAt);
  return Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
}

export { defaultProjectDir };
