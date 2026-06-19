import { useEffect } from "react";
import { useAppStore } from "../lib/store";
import { listProjects, formatRelative } from "../lib/projects";
import { basename } from "../lib/paths";
import { EmptyState } from "../components/EmptyState";
import { Button } from "../components/ui/Button";
import { Icon } from "../components/ui/Icon";
import { Project, ProjectStack, ProjectTemplate } from "../lib/types";
import "./screens.css";

export function Dashboard() {
  const navigate = useAppStore((s) => s.navigate);
  const projects = useAppStore((s) => s.projects);
  const setProjects = useAppStore((s) => s.setProjects);
  const settings = useAppStore((s) => s.settings);

  useEffect(() => {
    listProjects().then(setProjects);
  }, [setProjects]);

  return (
    <div className="screen">
      <div className="screenHeader">
        <div>
          <h1 className="screenTitle">Projects</h1>
          <p className="screenSub">
            {projects.length > 0
              ? `${projects.length} project${projects.length === 1 ? "" : "s"}`
              : "Create your first visual React site."}
          </p>
        </div>
        <Button variant="primary" icon="plus" onClick={() => navigate({ name: "new-project" })}>
          New Project
        </Button>
      </div>

      {projects.length === 0 ? (
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
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} onOpen={() => navigate({ name: "editor", projectId: p.id })} />
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

function ProjectCard({ project, onOpen }: { project: Project; onOpen: () => void }) {
  return (
    <div className="projectCard" onClick={onOpen}>
      <div className="projectThumb">
        <Icon name="layers" size={36} />
      </div>
      <div className="projectBody"><span className="projectName">{project.name}</span><br/>
      <span className="stackBadge">{project.stack}</span>
      <Button variant="ghost" size="sm" icon="close" className="float-right"
              onClick={() => {
                // Remove the project
                Scaffold.store.removeProject(project.id);
              }}
      >Action</Button></div>
          <span>{formatRelative(project.lastEditedAt ?? project.updatedAt)}</span>
        </div>
        <span className="faint mono" style={{ fontSize: 11, marginTop: 2 }} title={project.path}>
          {basename(project.path)}
        </span>
      </div>
    </div>
  );
}

export type { ProjectStack, ProjectTemplate };
