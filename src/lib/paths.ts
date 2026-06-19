// Filesystem path helpers.
//
// Default project dir resolution: we prefer the OS "Documents" area. In the
// browser (no Tauri) we fall back to a fake path so the UI remains demoable.

import { dirname, homeDir, join } from "@tauri-apps/api/path";
import { isTauri } from "./ipc";

/** Default location for new Scaffold projects. */
export async function defaultProjectDir(): Promise<string> {
  if (!isTauri()) return "/tmp/Scaffold-projects";
  const home = await homeDir();
  return await join(home, "Documents", "Scaffold-projects");
}

/** Archive root — a sibling of the default project dir, so moves stay same-volume. */
export async function archiveDir(): Promise<string> {
  if (!isTauri()) return "/tmp/Scaffold-archive";
  const projects = await defaultProjectDir();
  return await join(dirname(projects), "Scaffold-archive");
}

/** Join path segments portably across OS path separators. */
export async function joinPath(...segments: string[]): Promise<string> {
  if (!isTauri()) return segments.join("/");
  return await join(...segments);
}

/** Last path segment (the folder/file name). */
export function basename(p: string): string {
  const norm = p.replace(/\\/g, "/");
  const parts = norm.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "";
}
