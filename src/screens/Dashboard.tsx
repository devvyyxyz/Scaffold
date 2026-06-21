import { useEffect, useState, useMemo } from "react";
import { useAppStore } from "../lib/store";
import {
  ARCHIVE_RETENTION_DAYS,
  archiveProject,
  duplicateProject,
  listProjects,
  formatRelative,
} from "../lib/projects";
import { basename } from "../lib/paths";
import { isTauri, revealPath } from "../lib/ipc";
import { EmptyState } from "../components/EmptyState";
import { Button } from "../components/ui/Button";
import { Icon, IconName } from "../components/ui/Icon";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Project, ProjectStack } from "../lib/types";
import type { ProjectLoadResult } from "../lib/projects";
import "./screens.css";

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

type SortKey = "recent" | "name" | "created";

function sortProjects(projects: Project[], key: SortKey): Project[] {
  const sorted = [...projects];
  switch (key) {
    case "name":
      sorted.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
      break;
    case "created":
      sorted.sort((a, b) => b.createdAt - a.createdAt);
      break;
    case "recent":
    default:
      sorted.sort((a, b) => {
        const aTime = a.lastEditedAt ?? a.updatedAt;
        const bTime = b.lastEditedAt ?? b.updatedAt;
        return bTime - aTime;
      });
      break;
  }
  return sorted;
}

