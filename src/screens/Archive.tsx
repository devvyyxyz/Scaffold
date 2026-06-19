import { useEffect, useState } from "react";
import { useAppStore } from "../lib/store";
import {
  deleteDaysLeft,
  formatRelative,
  listProjects,
  permanentlyDeleteProject,
  restoreProject,
} from "../lib/projects";
import { basename } from "../lib/paths";
import { EmptyState } from "../components/EmptyState";
import { Button } from "../components/ui/Button";
import { Icon } from "../components/ui/Icon";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Project } from "../lib/types";
import "./screens.css";

export function Archive() {
  const navigate = useAppStore((s) => s.navigate);
  const setProjects = useAppStore((s) => s.setProjects);

  // Read the stable projects reference, then filter in the render body.
  // Filtering inside the selector would return a new array each render and
  // crash React's useSyncExternalStore ("getSnapshot should be cached").
  const projects = useAppStore((s) => s.projects);
  const archived = projects.filter((p) => p.archived);
  const [dialog, setDialog] = useState<
    | { kind: "restore"; project: Project }
    | { kind: "delete"; project: Project }
    | null
  >(null);

  const reload = () => {
    listProjects().then(setProjects);
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRestore = async () => {
    if (!dialog) return;
    await restoreProject(dialog.project.id);
    setDialog(null);
    reload();
    navigate({ name: "dashboard" });
  };

  const handleDelete = async () => {
    if (!dialog) return;
    await permanentlyDeleteProject(dialog.project.id);
    setDialog(null);
    reload();
  };

  return (
    <div className="screen">
      <div className="screenHeader">
        <div>
          <h1 className="screenTitle">Archive</h1>
          <p className="screenSub">
            Archived projects are permanently deleted after 30 days. Restore
            them any time before then.
          </p>
        </div>
      </div>

      {archived.length === 0 ? (
        <EmptyState
          icon="archive"
          title="Archive is empty"
          desc="Projects you archive will appear here for 30 days before being permanently deleted."
        />
      ) : (
        <div className="archiveList">
          {archived.map((p) => {
            const days = deleteDaysLeft(p.archivedAt);
            return (
              <div className="archiveRow" key={p.id}>
                <div className="archiveRowIcon">
                  <Icon name="layers" size={20} />
                </div>
                <div className="archiveRowMain">
                  <div className="archiveRowName">{p.name}</div>
                  <div className="archiveRowMeta">
                    <span className="stackBadge">{p.stack}</span>
                    <span className="faint mono" title={p.archivedFrom ?? p.path}>
                      {basename(p.archivedFrom ?? p.path)}
                    </span>
                  </div>
                </div>
                <div className="archiveRowRight">
                  <span
                    className={`countdownPill ${days !== null && days <= 3 ? "urgent" : ""}`}
                  >
                    {days === null
                      ? "—"
                      : days === 0
                        ? "Deletes today"
                        : `Deletes in ${days}d`}
                  </span>
                  <div className="archiveRowActions">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="folder-open"
                      onClick={() => setDialog({ kind: "restore", project: p })}
                    >
                      Restore
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="trash"
                      onClick={() => setDialog({ kind: "delete", project: p })}
                    >
                      Delete forever
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={dialog?.kind === "restore"}
        title={`Restore "${dialog?.project.name ?? ""}"?`}
        message="Move it back to your active projects so you can keep editing it."
        confirmLabel="Restore"
        onConfirm={handleRestore}
        onCancel={() => setDialog(null)}
      />

      <ConfirmDialog
        open={dialog?.kind === "delete"}
        title={`Delete "${dialog?.project.name ?? ""}" forever?`}
        message={
          <>
            This permanently removes the project folder and cannot be undone.
            Archived {formatRelative(dialog?.project.archivedAt ?? null)}.
          </>
        }
        confirmLabel="Delete forever"
        tone="danger"
        onConfirm={handleDelete}
        onCancel={() => setDialog(null)}
      />
    </div>
  );
}
