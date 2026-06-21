import { useEffect, useState } from "react";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useAppStore } from "../lib/store";
import { isTauri, isProjectsWindow, closeProjectsWindow } from "../lib/ipc";
import { Dashboard } from "./Dashboard";
import { AppShell } from "../components/shell/AppShell";
import { CommandPalette } from "../components/CommandPalette";
import { KeyboardShortcutsOverlay } from "../components/KeyboardShortcutsOverlay";
import { Button } from "../components/ui/Button";

export function ProjectsWindow() {
  const ready = useAppStore((s) => s.ready);
  const init = useAppStore((s) => s.init);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOverlayOpen, setShortcutsOverlayOpen] = useState(false);

  useEffect(() => {
    init();
  }, [init]);

  // Close window handler (Escape key or window close button). The projects
  // window is a static, reused window, so we intercept the OS close request
  // and hide it instead of letting Tauri destroy it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        void closeProjectsWindow();
      }
    };
    window.addEventListener("keydown", onKey);

    let unlistenCloseRequested: (() => void) | null = null;
    if (isTauri() && isProjectsWindow()) {
      const win = WebviewWindow.getCurrent();
      win
        ?.onCloseRequested((event) => {
          event.preventDefault();
          void closeProjectsWindow();
        })
        .then((un) => {
          unlistenCloseRequested = un ?? null;
        })
        .catch((error) => console.error("close-requested listener failed:", error));
    }

    return () => {
      window.removeEventListener("keydown", onKey);
      unlistenCloseRequested?.();
    };
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

