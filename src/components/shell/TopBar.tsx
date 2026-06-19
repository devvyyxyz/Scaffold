import { useAppStore } from "../../lib/store";
import { Button } from "../ui/Button";
import "./TopBar.css";

const TITLES: Record<string, string> = {
  dashboard: "Projects",
  "new-project": "New Project",
  editor: "Editor",
  publish: "Publish",
  settings: "Settings",
};

export function TopBar() {
  const route = useAppStore((s) => s.route);
  const navigate = useAppStore((s) => s.navigate);
  const projects = useAppStore((s) => s.projects);

  let title = TITLES[route.name] ?? "Scaffold";
  let actions: React.ReactNode = null;

  if (route.name === "editor") {
    const project = projects.find((p) => p.id === route.projectId);
    title = project?.name ?? "Editor";
    actions = (
      <>
        <Button variant="ghost" size="sm" icon="publish" onClick={() => navigate({ name: "publish", projectId: route.projectId })}>
          Publish
        </Button>
        <Button variant="secondary" size="sm" icon="eye">Preview</Button>
      </>
    );
  }

  if (route.name === "dashboard") {
    actions = (
      <Button variant="primary" size="sm" icon="plus" onClick={() => navigate({ name: "new-project" })}>
        New Project
      </Button>
    );
  }

  if (route.name === "publish") {
    actions = (
      <Button variant="ghost" size="sm" icon="editor" onClick={() => {
        const pid = route.projectId;
        navigate({ name: "editor", projectId: pid });
      }}>
        Back to Editor
      </Button>
    );
  }

  return (
    <div className="topbar">
      <div className="left">
        <div className="crumb">
          <strong>{title}</strong>
        </div>
      </div>
      <div className="right">
        <div className="saveBadge">
          <span className="saveDot" />
          Saved locally
        </div>
        {actions}
      </div>
    </div>
  );
}