export function Dashboard() {
  const navigate = useAppStore((s) => s.navigate);
  const setProjects = useAppStore((s) => s.setProjects);
  const settings = useAppStore((s) => s.settings);
  const projects = useAppStore((s) => s.projects);
  const toggleProjectPin = useAppStore((s) => s.toggleProjectPin);
  const toggleProjectFavourite = useAppStore((s) => s.toggleProjectFavourite);

  const view = settings.dashboardView;
  const sortKey = settings.projectSort;

  // Manifest-check modal state.
  const [openError, setOpenError] = useState<ProjectLoadResult | null>(null);

  /** Attempt to open a project; shows a modal if the manifest is missing/corrupt. */
  const handleOpenProject = async (projectId: string) => {
    const result = await navigate({ name: "editor", projectId });
    // navigate returns a ProjectLoadResult when the manifest check fails.
    if (result && result.status !== "ok") {
      setOpenError(result);
    }
  };

  const closeOpenError = () => setOpenError(null);

  // Split projects into categories. Pinned always float to the top of the main
  // list; favourites get their own dedicated section above the main list.
  const { favourites, pinned, rest } = useMemo(() => {
    const active = projects.filter((p) => !p.archived);
    const favs = active.filter((p) => p.favourite && !p.pinned);
    const pins = active.filter((p) => p.pinned);
    const remaining = active.filter((p) => !p.favourite && !p.pinned);
    return { favourites: favs, pinned: pins, rest: remaining };
  }, [projects]);

  // Recently opened = the first N by modification time (across all active).
  const recent = useMemo(
    () => sortProjects(projects.filter((p) => !p.archived), "recent").slice(0, 6),
    [projects],
  );

  const reload = () => {
    listProjects().then(setProjects);
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeCount = projects.filter((p) => !p.archived).length;

  return (
    <div className="screen">
      <div className="screenHeader">
        <div>
          <h1 className="screenTitle">Projects</h1>
          <p className="screenSub">
            {activeCount > 0
              ? "Manage and organize your active workspaces."
              : "Create your first visual React site."}
          </p>
        </div>
      </div>

      {activeCount === 0 ? (
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
          {/* ── Recently opened (horizontal strip) ── */}
          {recent.length > 0 && (
            <section className="recentlyOpened">
              <h2 className="recentlyOpenedTitle">Recently Opened</h2>
              <div className="recentlyOpenedRow">
                {recent.map((p) => (
                  <button
                    key={p.id}
                    className="recentCard"
                    onClick={() => handleOpenProject(p.id)}
                    title={p.name}
                  >
                    <span className="recentCardIcon">
                      <Icon name={getStackIcon(p.stack)} size={20} />
                    </span>
                    <span className="recentCardBody">
                      <span className="recentCardName">
                        {p.pinned && <Icon name="pin" size={11} className="inlineBadge" />}
                        {p.favourite && <Icon name="star" size={11} className="inlineBadge star" />}
                        {p.name}
                      </span>
                      <span className="recentCardTime">{formatRelative(p.lastEditedAt ?? p.updatedAt)}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* ── Favourites section ── */}
          {favourites.length > 0 && (
            <section className="projectSection">
              <h2 className="projectSectionTitle">
                <Icon name="star" size={14} className="projectSectionIcon star" />
                Favourites
              </h2>
              {view === "list" ? (
                <div className="projectList">
                  {sortProjects(favourites, sortKey).map((p) => (
                    <ProjectRow
                      key={p.id}
                      project={p}
                      onOpen={() => handleOpenProject(p.id)}
                      onChanged={reload}
                      onTogglePin={() => toggleProjectPin(p.id)}
                      onToggleFavourite={() => toggleProjectFavourite(p.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="projectGrid">
                  {sortProjects(favourites, sortKey).map((p) => (
                    <ProjectCard
                      key={p.id}
                      project={p}
                      onOpen={() => handleOpenProject(p.id)}
                      onTogglePin={() => toggleProjectPin(p.id)}
                      onToggleFavourite={() => toggleProjectFavourite(p.id)}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ── Pinned section ── */}
          {pinned.length > 0 && (
            <section className="projectSection">
              <h2 className="projectSectionTitle">
                <Icon name="pin" size={14} className="projectSectionIcon" />
                Pinned
              </h2>
              <div className="projectGrid">
                {pinned.map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    onOpen={() => handleOpenProject(p.id)}
                    onTogglePin={() => toggleProjectPin(p.id)}
                    onToggleFavourite={() => toggleProjectFavourite(p.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ── All projects (sorted by the user's preference) ── */}
          <section className="projectSection">
            {/* Only label this section when favourites/pinned sections sit
                above it — otherwise it's just the whole list. */}
            {rest.length > 0 && (favourites.length > 0 || pinned.length > 0) && (
              <h2 className="projectSectionTitle">All Projects</h2>
            )}
            {view === "list" ? (
              <div className="projectList">
                {sortProjects(rest, sortKey).map((p) => (
                  <ProjectRow
                    key={p.id}
                    project={p}
                    onOpen={() => handleOpenProject(p.id)}
                    onChanged={reload}
                    onTogglePin={() => toggleProjectPin(p.id)}
                    onToggleFavourite={() => toggleProjectFavourite(p.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="projectGrid">
                {sortProjects(rest, sortKey).map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    onOpen={() => handleOpenProject(p.id)}
                    onTogglePin={() => toggleProjectPin(p.id)}
                    onToggleFavourite={() => toggleProjectFavourite(p.id)}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {settings.defaultProjectDir && (
        <div className="faint" style={{ fontSize: "var(--fs-xs)", marginTop: "var(--sp-4)" }}>
          <Icon name="folder" size={13} style={{ verticalAlign: "-2px", marginRight: 6 }} />
          Projects are saved to <span className="mono">{settings.defaultProjectDir}</span>
        </div>
      )}

      <ConfirmDialog
        open={openError !== null}
        title="This project can't be opened"
        message={
          openError?.status === "missing"
            ? "This project's manifest is missing — its files may have been moved or deleted outside Scaffold."
            : "This project's manifest is unreadable or corrupt."
        }
        tone="warning"
        confirmLabel="OK"
        onConfirm={closeOpenError}
        onCancel={closeOpenError}
      />
    </div>
  );
}

function ProjectCard({
  project,
  onOpen,
  onTogglePin,
  onToggleFavourite,
}: {
  project: Project;
  onOpen: () => void;
  onTogglePin: () => void;
  onToggleFavourite: () => void;
}) {
  return (
    <div className="projectCard">
      {/* Pin / favourite overlay badges */}
      <div className="projectCardBadges">
        {project.pinned && <Icon name="pin" size={12} className="badgeIcon" title="Pinned" />}
        {project.favourite && <Icon name="star" size={12} className="badgeIcon star" title="Favourite" />}
      </div>
      <div className="projectThumb" onClick={onOpen}>
        <img
          src={project.bannerPath || "/Scaffold/banner.png"}
          alt=""
          onError={(e) => {
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
      {/* Card actions on hover */}
      <div className="projectCardActions">
        <button
          className={`actionBtn ${project.favourite ? "active star" : ""}`}
          onClick={(e) => { e.stopPropagation(); onToggleFavourite(); }}
          title={project.favourite ? "Remove from favourites" : "Add to favourites"}
          aria-label="Toggle favourite"
        >
          <Icon name="star" size={14} />
        </button>
        <button
          className={`actionBtn ${project.pinned ? "active" : ""}`}
          onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
          title={project.pinned ? "Unpin" : "Pin project"}
          aria-label="Toggle pin"
        >
          <Icon name="pin" size={14} />
        </button>
        <button
          className="actionBtn"
          onClick={(e) => { e.stopPropagation(); revealPath(project.path); }}
          title="Show in Folder"
          aria-label="Show in folder"
        >
          <Icon name="external" size={14} />
        </button>
      </div>
    </div>
  );
}

function ProjectRow({
  project,
  onOpen,
  onChanged,
  onTogglePin,
  onToggleFavourite,
}: {
  project: Project;
  onOpen: () => void;
  onChanged: () => void;
  onTogglePin: () => void;
  onToggleFavourite: () => void;
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
        <span className="projectRowName">
          {project.pinned && <Icon name="pin" size={12} className="inlineBadge" />}
          {project.favourite && <Icon name="star" size={12} className="inlineBadge star" />}
          {project.name}
        </span>
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
        <button
          className={`actionBtn ${project.favourite ? "active star" : ""}`}
          onClick={(e) => { e.stopPropagation(); onToggleFavourite(); }}
          title={project.favourite ? "Remove from favourites" : "Add to favourites"}
          aria-label="Toggle favourite"
        >
          <Icon name="star" size={14} />
        </button>
        <button
          className={`actionBtn ${project.pinned ? "active" : ""}`}
          onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
          title={project.pinned ? "Unpin" : "Pin project"}
          aria-label="Toggle pin"
        >
          <Icon name="pin" size={14} />
        </button>
        <Button
          variant="ghost"
          size="sm"
          icon="external"
          onClick={() => revealPath(project.path)}
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
