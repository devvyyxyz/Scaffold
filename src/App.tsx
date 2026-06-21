import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { useAppStore } from "./lib/store";
import { isOnboardingWindow, isDocsWindow, isProjectsWindow, isTauri } from "./lib/ipc";
import { isEditableTarget, matchesShortcut } from "./lib/keyboard";
import { AppShell } from "./components/shell/AppShell";
import { BootScreen } from "./components/shell/BootScreen";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Onboarding } from "./screens/Onboarding";
import { ProjectsWindow } from "./screens/ProjectsWindow";
import { Dashboard } from "./screens/Dashboard";
import { NewProjectWizard } from "./screens/NewProjectWizard";
import { Editor } from "./screens/Editor";
import { Publish } from "./screens/Publish";
import { Settings } from "./screens/Settings";
import { Archive } from "./screens/Archive";
import { DeploymentManager } from "./screens/DeploymentManager";
import { Plugins } from "./screens/Plugins";
import { Docs } from "./screens/Docs";
import { CommandPalette } from "./components/CommandPalette";
import { KeyboardShortcutsOverlay } from "./components/KeyboardShortcutsOverlay";

export default function App() {
  const ready = useAppStore((s) => s.ready);
  const route = useAppStore((s) => s.route);
  const init = useAppStore((s) => s.init);
  const onboardingWindow = isOnboardingWindow();
  const [showBoot, setShowBoot] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOverlayOpen, setShortcutsOverlayOpen] = useState(false);

  useEffect(() => {
    init();
  }, [init]);

  // Listen for onboarding-complete event from Rust backend.
  // When onboarding finishes, the main window is shown and needs to re-read
  // the saved settings (which now have onboarded: true).
  useEffect(() => {
    if (!isTauri()) return;
    const unlisten = listen("onboarding-complete", () => {
      console.log("onboarding-complete event received, re-initializing store");
      useAppStore.getState().init();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Global keyboard shortcuts. Driven by the persisted bindings so any rebinding
  // in Settings → Keyboard takes effect immediately.
  const shortcuts = useAppStore((s) => s.settings.keyboardShortcuts);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { route, toggleSidebar, setTheme, navigate } = useAppStore.getState();
      const editable = isEditableTarget(e);

      // Editor/canvas shortcuts only act while editing (their targets ship with
      // the visual canvas in a later phase). They still preventDefault so e.g.
      // Cmd+S doesn't trigger a browser save.
      const editorOnly = [
        "edit-undo",
        "edit-redo",
        "edit-save",
        "edit-delete",
        "canvas-zoom-in",
        "canvas-zoom-out",
        "canvas-zoom-reset",
        "canvas-preview",
      ];
      const inEditor = route.name === "editor";

      if (matchesShortcut(e, shortcuts, "cmd-palette")) {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (matchesShortcut(e, shortcuts, "shortcuts-overlay")) {
        if (editable) return;
        e.preventDefault();
        setShortcutsOverlayOpen((v) => !v);
        return;
      }
      // Remaining shortcuts are suppressed while the user is typing.
      if (editable) return;

      if (matchesShortcut(e, shortcuts, "toggle-sidebar")) {
        e.preventDefault();
        void toggleSidebar();
        return;
      }
      if (matchesShortcut(e, shortcuts, "toggle-theme")) {
        e.preventDefault();
        const next = useAppStore.getState().settings.theme === "light" ? "dark" : "light";
        void setTheme(next);
        return;
      }
      if (matchesShortcut(e, shortcuts, "new-project")) {
        e.preventDefault();
        navigate({ name: "new-project" });
        return;
      }
      if (matchesShortcut(e, shortcuts, "go-dashboard")) {
        e.preventDefault();
        navigate({ name: "dashboard" });
        return;
      }
      if (matchesShortcut(e, shortcuts, "go-settings")) {
        e.preventDefault();
        navigate({ name: "settings" });
        return;
      }

      // Editor-scoped: no-op until the canvas lands, but swallow the default.
      if (inEditor && editorOnly.some((id) => matchesShortcut(e, shortcuts, id))) {
        e.preventDefault();
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcuts]);

  // This is the documentation window — show only the docs screen, with no
  // boot screen, app shell, or command palette.
  if (isDocsWindow()) {
    return <Docs />;
  }

  // This is the projects window — show the projects interface in its own window.
  if (isProjectsWindow()) {
    return <ProjectsWindow />;
  }

  // Show boot screen until the user clicks "Next" (which requires both the
  // animation to have finished AND the store to be ready).
  if (showBoot) {
    return <BootScreen ready={ready} onNext={() => setShowBoot(false)} />;
  }

  // This is the onboarding window — show only the onboarding flow.
  if (onboardingWindow) {
    return <Onboarding />;
  }

  // Main window: if onboarding hasn't been completed yet, the store
  // will have navigated to "onboarding" — but in that case the main
  // window should just show a blank shell (the onboarding runs in its
  // own window). We show the dashboard as a fallback.
  if (route.name === "onboarding") {
    return (
      <AppShell>
        <Dashboard />
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
        <KeyboardShortcutsOverlay open={shortcutsOverlayOpen} onClose={() => setShortcutsOverlayOpen(false)} />
      </AppShell>
    );
  }

  const screen = renderRoute(route);

  return (
    <ErrorBoundary>
      <AppShell>
        {screen}
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
        <KeyboardShortcutsOverlay open={shortcutsOverlayOpen} onClose={() => setShortcutsOverlayOpen(false)} />
      </AppShell>
    </ErrorBoundary>
  );
}

function renderRoute(route: ReturnType<typeof useAppStore.getState>["route"]) {
  switch (route.name) {
    case "dashboard":
      return <Dashboard />;
    case "new-project":
      return <NewProjectWizard />;
    case "editor":
      return <Editor projectId={route.projectId} />;
    case "publish":
      return <Publish projectId={route.projectId} />;
    case "archive":
      return <Archive />;
    case "deployment-manager":
      return <DeploymentManager />;
    case "plugins":
      return <Plugins />;
    case "settings":
      return <Settings />;
    case "error-demo":
      return <ErrorDemo />;
    default:
      return <Dashboard />;
  }
}

function ErrorDemo() {
  const navigate = useAppStore((s) => s.navigate);
  return (
    <div className="screen">
      <div className="screenHeader">
        <div>
          <h1 className="screenTitle">Error Screen Preview</h1>
          <p className="screenSub">This is a preview of the error boundary screen.</p>
        </div>
      </div>
      <div style={{ display: "flex", gap: "var(--sp-3)" }}>
        <Button variant="primary" icon="alert-triangle" onClick={() => navigate({ name: "error-demo", triggerError: true })}>
          Trigger ReferenceError
        </Button>
        <Button variant="secondary" onClick={() => navigate({ name: "error-demo", triggerError: "type" })}>
          Trigger TypeError
        </Button>
        <Button variant="ghost" onClick={() => navigate({ name: "dashboard" })}>
          Back to dashboard
        </Button>
      </div>
    </div>
  );
}
