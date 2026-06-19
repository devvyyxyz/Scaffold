import { useState } from "react";
import { open, Command } from "@tauri-apps/plugin-shell";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useAppStore } from "../lib/store";
import { isTauri } from "../lib/ipc";
import { AppSettings, ThemePref, AutoSaveInterval, CanvasZoom } from "../lib/types";
import { Button } from "../components/ui/Button";
import { Field, Segmented, Select } from "../components/ui/Field";
import { Icon, IconName } from "../components/ui/Icon";
import { Logo } from "../components/ui/Logo";
import "./screens.css";

type Section = "general" | "appearance" | "editor" | "export" | "runtime" | "updates" | "itchio" | "developer" | "about";

const BASE_SECTIONS: { id: Section; label: string; icon: IconName }[] = [
  { id: "general", label: "General", icon: "settings" },
  { id: "appearance", label: "Appearance", icon: "sun" },
  { id: "editor", label: "Editor", icon: "code" },
  { id: "export", label: "Export", icon: "publish" },
  { id: "runtime", label: "Runtime", icon: "code" },
  { id: "updates", label: "Updates", icon: "publish" },
  { id: "itchio", label: "Product pages", icon: "external" },
  { id: "about", label: "About", icon: "sparkles" },
];

const DEV_SECTION: { id: Section; label: string; icon: IconName } = {
  id: "developer",
  label: "Developer",
  icon: "settings",
};

