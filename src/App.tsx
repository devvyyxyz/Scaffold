import { useEffect, useState } from "react";
import { useAppStore } from "./lib/store";
import { isOnboardingWindow, isDocsWindow } from "./lib/ipc";
import { AppShell } from "./components/shell/AppShell";
import { BootScreen } from "./components/shell/BootScreen";
import { Onboarding } from "./screens/Onboarding";
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

export default function App() {
  const ready = useAppStore((s) => s.ready);
  const route = useAppStore((s) => s.route);
  const init = useAppStore((s) => s.init);
  const onboardingWindow = isOnboardingWindow();
  const [showBoot, setShowBoot] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    init();
  }, [init]);

  // Global Cmd/Ctrl+K toggles the command palette (main window only).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // This is the documentation window — show only the docs screen, with no
  // boot screen, app shell, or command palette.
  if (isDocsWindow()) {
    return <Docs />;
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
      </AppShell>
    );
  }

  const screen = renderRoute(route);

  return (
    <AppShell>
      {screen}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </AppShell>
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
    default:
      return <Dashboard />;
  }
}
