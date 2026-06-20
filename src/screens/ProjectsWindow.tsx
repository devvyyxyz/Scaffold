import { useEffect, useState } from "react";
import { useAppStore } from "../lib/store";
import { isProjectsWindow, closeProjectsWindow } from "../lib/ipc";
import { Dashboard } from "./Dashboard";
import { AppShell } from "../components/shell/AppShell";
import { CommandPalette } from "../components/CommandPalette";
import { KeyboardShortcutsOverlay } from "../components/KeyboardShortcutsOverlay";
import { Button } from "../components/ui/Button";
import { Icon } from "../components/ui/Icon";

export function ProjectsWindow() {
  const ready = useAppStore((s) => s.ready);
  const route = useAppStore((s) => s.route);
  const init = useAppStore((s) => s.init);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOverlayOpen, setShortcutsOverlayOpen] = useState(false);

  useEffect(() => {
    init();
  }, [init]);

  // Close window handler (Escape key or window close button)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        void closeProjectsWindow();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!ready) {
    return null; // Or a loading screen
  }

  return (
    <AppShell>
      <div style={{ position: "absolute", top: "var(--sp-4)", right: "var(--sp-4)", zIndex: 100 }}>
        <Button variant="ghost" size="sm" icon="close" onClick={() => void closeProjectsWindow()}>
          Close
        </Button>
      </div>
      <Dashboard />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <KeyboardShortcutsOverlay open={shortcutsOverlayOpen} onClose={() => setShortcutsOverlayOpen(false)} />
    </AppShell>
  );
}

