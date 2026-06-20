import { useEffect, useState } from "react";
import { Command } from "@tauri-apps/plugin-shell";
import { useAppStore } from "../lib/store";
import {
  ARCHIVE_RETENTION_DAYS,
  archiveProject,
  duplicateProject,
  listProjects,
  formatRelative,
} from "../lib/projects";
import { basename } from "../lib/paths";
import { isTauri } from "../lib/ipc";
import { EmptyState } from "../components/EmptyState";
import { Button } from "../components/ui/Button";
import { Icon } from "../components/ui/Icon";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Project, ProjectStack, ProjectTemplate } from "../lib/types";
import "./screens.css";

/** Reveal a project folder in the OS file manager (Finder/Explorer). */
function revealProject(path: string) {
  if (isTauri()) Command.create("open", [path]).execute();
}

function getStackIcon(stack: ProjectStack): IconName {
  switch (stack) {
    case "vite":
      return "code";
    case "next":
      return "layers";
    case "remix":
      return "package";
    case "plain":
    default:
      return "folder";
  }
}

export function Dashboard() {
  const navigate = useAppStore((s) => s.navigate);
  const setProjects = useAppStore((s) => s.setProjects);
  const settings = useAppStore((s) => s.settings);
  // Read the stable projects reference, then filter in the render body.
  // Filtering inside the selector would return a new array each render and
  // crash React's useSyncExternalStore ("getSnapshot should be cached").
  const projects = useAppStore((s) => s.projects);
  const active = projects.filter((p) => !p.archived);
  const recent = active.slice(0, 4);
  const view = settings.dashboardView;

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
              ? "Manage and organize your active workspaces."
              : "Create your first visual React site."}
          </p>
        </div>
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
        <>
          {recent.length > 0 && (
            <section className="recentlyOpened">
              <h2 className="recentlyOpenedTitle">Recently Opened</h2>
              <div className="recentlyOpenedRow">
                {recent.map((p) => (
                  <button
                    key={p.id}
                    className="recentCard"
                    onClick={() => navigate({ name: "editor", projectId: p.id })}
                    title={p.name}
                  >
                    <span className="recentCardIcon">
                      <Icon name={getStackIcon(p.stack)} size={20} />
                    </span>
                    <span className="recentCardBody">
                      <span className="recentCardName">{p.name}</span>
                      <span className="recentCardTime">{formatRelative(p.lastEditedAt ?? p.updatedAt)}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {view === "list" ? (
            <div className="projectList">
              {active.map((p) => (
                <ProjectRow
                  key={p.id}
                  project={p}
                  onOpen={() => navigate({ name: "editor", projectId: p.id })}
                  onChanged={reload}
                />
              ))}
            </div>
          ) : (
            <div className="projectGrid">
              {active.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  onOpen={() => navigate({ name: "editor", projectId: p.id })}
                />
              ))}
            </div>
          )}
        </>
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

function ProjectCard({
  project,
  onOpen,
}: {
  project: Project;
  onOpen: () => void;
}) {
  return (
    <div className="projectCard">
      <div className="projectThumb" onClick={onOpen}>
        <img
          src={project.bannerPath || "/Scaffold/banner.png"}
          alt=""
          onError={(e) => {
            // If the banner image fails to load, hide the img so the
            // gradient background shows through instead of a broken icon.
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
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
      </div>
    </div>
  );
}

function ProjectRow({
  project,
  onOpen,
  onChanged,
}: {
  project: Project;
  onOpen: () => void;
  onChanged: () => void;
}) {
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [confirmingDuplicate, setConfirmingDuplicate] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  const handleArchive = async () => {
    await archiveProject(project.id);
    setConfirmingArchive(false);
    onChanged();
  };

  const handleDuplicate = async () => {
    setDuplicating(true);
    try {
      await duplicateProject(project.id);
      onChanged();
    } finally {
      setDuplicating(false);
    }
    setConfirmingDuplicate(false);
  };

  return (
    <div className="projectRow">
      <div className="projectRowThumb" onClick={onOpen}>
        <img
          src={project.bannerPath || "/Scaffold/banner.png"}
          alt=""
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      </div>
      <div className="projectRowMain" onClick={onOpen}>
        <span className="projectRowName">{project.name}</span>
        <span className="projectRowPath mono" title={project.path}>
          {basename(project.path)}
        </span>
      </div>
      <div className="projectRowMeta">
        <span className="stackBadge">{project.stack}</span>
        <span className="projectRowEdited">
          {formatRelative(project.lastEditedAt ?? project.updatedAt)}
        </span>
      </div>
      <div className="projectRowActions">
        <Button
          variant="ghost"
          size="sm"
          icon="external"
          onClick={() => revealProject(project.path)}
          title="Show in Folder"
          aria-label={`Show ${project.name} in folder`}
        />
          <Button
            variant="ghost"
            size="sm"
            icon="copy"
            disabled={duplicating}
            onClick={() => setConfirmingDuplicate(true)}
            title="Duplicate"
            aria-label={`Duplicate ${project.name}`}
          />
        <Button
          variant="ghost"
          size="sm"
          icon="archive"
          onClick={() => setConfirmingArchive(true)}
          title="Archive"
          aria-label={`Archive ${project.name}`}
        />
      </div>

      <ConfirmDialog
        open={confirmingArchive}
        title={`Archive "${project.name}"?`}
        message={
          <>
            It will be moved to the Archive and permanently deleted in{" "}
            {ARCHIVE_RETENTION_DAYS} days. You can restore it any time before then.
          </>
        }
        confirmLabel="Archive"
        tone="default"
        onConfirm={handleArchive}
        onCancel={() => setConfirmingArchive(false)}
      />
      <ConfirmDialog
        open={confirmingDuplicate}
        title={`Duplicate "${project.name}"?`}
        message={
          <>
            This will create a copy of the project in your projects folder.
          </>
        }
        confirmLabel="Duplicate"
        tone="default"
        onConfirm={handleDuplicate}
        onCancel={() => setConfirmingDuplicate(false)}
      />
    </div>
  );
}

export type { ProjectStack, ProjectTemplate };