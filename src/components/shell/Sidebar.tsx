import { useAppStore } from "../../lib/store";
import { Route } from "../../lib/types";
import { Icon, IconName } from "../ui/Icon";
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
  { route: { name: "settings" }, label: "Settings", icon: "settings", match: ["settings"] },
];

export function Sidebar() {
  const route = useAppStore((s) => s.route);
  const navigate = useAppStore((s) => s.navigate);
  const projects = useAppStore((s) => s.projects);

  const recent = projects.slice(0, 4);

  return (
    <nav className="sidebar">
      <div className="brand">
        <div className="brandMark">
          <Icon name="logo" size={16} />
        </div>
        <span className="brandName">Scaffold</span>
      </div>

      <Button
        variant="primary"
        icon="plus"
        block
        onClick={() => navigate({ name: "new-project" })}
      >
        New Project
      </Button>

      <div className="nav" style={{ marginTop: "var(--sp-3)" }}>
        {NAV.map((entry) => (
          <button
            key={entry.label}
            className={`navItem ${entry.match.includes(route.name) ? "active" : ""}`}
            onClick={() => navigate(entry.route)}
          >
            <Icon name={entry.icon} size={17} />
            {entry.label}
          </button>
        ))}

        {recent.length > 0 && (
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
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.name}
                </span>
              </button>
            ))}
          </>
        )}
      </div>

      <div className="footer">
        <button
          className="navItem"
          onClick={() => navigate({ name: "settings" })}
        >
          <Icon name="settings" size={16} />
          Preferences
        </button>
      </div>
    </nav>
  );
}
