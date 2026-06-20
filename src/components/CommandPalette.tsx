import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "../lib/store";
import { SettingsSection, ThemePref } from "../lib/types";
import { Icon, IconName } from "./ui/Icon";
import "./CommandPalette.css";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

type Category = "Navigate" | "Actions" | "Projects" | "Settings";

interface Command {
  id: string;
  category: Category;
  title: string;
  subtitle?: string;
  icon: IconName;
  keywords?: string;
  run: () => void;
}

// Stable category render order.
const CATEGORY_ORDER: Category[] = ["Navigate", "Actions", "Projects", "Settings"];

// Settings sections surfaced by the palette. Mirrors the `SECTIONS`/`DEV_SECTION`
// arrays in Settings.tsx; the developer tab is only included when developerMode
// is on (filtered at build time below).
const SETTINGS_INDEX: { id: SettingsSection; label: string; icon: IconName; desc: string }[] = [
  { id: "general", label: "General", icon: "settings", desc: "Workspace, pages, saving, experimental" },
  { id: "appearance", label: "Appearance", icon: "sun", desc: "Theme and visual preferences" },
  { id: "editor", label: "Editor", icon: "code", desc: "Canvas defaults and editing behaviour" },
  { id: "export", label: "Export", icon: "publish", desc: "How generated code is written out" },
  { id: "runtime", label: "Runtime", icon: "code", desc: "Bundled build runtime" },
  { id: "updates", label: "Updates", icon: "publish", desc: "Application version and update checks" },
  { id: "itchio", label: "Product pages", icon: "external", desc: "Links to your public product pages" },
  { id: "about", label: "About", icon: "sparkles", desc: "About Scaffold" },
  { id: "developer", label: "Developer", icon: "settings", desc: "Debugging tools and advanced options" },
];

