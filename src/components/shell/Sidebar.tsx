import { useAppStore } from "../../lib/store";
import { Route } from "../../lib/types";
import { openDocsWindow, openExternalUrl } from "../../lib/ipc";
import { Icon, IconName } from "../ui/Icon";
import { Logo } from "../ui/Logo";
import { Button } from "../ui/Button";
import "./Sidebar.css";

interface NavEntry {
  route: Route;
  label: string;
  icon: IconName;
  match: Route["name"][];
  /** Small grey pill shown beside the label (e.g. "Coming soon"). */
  badge?: string;
  /** Dim the item and mark it as not-yet-available. */
  comingSoon?: boolean;
}

const NAV: NavEntry[] = [
  { route: { name: "dashboard" }, label: "Projects", icon: "dashboard", match: ["dashboard", "new-project", "editor", "publish"] },
  { route: { name: "archive" }, label: "Archive", icon: "archive", match: ["archive"] },
  { route: { name: "deployment-manager" }, label: "Deployment", icon: "rocket", match: ["deployment-manager"], badge: "Coming soon", comingSoon: true },
  { route: { name: "plugins" }, label: "Plugins", icon: "puzzle", match: ["plugins"], badge: "Coming soon", comingSoon: true },
  { route: { name: "settings" }, label: "Settings", icon: "settings", match: ["settings"] },
];

const DISCORD_URL = "https://discord.gg/scaffold";

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  const route = useAppStore((s) => s.route);
  const navigate = useAppStore((s) => s.navigate);
  const projects = useAppStore((s) => s.projects);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);

  const recent = projects.filter((p) => !p.archived).slice(0, 4);
  const archiveCount = projects.filter((p) => p.archived).length;

  const openDiscord = () => openExternalUrl(DISCORD_URL);

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

      <div className="navDivider" />

      <div className="nav" style={{ marginTop: "var(--sp-3)" }}>
        {NAV.map((entry) => {
          const count = entry.label === "Archive" ? archiveCount : 0;
          const active = entry.match.includes(route.name);
          return (
            <button
              key={entry.label}
              className={`navItem ${active ? "active" : ""} ${entry.comingSoon ? "comingSoon" : ""}`}
              onClick={() => navigate(entry.route)}
              title={collapsed ? `${entry.label}${entry.badge ? ` · ${entry.badge}` : ""}` : undefined}
            >
              <Icon name={entry.icon} size={17} />
              {!collapsed && <span className="navLabel">{entry.label}</span>}
              {!collapsed && entry.badge && <span className="navComingSoon">{entry.badge}</span>}
              {!collapsed && count > 0 && <span className="navBadge">{count}</span>}
            </button>
          );
        })}

      </div>

      <div className="footer">
        <button
          className="navItem"
          onClick={async () => {
            try {
              await openDocsWindow();
            } catch (e) {
              console.error("Failed to open docs:", e);
            }
          }}
          title="Help"
        >
          <Icon name="help-circle" size={16} />
          {!collapsed && <span className="navLabel">Help</span>}
        </button>

        <button
          className="navItem"
          onClick={openDiscord}
          title="Feedback"
        >
          <Icon name="message-square" size={16} />
          {!collapsed && <span className="navLabel">Feedback</span>}
        </button>

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
