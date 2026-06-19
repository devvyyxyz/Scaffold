import { useEffect, useState } from "react";
import { useAppStore } from "./lib/store";
import { isOnboardingWindow } from "./lib/ipc";
import { AppShell } from "./components/shell/AppShell";
import { BootScreen } from "./components/shell/BootScreen";
import { Onboarding } from "./screens/Onboarding";
import { Dashboard } from "./screens/Dashboard";
import { NewProjectWizard } from "./screens/NewProjectWizard";
import { Editor } from "./screens/Editor";
import { Publish } from "./screens/Publish";
import { Settings } from "./screens/Settings";
import { Archive } from "./screens/Archive";

export default function App() {
  const ready = useAppStore((s) => s.ready);
  const route = useAppStore((s) => s.route);
  const init = useAppStore((s) => s.init);
  const onboardingWindow = isOnboardingWindow();
  const [showBoot, setShowBoot] = useState(true);

  useEffect(() => {
    init();
  }, [init]);

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
    return <AppShell><Dashboard /></AppShell>;
  }

  const screen = renderRoute(route);

  return <AppShell>{screen}</AppShell>;
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
    case "settings":
      return <Settings />;
    default:
      return <Dashboard />;
  }
}
