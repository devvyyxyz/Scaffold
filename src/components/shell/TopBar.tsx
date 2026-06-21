import { useAppStore } from "../../lib/store";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";
import { openDocsWindow } from "../../lib/ipc";
import "./TopBar.css";

const TITLES: Record<string, string> = {
  dashboard: "Projects",
  "new-project": "New Project",
  editor: "Editor",
  publish: "Publish",
  settings: "Settings",
};

type SortKey = "recent" | "name" | "created";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "recent", label: "Recently modified" },
  { value: "name", label: "Name" },
  { value: "created", label: "Creation date" },
];

export function TopBar() {
  const route = useAppStore((s) => s.route);
  const navigate = useAppStore((s) => s.navigate);
  const projects = useAppStore((s) => s.projects);
  const view = useAppStore((s) => s.settings.dashboardView);
  const setDashboardView = useAppStore((s) => s.setDashboardView);
  const sortKey = useAppStore((s) => s.settings.projectSort);
  const setProjectSort = useAppStore((s) => s.setProjectSort);

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
      </>
    );
  }

  if (route.name === "dashboard") {
    actions = (
      <>
        <Button variant="ghost" size="sm" icon="book" onClick={() => openDocsWindow()}>
          Docs
        </Button>
        <Button variant="primary" size="sm" icon="plus" onClick={() => navigate({ name: "new-project" })}>
          New Project
        </Button>
      </>
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
      <div className="topbarLeft">
        <span className="topbarTitle">{title}</span>
      </div>

      <div className="topbarCenter">
        {route.name === "dashboard" && (
          <>
            <div className="topbarSortBar">
              <Icon name="arrow-up-down" size={14} className="topbarSortIcon" />
              <select
                className="topbarSortSelect"
                value={sortKey}
                onChange={(e) => void setProjectSort(e.target.value as SortKey)}
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="topbarViewToggle" role="group" aria-label="Project view">
              <button
                type="button"
                className={`topbarViewBtn ${view === "grid" ? "active" : ""}`}
                onClick={() => setDashboardView("grid")}
                aria-pressed={view === "grid"}
                title="Grid view"
              >
                <Icon name="grid" size={14} />
              </button>
              <button
                type="button"
                className={`topbarViewBtn ${view === "list" ? "active" : ""}`}
                onClick={() => setDashboardView("list")}
                aria-pressed={view === "list"}
                title="List view"
              >
                <Icon name="list" size={14} />
              </button>
            </div>
          </>
        )}
      </div>

      <div className="topbarRight">
        <button
          className="topbarIconBtn topbarCmdBtn"
          onClick={() => {
            // Dispatch Cmd+K programmatically — the App listener handles it.
            window.dispatchEvent(new KeyboardEvent("keydown", {
              metaKey: true,
              key: "k",
              bubbles: true,
            }));
          }}
          title="Command palette (⌘K)"
        >
          <Icon name="search" size={14} />
          <span className="topbarCmdHint">⌘K</span>
        </button>

        <button className="topbarIconBtn" title="Notifications" aria-label="Notifications">
          <Icon name="bell" size={16} />
        </button>

        <div className="topbarDivider" />

        <button className="topbarAvatarBtn" title="Profile" aria-label="Profile">
          <Icon name="user" size={16} />
        </button>
      </div>
    </div>
  );
}