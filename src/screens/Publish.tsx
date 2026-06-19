import { useAppStore } from "../lib/store";
import { EmptyState } from "../components/EmptyState";
import { Button } from "../components/ui/Button";
import { Icon, IconName } from "../components/ui/Icon";
import "./screens.css";

const TARGETS: { name: string; desc: string; icon: IconName; soon?: boolean }[] = [
  { name: "Static Export", desc: "Plain HTML / CSS / JS in a folder.", icon: "code" },
  { name: "ZIP Archive", desc: "Bundle the whole project.", icon: "folder-open" },
  { name: "Vercel", desc: "Deploy to the edge.", icon: "publish", soon: true },
  { name: "Netlify", desc: "Continuous deployment.", icon: "publish", soon: true },
  { name: "GitHub Pages", desc: "Free hosting from a repo.", icon: "github", soon: true },
  { name: "Open in IDE", desc: "Hand off to VS Code.", icon: "external" },
];

export function Publish({ projectId }: { projectId: string }) {
  const navigate = useAppStore((s) => s.navigate);
  const projects = useAppStore((s) => s.projects);
  const project = projects.find((p) => p.id === projectId);

  if (!project) {
    return (
      <div className="screen">
        <EmptyState
          icon="folder-open"
          title="Project not found"
          actions={<Button variant="primary" onClick={() => navigate({ name: "dashboard" })}>Back to projects</Button>}
        />
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="screenHeader">
        <div>
          <h1 className="screenTitle">Publish</h1>
          <p className="screenSub">Export or deploy “{project.name}”.</p>
        </div>
        <Button variant="ghost" icon="editor" onClick={() => navigate({ name: "editor", projectId })}>
          Back to editor
        </Button>
      </div>

      <div className="card">
        <div className="cardTitle">Export targets</div>
        <div className="deployGrid">
          {TARGETS.map((t) => (
            <button key={t.name} className="deployTarget" disabled={t.soon}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Icon name={t.icon} size={18} />
                {t.soon && <span className="comingSoon">Soon</span>}
              </div>
              <span className="deployName">{t.name}</span>
              <span className="deployDesc">{t.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="cardTitle">Deploy history</div>
        <EmptyState
          icon="publish"
          title="No deploys yet"
          desc="Once you export, past deploys will show up here with status and logs."
        />
      </div>
    </div>
  );
}
