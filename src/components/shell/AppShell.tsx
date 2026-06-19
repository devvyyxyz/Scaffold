import { ReactNode, useCallback, useEffect, useRef } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { StatusBar } from "./StatusBar";
import {
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_MAX,
  SIDEBAR_MIN,
  useAppStore,
} from "../../lib/store";
import "./AppShell.css";

export function AppShell({ children }: { children: ReactNode }) {
  const collapsed = useAppStore((s) => s.settings.sidebarCollapsed);
  const width = useAppStore((s) => s.settings.sidebarWidth);
  const setSidebarWidth = useAppStore((s) => s.setSidebarWidth);

  // Effective column width: collapsed → fixed rail; else stored width.
  const colWidth = collapsed ? SIDEBAR_COLLAPSED_WIDTH : width;

  // ---- resize handle (drag) ----
  const dragging = useRef(false);

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!dragging.current) return;
      // Sidebar width = pointer X, clamped to bounds. (Sidebar is flush left.)
      const next = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, e.clientX));
      setSidebarWidth(next);
    },
    [setSidebarWidth]
  );

  const endDrag = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    document.body.classList.remove("sidebar-resizing");
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", endDrag);
  }, [onPointerMove]);

  const startDrag = useCallback(() => {
    if (collapsed) return; // no resize while collapsed
    dragging.current = true;
    document.body.classList.add("sidebar-resizing");
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", endDrag);
  }, [collapsed, onPointerMove, endDrag]);

  // Clean up listeners if the component unmounts mid-drag.
  useEffect(() => {
    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", endDrag);
    };
  }, [onPointerMove, endDrag]);

  return (
    <div className="shell" style={{ ["--sidebar-col" as string]: `${colWidth}px` }}>
      <aside className="sidebarArea">
        <Sidebar collapsed={collapsed} />
      </aside>

      {!collapsed && (
        <div
          className="sidebarResizeHandle"
          onPointerDown={startDrag}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
        />
      )}

      <header className="topbarArea">
        <TopBar />
      </header>
      <main className="contentArea scroll-y">{children}</main>
      <footer className="statusArea">
        <StatusBar />
      </footer>
    </div>
  );
}