export function Settings() {
  const [section, setSection] = useState<Section>("general");
  const settings = useAppStore((s) => s.settings);
  const setTheme = useAppStore((s) => s.setTheme);
  const setDefaultProjectDir = useAppStore((s) => s.setDefaultProjectDir);
  const resetOnboarding = useAppStore((s) => s.resetOnboarding);

  async function pickDefaultDir() {
    if (!isTauri()) return;
    const selected = await openDialog({ directory: true, multiple: false });
    if (typeof selected === "string") await setDefaultProjectDir(selected);
  }

  async function pickExportDir() {
    if (!isTauri()) return;
    const selected = await openDialog({ directory: true, multiple: false });
    if (typeof selected === "string") {
      useAppStore.setState((s) => ({
        settings: { ...s.settings, exportOutputDir: selected },
      }));
    }
  }

  function handleRestartOnboarding() {
    const confirmed = window.confirm(
      "This will restart the onboarding wizard.\n\nSome settings (like theme and default project directory) may be reset to their defaults. Your existing projects will not be affected."
    );
    if (confirmed) resetOnboarding();
  }

  return (
    <div className="screen">
      <div className="screenHeader">
        <div>
          <h1 className="screenTitle">Settings</h1>
          <p className="screenSub">App-wide preferences.</p>
        </div>
      </div>

      <div className="settingsLayout">
        <nav className="settingsNav">
          {BASE_SECTIONS.map((s) => (
            <button
              key={s.id}
              className={`settingsNavItem ${section === s.id ? "active" : ""}`}
              onClick={() => setSection(s.id)}
            >
              <Icon name={s.icon} size={15} style={{ marginRight: 8 }} />
              {s.label}
            </button>
          ))}
          {settings.developerMode && (
            <button
              className={`settingsNavItem ${section === DEV_SECTION.id ? "active" : ""}`}
              onClick={() => setSection(DEV_SECTION.id)}
            >
              <Icon name={DEV_SECTION.icon} size={15} style={{ marginRight: 8 }} />
              {DEV_SECTION.label}
            </button>
          )}
        </nav>

        <div className="settingsSection">
          {section === "general" && (
            <>
              <Field label="Default project location">
                <div className="inputRow">
                  <input className="control" value={settings.defaultProjectDir ?? "—"} readOnly />
                  <Button icon="folder-open" onClick={pickDefaultDir}>Change</Button>
                </div>
              </Field>
              <Field label="Default stack">
                <Select
                  value={settings.defaultStack}
                  onChange={(e) => useAppStore.setState((s) => ({
                    settings: { ...s.settings, defaultStack: e.target.value as never },
                  }))}
                >
                  <option value="vite">Vite</option>
                  <option value="next">Next.js</option>
                  <option value="remix">Remix</option>
                  <option value="plain">Plain HTML</option>
                </Select>
              </Field>
              <Field label="Language">
                <Select
                  value={settings.language}
                  onChange={(e) => useAppStore.setState((s) => ({
                    settings: { ...s.settings, language: e.target.value },
                  }))}
                >
                  <option value="en">English</option>
                </Select>
              </Field>

              <Field label="Page title prefix" hint="Prepended to page titles, e.g. 'Scaffold — About'.">
                <input
                  className="control"
                  value={settings.pageTitlePrefix}
                  onChange={(e) => useAppStore.setState((s) => ({
                    settings: { ...s.settings, pageTitlePrefix: e.target.value },
                  }))}
                  placeholder="Scaffold — "
                />
              </Field>

              <Field label="Default meta description" hint="Template used for new page meta descriptions. Use {{page}} for the page title.">
                <input
                  className="control"
                  value={settings.metaDescriptionTemplate}
                  onChange={(e) => useAppStore.setState((s) => ({
                    settings: { ...s.settings, metaDescriptionTemplate: e.target.value },
                  }))}
                  placeholder="{{page}} — Built with Scaffold"
                />
              </Field>

              <Field label="Auto-save" hint="Automatically save editor changes at this interval.">
                <Select
                  value={settings.autoSaveInterval}
                  onChange={(e) => useAppStore.setState((s) => ({
                    settings: { ...s.settings, autoSaveInterval: Number(e.target.value) as AutoSaveInterval },
                  }))}
                >
                  <option value={0}>Off</option>
                  <option value={30}>Every 30 seconds</option>
                  <option value={60}>Every 1 minute</option>
                  <option value={120}>Every 2 minutes</option>
                  <option value={300}>Every 5 minutes</option>
                </Select>
              </Field>

              <Field label="Show welcome screen" hint="Show the getting-started screen when the app launches.">
                <Segmented
                  value={settings.showWelcomeScreen ? "on" : "off"}
                  onChange={(v) => useAppStore.setState((s) => ({
                    settings: { ...s.settings, showWelcomeScreen: v === "on" },
                  }))}
                  options={[
                    { value: "on", label: "On" },
                    { value: "off", label: "Off" },
                  ]}
                />
              </Field>

              <div className="dangerZone">
                <div className="dangerZoneTitle">Danger zone</div>
                <Button variant="danger" size="sm" icon="settings" onClick={handleRestartOnboarding}>
                  Restart onboarding
                </Button>
                <p className="hint" style={{ marginTop: "var(--sp-1)" }}>
                  Walk through the setup wizard again. Some settings may be reset to defaults.
                </p>
              </div>

              <div style={{ borderTop: "1px solid var(--border)", paddingTop: "var(--sp-4)", marginTop: "var(--sp-4)" }}>
                <div className="cardTitle" style={{ marginBottom: "var(--sp-3)" }}>Experimental</div>
                <Field label="Developer mode" hint="Unlock the Developer tab with debugging tools and advanced options.">
                  <Segmented
                    value={settings.developerMode ? "on" : "off"}
                    onChange={(v) => useAppStore.setState((s) => ({
                      settings: { ...s.settings, developerMode: v === "on" },
                    }))}
                    options={[
                      { value: "on", label: "On" },
                      { value: "off", label: "Off" },
                    ]}
                  />
                </Field>
                <p className="hint" style={{ marginTop: "var(--sp-1)" }}>
                  When enabled, a Developer tab appears in the settings sidebar.
                </p>
              </div>
            </>
          )}

          {section === "appearance" && (
            <>
              <Field label="Theme" hint="Changes apply instantly across the app.">
                <Segmented<ThemePref>
                  value={settings.theme}
                  onChange={setTheme}
                  options={[
                    { value: "light", label: "Light", icon: <Icon name="sun" size={14} /> },
                    { value: "dark", label: "Dark", icon: <Icon name="moon" size={14} /> },
                    { value: "system", label: "System", icon: <Icon name="monitor" size={14} /> },
                  ]}
                />
              </Field>
            </>
          )}

          {section === "editor" && (
            <>
              <Field label="Canvas zoom" hint="Default zoom level when opening the editor.">
                <Select
                  value={settings.canvasZoom}
                  onChange={(e) => useAppStore.setState((s) => ({
                    settings: { ...s.settings, canvasZoom: e.target.value as CanvasZoom },
                  }))}
                >
                  <option value="fit">Fit to screen</option>
                  <option value="75">75%</option>
                  <option value="100">100%</option>
                  <option value="125">125%</option>
                  <option value="150">150%</option>
                </Select>
              </Field>

              <Field label="Snap to grid" hint="Align dragged blocks to a grid on the canvas.">
                <Segmented
                  value={settings.snapToGrid ? "on" : "off"}
                  onChange={(v) => useAppStore.setState((s) => ({
                    settings: { ...s.settings, snapToGrid: v === "on" },
                  }))}
                  options={[
                    { value: "on", label: "On" },
                    { value: "off", label: "Off" },
                  ]}
                />
              </Field>

              <Field label="Component outlines" hint="Show thin borders around components on the canvas.">
                <Segmented
                  value={settings.showComponentOutlines ? "on" : "off"}
                  onChange={(v) => useAppStore.setState((s) => ({
                    settings: { ...s.settings, showComponentOutlines: v === "on" },
                  }))}
                  options={[
                    { value: "on", label: "On" },
                    { value: "off", label: "Off" },
                  ]}
                />
              </Field>

              <Field label="Accent colour" hint="Default accent colour applied to generated sites.">
                <div className="inputRow">
                  <input
                    type="color"
                    value={settings.accentColour}
                    onChange={(e) => useAppStore.setState((s) => ({
                      settings: { ...s.settings, accentColour: e.target.value },
                    }))}
                    style={{ width: 36, height: 32, padding: 0, border: "none", cursor: "pointer" }}
                  />
                  <input
                    className="control"
                    value={settings.accentColour}
                    onChange={(e) => useAppStore.setState((s) => ({
                      settings: { ...s.settings, accentColour: e.target.value },
                    }))}
                    style={{ flex: 1 }}
                  />
                </div>
              </Field>

              <Field label="Animations" hint="Enable CSS transitions and animations in the live preview.">
                <Segmented
                  value={settings.enableAnimations ? "on" : "off"}
                  onChange={(v) => useAppStore.setState((s) => ({
                    settings: { ...s.settings, enableAnimations: v === "on" },
                  }))}
                  options={[
                    { value: "on", label: "On" },
                    { value: "off", label: "Off" },
                  ]}
                />
              </Field>
            </>
          )}

          {section === "export" && (
            <>
              <Field label="Output format" hint="Clean produces readable code; minified strips whitespace and comments.">
                <Segmented
                  value={settings.exportFormat}
                  onChange={(v) => useAppStore.setState((s) => ({
                    settings: { ...s.settings, exportFormat: v as "clean" | "minified" },
                  }))}
                  options={[
                    { value: "clean", label: "Clean" },
                    { value: "minified", label: "Minified" },
                  ]}
                />
              </Field>

              <Field label="Include source maps" hint="Generate .map files alongside the output for debugging.">
                <Segmented
                  value={settings.includeSourceMaps ? "on" : "off"}
                  onChange={(v) => useAppStore.setState((s) => ({
                    settings: { ...s.settings, includeSourceMaps: v === "on" },
                  }))}
                  options={[
                    { value: "on", label: "On" },
                    { value: "off", label: "Off" },
                  ]}
                />
              </Field>

              <Field label="Output directory" hint="Custom directory for exported builds. Leave empty to use the project default.">
                <div className="inputRow">
                  <input
                    className="control"
                    value={settings.exportOutputDir ?? ""}
                    readOnly
                    placeholder="Project default"
                  />
                  <Button icon="folder-open" onClick={pickExportDir}>Change</Button>
                </div>
              </Field>

              <Field label="Auto-open after export" hint="Open the generated site in your default browser when export finishes.">
                <Segmented
                  value={settings.autoOpenAfterExport ? "on" : "off"}
                  onChange={(v) => useAppStore.setState((s) => ({
                    settings: { ...s.settings, autoOpenAfterExport: v === "on" },
                  }))}
                  options={[
                    { value: "on", label: "On" },
                    { value: "off", label: "Off" },
                  ]}
                />
              </Field>
            </>
          )}

          {section === "runtime" && (
            <>
              <div className="card">
                <div className="cardTitle">Bundled runtime</div>
                <div className="stack-sm" style={{ fontSize: "var(--fs-sm)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="muted">Status</span>
                    <span style={{ color: "var(--success)" }}>● Ready</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="muted">Node version</span>
                    <span className="mono">not bundled yet</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="muted">Cache size</span>
                    <span className="mono">—</span>
                  </div>
                </div>
                <div style={{ marginTop: "var(--sp-4)" }}>
                  <Button variant="ghost" icon="check" disabled>Clear cache</Button>
                </div>
              </div>
              <p className="hint">The bundled Node/Bun runtime for scaffolding target projects ships in a later phase.</p>
            </>
          )}

          {section === "updates" && (
            <>
              <Field label="Auto-update">
                <Button variant="secondary" icon="check" onClick={() => checkForUpdates()}>Check for updates</Button>
              </Field>
              <p className="hint">You're on v0.1.0. Auto-update with signed deltas lands alongside first release builds.</p>
            </>
          )}

          {section === "itchio" && (
            <div className="card">
              <div className="cardTitle">Product pages</div>
              <p className="hint" style={{ marginBottom: "var(--sp-3)" }}>
                Links to your public product pages.
              </p>
              <div className="stack-sm" style={{ fontSize: "var(--fs-sm)" }}>
                <button
                  className="settingsNavItem"
                  onClick={() => isTauri() && open("https://devvyyxyz.itch.io/scaffold")}
                >
                  <Icon name="external" size={15} style={{ marginRight: 8 }} /> Scaffold on itch.io
                </button>
              </div>
            </div>
          )}

          {section === "developer" && (
            <>
              <Field label="Verbose logging" hint="Enable debug-level logging in the browser console.">
                <Segmented
                  value={settings.verboseLogging ? "on" : "off"}
                  onChange={(v) => useAppStore.setState((s) => ({
                    settings: { ...s.settings, verboseLogging: v === "on" },
                  }))}
                  options={[
                    { value: "on", label: "On" },
                    { value: "off", label: "Off" },
                  ]}
                />
              </Field>

              <Field label="Open DevTools on start" hint="Automatically open browser DevTools when the app launches.">
                <Segmented
                  value={settings.openDevToolsOnStart ? "on" : "off"}
                  onChange={(v) => useAppStore.setState((s) => ({
                    settings: { ...s.settings, openDevToolsOnStart: v === "on" },
                  }))}
                  options={[
                    { value: "on", label: "On" },
                    { value: "off", label: "Off" },
                  ]}
                />
              </Field>

              <Field label="Backend log level" hint="Controls the verbosity of the Rust/Tauri backend logs.">
                <Select
                  value={settings.backendLogLevel}
                  onChange={(e) => useAppStore.setState((s) => ({
                    settings: { ...s.settings, backendLogLevel: e.target.value as AppSettings["backendLogLevel"] },
                  }))}
                >
                  <option value="off">Off</option>
                  <option value="error">Error</option>
                  <option value="warn">Warn</option>
                  <option value="info">Info</option>
                  <option value="debug">Debug</option>
                  <option value="trace">Trace</option>
                </Select>
              </Field>

              <p className="hint" style={{ marginTop: "var(--sp-2)" }}>
                Developer settings are intended for debugging. Changes take effect on next app launch.
              </p>
            </>
          )}

          {section === "about" && (
            <>
              <div className="card">
                <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", marginBottom: "var(--sp-4)" }}>
                  <div className="brandMark" style={{ width: 40, height: 40 }}>
                    <Logo size={22} />
                  </div>
                  <div>
                    <div style={{ fontWeight: "var(--fw-semibold)" }}>Scaffold</div>
                    <div className="faint" style={{ fontSize: "var(--fs-xs)" }}>Version 0.1.0</div>
                  </div>
                </div>
                <div className="stack-sm" style={{ fontSize: "var(--fs-sm)" }}>
                <button className="settingsNavItem" onClick={() => isTauri() && open("https://github.com/devvyyxyz/scaffold")}>
                  <Icon name="github" size={15} style={{ marginRight: 8 }} /> Source & docs
                </button>
                <button className="settingsNavItem" onClick={() => isTauri() && open("https://github.com/devvyyxyz/scaffold/issues")}>
                  <Icon name="external" size={15} style={{ marginRight: 8 }} /> Report an issue
                </button>
                <button
                  className="settingsNavItem"
                  onClick={() => {
                    if (isTauri() && settings.defaultProjectDir) {
                      Command.create("open", [settings.defaultProjectDir]).execute();
                    }
                  }}
                >
                  <Icon name="folder-open" size={15} style={{ marginRight: 8 }} /> Reveal project folder
                </button>
                </div>
              </div>

              <Field label="Tagline">
                <div className="control" style={{ padding: "var(--sp-2) var(--sp-3)", fontSize: "var(--fs-sm)" }}>
                  {settings.itchTagline}
                </div>
              </Field>
              <Field label="Description">
                <div
                  className="control"
                  style={{
                    padding: "var(--sp-3)",
                    fontSize: "var(--fs-sm)",
                    lineHeight: 1.6,
                    fontFamily: "var(--font-mono)",
                    whiteSpace: "pre-wrap",
                    maxHeight: 320,
                    overflowY: "auto",
                  }}
                >
                  {settings.itchDescription}
                </div>
              </Field>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

async function checkForUpdates() {
  // Placeholder — real updater wiring is a later phase (needs signed releases).
}