const PER_CATEGORY_LIMIT: Partial<Record<Category, number>> = {
  Projects: 8,
  Settings: 12,
};

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useAppStore((s) => s.navigate);
  const projects = useAppStore((s) => s.projects);
  const settings = useAppStore((s) => s.settings);
  const setTheme = useAppStore((s) => s.setTheme);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);

  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset query + selection whenever the palette is (re)opened, and focus input.
  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      // Defer so the input is mounted before we focus it.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Build the command list from live store state.
  const commands = useMemo<Command[]>(() => {
    const cmds: Command[] = [];

    // ── Navigate ──
    cmds.push(
      { id: "nav:dashboard", category: "Navigate", title: "Projects", subtitle: "Go to your project library", icon: "dashboard", keywords: "home library", run: () => navigate({ name: "dashboard" }) },
      { id: "nav:new", category: "Navigate", title: "New Project", subtitle: "Start the new-project wizard", icon: "plus", keywords: "create scaffold", run: () => navigate({ name: "new-project" }) },
      { id: "nav:archive", category: "Navigate", title: "Archive", subtitle: "Browse archived projects", icon: "archive", run: () => navigate({ name: "archive" }) },
      { id: "nav:settings", category: "Navigate", title: "Settings", subtitle: "App preferences", icon: "settings", run: () => navigate({ name: "settings" }) },
    );

    // ── Actions ──
    const nextTheme: ThemePref = settings.theme === "light" ? "dark" : "light";
    cmds.push(
      { id: "act:theme", category: "Actions", title: `Switch to ${nextTheme} theme`, subtitle: `Currently ${settings.theme}`, icon: settings.theme === "dark" ? "sun" : "moon", keywords: "toggle appearance light dark", run: () => void setTheme(nextTheme) },
      { id: "act:sidebar", category: "Actions", title: "Toggle sidebar", subtitle: "Collapse or expand the sidebar", icon: "layers", keywords: "collapse expand panel", run: () => void toggleSidebar() },
    );

    // ── Projects ── (non-archived, most recently edited first)
    const live = projects
      .filter((p) => !p.archived)
      .sort((a, b) => (b.lastEditedAt ?? b.updatedAt) - (a.lastEditedAt ?? a.updatedAt));
    for (const p of live) {
      cmds.push({
        id: `proj:${p.id}`,
        category: "Projects",
        title: p.name,
        subtitle: p.path,
        icon: "folder-open",
        keywords: `${p.stack} ${p.template} open`,
        run: () => navigate({ name: "editor", projectId: p.id }),
      });
    }

    // ── Settings ── (developer tab only when unlocked)
    for (const s of SETTINGS_INDEX) {
      if (s.id === "developer" && !settings.developerMode) continue;
      cmds.push({
        id: `set:${s.id}`,
        category: "Settings",
        title: s.label,
        subtitle: s.desc,
        icon: s.icon,
        keywords: `setting preference ${s.id}`,
        run: () => navigate({ name: "settings", section: s.id }),
      });
    }

    return cmds;
  }, [navigate, projects, settings.theme, settings.developerMode, setTheme, toggleSidebar]);

  // Filter + group.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let matched = q
      ? commands.filter((c) =>
          (c.title + " " + (c.subtitle ?? "") + " " + (c.keywords ?? ""))
            .toLowerCase()
            .includes(q),
        )
      : commands;

    const grouped: { category: Category; items: Command[] }[] = [];
    for (const cat of CATEGORY_ORDER) {
      const items = matched
        .filter((c) => c.category === cat)
        .slice(0, PER_CATEGORY_LIMIT[cat] ?? Infinity);
      if (items.length) grouped.push({ category: cat, items });
    }
    return grouped;
  }, [commands, query]);

  const flat = useMemo(() => filtered.flatMap((g) => g.items), [filtered]);

  // Clamp selection when the result set changes.
  useEffect(() => {
    setActive((i) => (flat.length === 0 ? 0 : Math.min(i, flat.length - 1)));
  }, [flat.length]);

  // Scroll the active row into view.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  // Keyboard navigation while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => (flat.length ? (i + 1) % flat.length : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => (flat.length ? (i - 1 + flat.length) % flat.length : 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const cmd = flat[active];
        if (cmd) {
          cmd.run();
          onClose();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, flat, active, onClose]);

  if (!open) return null;

  let idx = -1;

  return (
    <div className="cmdOverlay" onClick={onClose}>
      <div
        className="cmdPanel"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cmdInputRow">
          <Icon name="search" size={16} className="cmdInputIcon" />
          <input
            ref={inputRef}
            className="cmdInput"
            type="text"
            placeholder="Search projects, actions, settings…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            spellCheck={false}
            autoComplete="off"
          />
          <kbd className="cmdEscHint">esc</kbd>
        </div>

        <div className="cmdResults scroll-y" ref={listRef}>
          {flat.length === 0 && (
            <div className="cmdEmpty">No matching commands.</div>
          )}
          {filtered.map((group) => (
            <div className="cmdGroup" key={group.category}>
              <div className="cmdGroupLabel">{group.category}</div>
              {group.items.map((cmd) => {
                idx += 1;
                const i = idx;
                const isActive = i === active;
                return (
                  <button
                    key={cmd.id}
                    data-idx={i}
                    className={`cmdRow ${isActive ? "active" : ""}`}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => {
                      cmd.run();
                      onClose();
                    }}
                  >
                    <span className="cmdRowIcon">
                      <Icon name={cmd.icon} size={16} />
                    </span>
                    <span className="cmdRowText">
                      <span className="cmdRowTitle">{cmd.title}</span>
                      {cmd.subtitle && <span className="cmdRowSubtitle">{cmd.subtitle}</span>}
                    </span>
                    {isActive && (
                      <span className="cmdRowEnter">
                        <Icon name="corner-down-left" size={14} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="cmdFooter">
          <span className="cmdFooterHint">
            <kbd>↑</kbd><kbd>↓</kbd> navigate
          </span>
          <span className="cmdFooterHint">
            <kbd>↵</kbd> select
          </span>
          <span className="cmdFooterHint">
            <kbd>esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
