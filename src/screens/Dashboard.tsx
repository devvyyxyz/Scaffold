import { useEffect, useState } from "react";
import { useAppStore } from "../lib/store";
import {
  ARCHIVE_RETENTION_DAYS,
  archiveProject,
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

export function Dashboard() {
  const navigate = useAppStore((s) => s.navigate);
  const setProjects = useAppStore((s) => s.setProjects);
  const settings = useAppStore((s) => s.settings);

  // Read the stable projects reference, then filter in the render body.
  // Filtering inside the selector would return a new array each render and
  // crash React's useSyncExternalStore ("getSnapshot should be cached").
  const projects = useAppStore((s) => s.projects);
  const active = projects.filter((p) => !p.archived);

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
            {ARCHIVE_RETENTION_DAYS} days. You can restore it any time before then.
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
