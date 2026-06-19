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
} from "./ipc";
import { defaultProjectDir, joinPath } from "./paths";
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
  const store = await load(STORE_FILE, { autoSave: false });
  return await fn(store);
}

/** Scaffold boilerplate project files onto an already-created project folder. */
export async function scaffoldProjectFiles(project: Project): Promise<void> {
  if (!isTauri()) return;

  const { path: projectPath, stack, template, name } = project;
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

/** List all projects recorded in the registry. */
export async function listProjects(): Promise<Project[]> {
  const result = await withStore(async (store) => {
    return (await store.get<Project[]>(REGISTRY_KEY)) ?? [];
  });
  return result ?? [];
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

/** Move a project to the archive (marks it archived in the registry). */
export async function archiveProject(id: string): Promise<void> {
  await withStore(async (store) => {
    const current = (await store.get<Project[]>(REGISTRY_KEY)) ?? [];
    const updated = current.map((p) =>
      p.id === id ? { ...p, archived: true, archivedAt: Date.now() } : p
    );
    await store.set(REGISTRY_KEY, updated);
    await store.save();
  });
}

/** Restore an archived project back to active. */
export async function restoreProject(id: string): Promise<void> {
  await withStore(async (store) => {
    const current = (await store.get<Project[]>(REGISTRY_KEY)) ?? [];
    const updated = current.map((p) =>
      p.id === id ? { ...p, archived: false, archivedAt: undefined } : p
    );
    await store.set(REGISTRY_KEY, updated);
    await store.save();
  });
}

/** Permanently delete an archived project from the registry. */
export async function permanentlyDeleteProject(id: string): Promise<void> {
  await withStore(async (store) => {
    const current = (await store.get<Project[]>(REGISTRY_KEY)) ?? [];
    const updated = current.filter((p) => p.id !== id);
    await store.set(REGISTRY_KEY, updated);
    await store.save();
  });
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

export { defaultProjectDir };
