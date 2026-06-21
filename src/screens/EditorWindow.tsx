import { useEffect, useState } from "react";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useAppStore } from "../lib/store";
import {
  isTauri,
  isEditorWindow,
  getProjectIdFromUrl,
} from "../lib/ipc";
import { BootScreen } from "../components/shell/BootScreen";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { Editor } from "./Editor";

/**
 * Standalone editor window — rendered when the URL contains
 * `?window=editor&projectId=XXX`. Each project gets its own native window
 * with its own independent Zustand store instance. The store is only used
 * for settings (theme, etc.); the projectId comes from the URL.
 */
export function EditorWindow() {
  const ready = useAppStore((s) => s.ready);
  const init = useAppStore((s) => s.init);
  const [showBoot, setShowBoot] = useState(true);
  const projectId = getProjectIdFromUrl();

  useEffect(() => {
    init();
  }, [init]);

  // When the user (or OS) closes this window, clean up the project state
  // (touch the manifest's updatedAt timestamp) before the webview is
  // destroyed. We do NOT prevent the close — these windows are disposable.
  useEffect(() => {
    if (!isTauri() || !isEditorWindow() || !projectId) return;
    const win = WebviewWindow.getCurrent();
    if (!win) return;

    let unlisten: (() => void) | null = null;
    win.onCloseRequested(async () => {
      // Let the window close naturally — the unload is best-effort.
      try {
        const { unloadProject } = await import("../lib/projects");
        await unloadProject(projectId);
      } catch (e) {
        console.warn("Failed to unload project on window close:", e);
      }
    }).then((fn) => {
      unlisten = fn ?? null;
    }).catch((e) => console.error("close-requested listener failed:", e));

    return () => {
      unlisten?.();
    };
  }, [projectId]);

  // Boot screen while the store initialises (loads theme etc.)
  if (showBoot) {
    return <BootScreen ready={ready} onNext={() => setShowBoot(false)} />;
  }

  // If somehow opened without a projectId, bail out.
  if (!projectId) {
    return (
      <div style={{ padding: "var(--sp-4)", opacity: 0.5 }}>
        No project ID specified.
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Editor projectId={projectId} />
    </ErrorBoundary>
  );
}
