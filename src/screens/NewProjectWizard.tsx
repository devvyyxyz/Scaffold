import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useAppStore } from "../lib/store";
import { createProject, scaffoldProjectFiles, getScaffoldSteps } from "../lib/projects";
import { defaultProjectDir, basename } from "../lib/paths";
import { isTauri } from "../lib/ipc";
import { ProjectStack, ProjectTemplate, Project } from "../lib/types";
import { Button } from "../components/ui/Button";
import { Field, TextInput, OptionCard } from "../components/ui/Field";
import { Icon, IconName } from "../components/ui/Icon";
import { ProgressScreen } from "../components/shell/ProgressScreen";
import "./screens.css";

const STACKS: { value: ProjectStack; title: string; desc: string; icon: IconName }[] = [
  { value: "vite", title: "Vite", desc: "Fast SPA. React + Vite.", icon: "sparkles" },
  { value: "next", title: "Next.js", desc: "SSR / SSG. App router.", icon: "layers" },
  { value: "remix", title: "Remix", desc: "Nested routes, edge-ready.", icon: "layers" },
  { value: "plain", title: "Plain HTML", desc: "No framework. Static only.", icon: "code" },
];

const TEMPLATES: { value: ProjectTemplate; title: string; desc: string; icon: IconName }[] = [
  { value: "landing", title: "Landing Page", desc: "Hero, features, CTA.", icon: "publish" },
  { value: "blog", title: "Blog", desc: "Posts, listing, article.", icon: "editor" },
  { value: "docs", title: "Docs", desc: "Sidebar, content, search.", icon: "folder-open" },
  { value: "blank", title: "Blank", desc: "Start from scratch.", icon: "plus" },
];

export function NewProjectWizard() {
  const navigate = useAppStore((s) => s.navigate);
  const upsertProject = useAppStore((s) => s.upsertProject);
  const settings = useAppStore((s) => s.settings);

  const [name, setName] = useState("");
  const [stack, setStack] = useState<ProjectStack>(settings.defaultStack);
  const [template, setTemplate] = useState<ProjectTemplate>("landing");
  const [parentDir, setParentDir] = useState<string>(settings.defaultProjectDir ?? "");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdProject, setCreatedProject] = useState<Project | null>(null);

  async function ensureParentDir() {
    if (!parentDir) {
      const d = await defaultProjectDir();
      setParentDir(d);
    }
  }

  async function pickFolder() {
    if (!isTauri()) {
      setParentDir("/tmp/Scaffold-projects");
      return;
    }
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string") setParentDir(selected);
  }

  async function handleCreate() {
    setError(null);
    if (!name.trim()) {
      setError("Please enter a project name.");
      return;
    }
    setCreating(true);
    try {
      await ensureParentDir();
      const project = await createProject({
        name: name.trim(),
        stack,
        template,
        parentDir,
      });
      setCreatedProject(project);
      // Loading screen takes over via scaffoldSteps
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setCreating(false);
    }
  }

  async function handleScaffoldStep(index: number): Promise<boolean | void> {
    if (!createdProject) return false;

    switch (index) {
      case 0:
        // Folder already created by createProject; no extra work needed
        break;
      case 1:
        // Write all boilerplate files
        await scaffoldProjectFiles(createdProject);
        break;
      case 4:
        // Register the project in the store
        upsertProject(createdProject);
        break;
    }
  }

  function handleScaffoldComplete() {
    navigate({ name: "editor", projectId: createdProject!.id });
  }

  // Show loading screen during scaffolding
  if (creating && createdProject) {
    return (
      <ProgressScreen
        steps={getScaffoldSteps()}
        onStep={handleScaffoldStep}
        onComplete={handleScaffoldComplete}
      />
    );
  }

  return (
    <div className="screen">
      <div className="screenHeader">
        <div>
          <h1 className="screenTitle">New Project</h1>
          <p className="screenSub">A folder and manifest will be created locally.</p>
        </div>
        <Button variant="ghost" icon="close" onClick={() => navigate({ name: "dashboard" })}>
          Cancel
        </Button>
      </div>

      <div className="wizard">
        <Field label="Project name" hint="Used as the folder name (sanitized automatically).">
          <TextInput
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My awesome site"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
        </Field>

        <div>
          <span className="label">Stack</span>
          <div className="optionGrid" style={{ marginTop: "var(--sp-2)" }}>
            {STACKS.map((s) => (
              <OptionCard
                key={s.value}
                title={s.title}
                desc={s.desc}
                icon={<Icon name={s.icon} size={18} />}
                selected={stack === s.value}
                onClick={() => setStack(s.value)}
              />
            ))}
          </div>
        </div>

        <div>
          <span className="label">Template</span>
          <div className="optionGrid" style={{ marginTop: "var(--sp-2)" }}>
            {TEMPLATES.map((t) => (
              <OptionCard
                key={t.value}
                title={t.title}
                desc={t.desc}
                icon={<Icon name={t.icon} size={18} />}
                selected={template === t.value}
                onClick={() => setTemplate(t.value)}
              />
            ))}
          </div>
        </div>

        <Field label="Location" hint="A new subfolder will be created here.">
          <div className="inputRow">
            <TextInput
              value={parentDir}
              readOnly
              placeholder="Choose a parent folder"
            />
            <Button icon="folder-open" onClick={pickFolder}>Choose</Button>
          </div>
          {parentDir && (
            <span className="hint">
              → <span className="mono">{parentDir}/{basenameLike(name)}</span>
            </span>
          )}
        </Field>

        {error && (
          <div style={{ color: "var(--danger)", fontSize: "var(--fs-sm)" }}>{error}</div>
        )}

        <div className="wizardActions">
          <Button variant="ghost" onClick={() => navigate({ name: "dashboard" })}>
            Back
          </Button>
          <Button variant="primary" icon="check" disabled={creating || !name.trim()} onClick={handleCreate}>
            {creating ? "Creating…" : "Create project"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function basenameLike(name: string): string {
  const cleaned = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "untitled-project";
}
