import { useAppStore } from "../../lib/store";
import { Route } from "../../lib/types";
import { Icon, IconName } from "../ui/Icon";
import { Logo } from "../ui/Logo";
import { Button } from "../ui/Button";
import "./Sidebar.css";

interface NavEntry {
  route: Route;
  label: string;
  icon: IconName;
  match: Route["name"][];
}

const NAV: NavEntry[] = [
  { route: { name: "dashboard" }, label: "Projects", icon: "dashboard", match: ["dashboard", "new-project", "editor", "publish"] },
  { route: { name: "archive" }, label: "Archive", icon: "archive", match: ["archive"] },
  { route: { name: "settings" }, label: "Settings", icon: "settings", match: ["settings"] },
];

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  const route = useAppStore((s) => s.route);
  const navigate = useAppStore((s) => s.navigate);
  const projects = useAppStore((s) => s.projects);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);

  const recent = projects.filter((p) => !p.archived).slice(0, 4);
  const archiveCount = projects.filter((p) => p.archived).length;

  return (
    <nav className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="brand">
        <div className="brandMark">
          <Logo size={collapsed ? 22 : 16} />
        </div>
        {!collapsed && <span className="brandName">Scaffold</span>}
      </div>

      {collapsed ? (
        <button
          className="newProjectIcon"
          onClick={() => navigate({ name: "new-project" })}
          title="New Project"
          aria-label="New Project"
        >
          <Icon name="plus" size={18} />
        </button>
      ) : (
        <Button
          variant="primary"
          icon="plus"
          block
          onClick={() => navigate({ name: "new-project" })}
        >
          New Project
        </Button>
      )}

      <div className="nav" style={{ marginTop: "var(--sp-3)" }}>
        {NAV.map((entry) => {
          const count = entry.label === "Archive" ? archiveCount : 0;
          const active = entry.match.includes(route.name);
          return (
            <button
              key={entry.label}
              className={`navItem ${active ? "active" : ""}`}
              onClick={() => navigate(entry.route)}
              title={collapsed ? entry.label : undefined}
            >
              <Icon name={entry.icon} size={17} />
              {!collapsed && <span className="navLabel">{entry.label}</span>}
              {!collapsed && count > 0 && <span className="navBadge">{count}</span>}
            </button>
          );
        })}

        {!collapsed && recent.length > 0 && (
          <>
            <div className="navSection">Recent</div>
            {recent.map((p) => (
              <button
                key={p.id}
                className={`navItem ${
                  route.name === "editor" && "projectId" in route && route.projectId === p.id
                    ? "active"
                    : ""
                }`}
                onClick={() => navigate({ name: "editor", projectId: p.id })}
                title={p.path}
              >
                <Icon name="folder" size={16} />
                <span className="navRecentLabel">{p.name}</span>
              </button>
            ))}
          </>
        )}
      </div>

      <div className="footer">
        {!collapsed && (
          <button
            className="navItem"
            onClick={() => navigate({ name: "settings" })}
          >
            <Icon name="settings" size={16} />
            Preferences
          </button>
        )}

        <button
          className={`collapseToggle ${collapsed ? "is-collapsed" : ""}`}
          onClick={toggleSidebar}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <Icon name="chevron-right" size={16} />
        </button>
      </div>
    </nav>
  );
}
