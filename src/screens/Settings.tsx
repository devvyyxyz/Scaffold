import { open, Command } from "@tauri-apps/plugin-shell";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "../lib/store";
import { isTauri } from "../lib/ipc";
import { getCacheStats } from "../lib/projects";
import { AppSettings, ThemePref, AutoSaveInterval, CanvasZoom, SettingsSection, DEFAULT_KEYBOARD_SHORTCUTS, KeyboardShortcut } from "../lib/types";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Field";
import { Segmented } from "../components/ui/Field";
import { Icon, IconName } from "../components/ui/Icon";
import { Logo } from "../components/ui/Logo";
import { Toggle } from "../components/ui/Toggle";
import { SettingSection, SettingRow } from "../components/ui/Setting";
import "./screens.css";
import "./SettingsKeyboard.css";

type Section = SettingsSection;

const SECTIONS: { id: Section; label: string; icon: IconName }[] = [
  { id: "general", label: "General", icon: "settings" },
  { id: "appearance", label: "Appearance", icon: "sun" },
  { id: "keyboard", label: "Keyboard", icon: "keyboard" },
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

const SECTION_DESC: Partial<Record<Section, string>> = {
  general: "Core workspace preferences and application behaviour.",
  appearance: "Theme and visual preferences. Changes apply instantly.",
  keyboard: "View and customise keyboard shortcuts.",
  editor: "Canvas defaults and editing behaviour.",
  export: "How generated code is written out.",
  runtime: "The bundled build runtime.",
  updates: "Application version and update checks.",
  itchio: "Links to your public product pages.",
  developer: "Debugging tools. Changes take effect on next launch.",
  about: "About Scaffold.",
};

export function Settings() {
  const route = useAppStore((s) => s.route);
  const navigate = useAppStore((s) => s.navigate);
  const settings = useAppStore((s) => s.settings);
  const setTheme = useAppStore((s) => s.setTheme);
  const setDefaultProjectDir = useAppStore((s) => s.setDefaultProjectDir);
  const resetOnboarding = useAppStore((s) => s.resetOnboarding);
  const clearCache = useAppStore((s) => s.clearCache);

  // Active section is driven by the route so the command palette can deep-link
  // to a specific tab. Falls back to "general" when navigated to directly.
  const section: Section =
    route.name === "settings" && route.section ? route.section : "general";
  const setSection = (id: Section) => navigate({ name: "settings", section: id });

  const [previewModal, setPreviewModal] = useState<string | null>(null);
  const [showClearCacheModal, setShowClearCacheModal] = useState(false);
  const [clearCacheOptions, setClearCacheOptions] = useState({ projects: true, manifests: true });
  const [cacheStats, setCacheStats] = useState({ projectsCached: false, manifestsCached: 0 });
  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    useAppStore.setState((s) => ({ settings: { ...s.settings, [key]: value } }));

  async function pickDefaultDir() {
    if (!isTauri()) return;
    const selected = await openDialog({ directory: true, multiple: false });
    if (typeof selected === "string") await setDefaultProjectDir(selected);
  }

  async function pickExportDir() {
    if (!isTauri()) return;
    const selected = await openDialog({ directory: true, multiple: false });
    if (typeof selected === "string") {
      set("exportOutputDir", selected);
    }
  }

  function handleRestartOnboarding() {
    const confirmed = window.confirm(
      "This will restart the onboarding wizard.\n\nSome settings (like theme and default project directory) may be reset to their defaults. Your existing projects will not be affected."
    );
    if (confirmed) resetOnboarding();
  }

  async function handleClearCache() {
    setShowClearCacheModal(true);
  }

  async function confirmClearCache() {
    await clearCache(clearCacheOptions);
    setCacheStats(getCacheStats());
    setShowClearCacheModal(false);
    setClearCacheOptions({ projects: true, manifests: true });
  }

  // Update cache stats periodically and after clear.
  useEffect(() => {
    setCacheStats(getCacheStats());
    const interval = setInterval(() => setCacheStats(getCacheStats()), 5000);
    return () => clearInterval(interval);
  }, []);

  const navItems = settings.developerMode ? [...SECTIONS, DEV_SECTION] : SECTIONS;
  const activeLabel = navItems.find((s) => s.id === section)?.label ?? "Settings";

  return (
    <div className="screen settingsScreen">
      <div className="settingsBody">
        {/* ---- Category nav ---- */}
        <aside className="settingsNavPanel">
          <div className="settingsNavHeader">Settings menu</div>
          <nav className="settingsNav">
            {navItems.map((s) => (
              <button
                key={s.id}
                className={`settingsNavItem ${section === s.id ? "active" : ""}`}
                onClick={() => setSection(s.id)}
              >
                <span className="settingsNavLabel">{s.label}</span>
                {section === s.id && <Icon name="chevron-right" size={16} className="settingsNavChevron" />}
              </button>
            ))}
          </nav>
        </aside>

        {/* ---- Active section ---- */}
        <section className="settingsContent">
          <header className="settingsPageHeader">
            <h1 className="settingsPageTitle">{activeLabel}</h1>
            {SECTION_DESC[section] && (
              <p className="settingsPageDesc">{SECTION_DESC[section]}</p>
            )}
          </header>

          <div className="settingsRows">
            {section === "general" && (
              <>
                <SettingSection title="Workspace" icon="folder-open">
                  <SettingRow title="Default project location" desc="Where new Scaffold projects are created and saved.">
                    <div className="rowInputWithButton">
                      <input className="control mono" value={settings.defaultProjectDir ?? "—"} readOnly />
                      <Button size="sm" icon="folder-open" onClick={pickDefaultDir}>Change</Button>
                    </div>
                  </SettingRow>
                  <SettingRow title="Default stack" desc="Framework used when scaffolding a new project.">
                    <Select
                      value={settings.defaultStack}
                      onChange={(e) => set("defaultStack", e.target.value as never)}
                    >
                      <option value="vite">Vite</option>
                      <option value="next">Next.js</option>
                      <option value="remix">Remix</option>
                      <option value="plain">Plain HTML</option>
                    </Select>
                  </SettingRow>
                  <SettingRow title="Language" desc="Interface language." comingSoon>
                    <Select value={settings.language} onChange={(e) => set("language", e.target.value)} disabled>
                      <option value="en">English</option>
                    </Select>
                  </SettingRow>
                </SettingSection>

                <SettingSection title="Pages" icon="code">
                  <SettingRow title="Page title prefix" desc="Prepended to page titles, e.g. 'Scaffold — About'." comingSoon>
                    <input
                      className="control"
                      value={settings.pageTitlePrefix}
                      onChange={(e) => set("pageTitlePrefix", e.target.value)}
                      placeholder="Scaffold — "
                      disabled
                    />
                  </SettingRow>
                  <SettingRow title="Default meta description" desc="Template for new page meta descriptions. Use {{page}} for the page title." comingSoon>
                    <input
                      className="control"
                      value={settings.metaDescriptionTemplate}
                      onChange={(e) => set("metaDescriptionTemplate", e.target.value)}
                      placeholder="{{page}} — Built with Scaffold"
                      disabled
                    />
                  </SettingRow>
                </SettingSection>

                <SettingSection title="Saving" icon="check">
                  <SettingRow title="Auto-save" desc="Automatically save editor changes at this interval." comingSoon>
                    <Select
                      value={settings.autoSaveInterval}
                      onChange={(e) => set("autoSaveInterval", Number(e.target.value) as AutoSaveInterval)}
                      disabled
                    >
                      <option value={0}>Off</option>
                      <option value={30}>Every 30s</option>
                      <option value={60}>Every 1m</option>
                      <option value={120}>Every 2m</option>
                      <option value={300}>Every 5m</option>
                    </Select>
                  </SettingRow>
                  <SettingRow title="Show welcome screen" desc="Show the getting-started screen when the app launches." comingSoon>
                    <Toggle
                      checked={settings.showWelcomeScreen}
                      onChange={(v) => set("showWelcomeScreen", v)}
                      label="Show welcome screen"
                      disabled
                    />
                  </SettingRow>
                </SettingSection>

                <SettingSection title="Experimental" icon="sparkles">
                  <SettingRow title="Developer mode" desc="Unlock the Developer tab with debugging tools and advanced options.">
                    <Toggle
                      checked={settings.developerMode}
                      onChange={(v) => set("developerMode", v)}
                      label="Developer mode"
                    />
                  </SettingRow>
                </SettingSection>

                <SettingSection title="Danger zone" icon="trash">
                  <SettingRow title="Restart onboarding" desc="Walk through the setup wizard again. Some settings may be reset to defaults.">
                    <Button variant="danger" size="sm" icon="settings" onClick={handleRestartOnboarding}>
                      Restart
                    </Button>
                  </SettingRow>
                </SettingSection>
              </>
            )}

            {section === "appearance" && (
              <SettingSection title="Theme" icon="sun">
                <SettingRow title="Theme" desc="Changes apply instantly across the app.">
                  <Segmented<ThemePref>
                    value={settings.theme}
                    onChange={setTheme}
                    options={[
                      { value: "light", label: "Light", icon: <Icon name="sun" size={14} /> },
                      { value: "dark", label: "Dark", icon: <Icon name="moon" size={14} /> },
                      { value: "system", label: "System", icon: <Icon name="monitor" size={14} /> },
                    ]}
                  />
                </SettingRow>
              </SettingSection>
            )}

            {section === "keyboard" && (
              <KeyboardSection />
            )}

            {section === "editor" && (
              <SettingSection title="Canvas" icon="code">
                <SettingRow title="Canvas zoom" desc="Default zoom level when opening the editor." comingSoon>
                  <Select
                    value={settings.canvasZoom}
                    onChange={(e) => set("canvasZoom", e.target.value as CanvasZoom)}
                    disabled
                  >
                    <option value="fit">Fit to screen</option>
                    <option value="75">75%</option>
                    <option value="100">100%</option>
                    <option value="125">125%</option>
                    <option value="150">150%</option>
                  </Select>
                </SettingRow>
                <SettingRow title="Snap to grid" desc="Align dragged blocks to a grid on the canvas." comingSoon>
                  <Toggle checked={settings.snapToGrid} onChange={(v) => set("snapToGrid", v)} label="Snap to grid" disabled />
                </SettingRow>
                <SettingRow title="Component outlines" desc="Show thin borders around components on the canvas." comingSoon>
                  <Toggle checked={settings.showComponentOutlines} onChange={(v) => set("showComponentOutlines", v)} label="Component outlines" disabled />
                </SettingRow>
                <SettingRow title="Accent colour" desc="Default accent colour applied to generated sites." comingSoon>
                  <div className="rowInputWithButton">
                    <input
                      type="color"
                      value={settings.accentColour}
                      onChange={(e) => set("accentColour", e.target.value)}
                      className="colorSwatch"
                      disabled
                    />
                    <input
                      className="control mono"
                      value={settings.accentColour}
                      onChange={(e) => set("accentColour", e.target.value)}
                      style={{ flex: 1 }}
                      disabled
                    />
                  </div>
                </SettingRow>
                <SettingRow title="Animations" desc="Enable CSS transitions and animations in the live preview." comingSoon>
                  <Toggle checked={settings.enableAnimations} onChange={(v) => set("enableAnimations", v)} label="Animations" disabled />
                </SettingRow>
                <p className="hint" style={{ marginTop: "var(--sp-2)" }}>
                  The visual canvas editor lands in a later phase — these options will take effect once it ships.
                </p>
              </SettingSection>
            )}

            {section === "export" && (
              <SettingSection title="Export" icon="publish">
                <SettingRow title="Output format" desc="Clean produces readable code; minified strips whitespace and comments." comingSoon>
                  <Segmented
                    value={settings.exportFormat}
                    onChange={(v) => set("exportFormat", v as "clean" | "minified")}
                    disabled
                    options={[
                      { value: "clean", label: "Clean" },
                      { value: "minified", label: "Minified" },
                    ]}
                  />
                </SettingRow>
                <SettingRow title="Include source maps" desc="Generate .map files alongside the output for debugging." comingSoon>
                  <Toggle checked={settings.includeSourceMaps} onChange={(v) => set("includeSourceMaps", v)} label="Include source maps" disabled />
                </SettingRow>
                <SettingRow title="Output directory" desc="Custom directory for exported builds. Leave empty to use the project default." comingSoon>
                  <div className="rowInputWithButton">
                    <input className="control mono" value={settings.exportOutputDir ?? ""} readOnly placeholder="Project default" disabled />
                    <Button size="sm" icon="folder-open" onClick={pickExportDir} disabled>Change</Button>
                  </div>
                </SettingRow>
                <SettingRow title="Auto-open after export" desc="Open the generated site in your default browser when export finishes." comingSoon>
                  <Toggle checked={settings.autoOpenAfterExport} onChange={(v) => set("autoOpenAfterExport", v)} label="Auto-open after export" disabled />
                </SettingRow>
                <p className="hint" style={{ marginTop: "var(--sp-2)" }}>
                  Code export is part of the publishing pipeline, which arrives in a later phase.
                </p>
              </SettingSection>
            )}

            {section === "runtime" && (
              <SettingSection title="Bundled runtime" icon="code">
                <SettingRow title="Status">
                  <span style={{ color: "var(--success)", fontSize: "var(--fs-sm)" }}>● Ready</span>
                </SettingRow>
                <SettingRow title="Node version" desc="The bundled Node/Bun runtime version.">
                  <span className="mono" style={{ fontSize: "var(--fs-sm)" }}>not bundled yet</span>
                </SettingRow>
                <SettingRow title="Cache size">
                  <span className="mono" style={{ fontSize: "var(--fs-sm)" }}>
                    {cacheStats.projectsCached ? `${cacheStats.manifestsCached} manifests` : "empty"}
                  </span>
                </SettingRow>
                <SettingRow title="Clear cache" desc="Remove cached build artifacts." comingSoon>
                  <Button variant="ghost" size="sm" icon="check" disabled>Clear cache</Button>
                </SettingRow>
                <p className="hint" style={{ marginTop: "var(--sp-2)" }}>
                  The bundled Node/Bun runtime for scaffolding target projects ships in a later phase.
                </p>
              </SettingSection>
            )}

            {section === "updates" && (
              <SettingSection title="Updates" icon="publish">
                <SettingRow title="Version">
                  <span className="mono" style={{ fontSize: "var(--fs-sm)" }}>
                    v{import.meta.env.VITE_APP_VERSION || "0.0.0"}
                  </span>
                </SettingRow>
                <SettingRow title="Check for updates" desc="Look for a newer version of Scaffold." comingSoon>
                  <Button variant="secondary" size="sm" icon="check" onClick={() => checkForUpdates()} disabled>
                    Check for updates
                  </Button>
                </SettingRow>
                <p className="hint" style={{ marginTop: "var(--sp-2)" }}>
                  Auto-update with signed deltas lands alongside first release builds.
                </p>
              </SettingSection>
            )}

            {section === "itchio" && (
              <SettingSection title="Product pages" icon="external">
                <SettingRow title="Scaffold on itch.io" desc="Your public product page.">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="external"
                    onClick={() => isTauri() && open("https://devvyyxyz.itch.io/scaffold")}
                  >
                    Open
                  </Button>
                </SettingRow>
              </SettingSection>
            )}

            {section === "developer" && (
              <SettingSection title="Developer" icon="settings">
                <SettingRow title="Verbose logging" desc="Enable debug-level logging in the browser console." comingSoon>
                  <Toggle checked={settings.verboseLogging} onChange={(v) => set("verboseLogging", v)} label="Verbose logging" disabled />
                </SettingRow>
                <SettingRow title="Open DevTools on start" desc="Automatically open browser DevTools when the app launches." comingSoon>
                  <Toggle checked={settings.openDevToolsOnStart} onChange={(v) => set("openDevToolsOnStart", v)} label="Open DevTools on start" disabled />
                </SettingRow>
                <SettingRow title="Backend log level" desc="Controls the verbosity of the Rust/Tauri backend logs." comingSoon>
                  <Select
                    value={settings.backendLogLevel}
                    onChange={(e) => set("backendLogLevel", e.target.value as AppSettings["backendLogLevel"])}
                    disabled
                  >
                    <option value="off">Off</option>
                    <option value="error">Error</option>
                    <option value="warn">Warn</option>
                    <option value="info">Info</option>
                    <option value="debug">Debug</option>
                    <option value="trace">Trace</option>
                  </Select>
                </SettingRow>
                
                <SettingRow title="Modal previews" desc="Preview confirmation dialogs and error screens.">
                  <div style={{ display: "flex", gap: "var(--sp-2)", flexWrap: "wrap" }}>
                    <Button variant="secondary" size="sm" icon="trash" onClick={() => setPreviewModal("archive")}>
                      Archive confirm
                    </Button>
                    <Button variant="secondary" size="sm" icon="copy" onClick={() => setPreviewModal("duplicate")}>
                      Duplicate confirm
                    </Button>
                    <Button variant="secondary" size="sm" icon="alert-triangle" onClick={() => setPreviewModal("error")}>
                      Error screen
                    </Button>
                  </div>
                </SettingRow>

                {previewModal && (
                  <div style={{ marginTop: "var(--sp-4)" }}>
                    {previewModal === "archive" && (
                      <ConfirmDialog
                        open={true}
                        title="Archive this project?"
                        message="This is a preview of the archive confirmation dialog. In production, this would archive the selected project."
                        confirmLabel="Archive"
                        tone="default"
                        onConfirm={() => { setPreviewModal(null); }}
                        onCancel={() => setPreviewModal(null)}
                      />
                    )}
                    {previewModal === "duplicate" && (
                      <ConfirmDialog
                        open={true}
                        title="Duplicate this project?"
                        message="This is a preview of the duplicate confirmation dialog. In production, this would create a copy of the selected project."
                        confirmLabel="Duplicate"
                        tone="default"
                        onConfirm={() => { setPreviewModal(null); }}
                        onCancel={() => setPreviewModal(null)}
                      />
                    )}
                    {previewModal === "error" && (
                      <div className="errorScreen" style={{ position: "fixed", inset: 0, zIndex: 9999 }}>
                        <div className="errorContainer">
                          <div className="errorIcon">
                            <Icon name="alert-triangle" size={48} />
                          </div>
                          <h1 className="errorTitle">Something went wrong</h1>
                          <p className="errorMessage">ReferenceError: Can't find variable: confirming</p>
                          <details className="errorDetails">
                            <summary>Technical details</summary>
                            <pre className="errorStack">This is a preview of the error boundary screen. In production, this would show the actual error stack trace.</pre>
                          </details>
                          <div className="errorActions">
                            <Button variant="primary" icon="refresh" onClick={() => setPreviewModal(null)}>
                              Try again
                            </Button>
                            <Button variant="ghost" onClick={() => setPreviewModal(null)}>
                              Go to dashboard
                            </Button>
                          </div>
                          <p className="errorHint">If this problem persists, please report it on GitHub or Discord.</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <SettingRow title="Clear cache" desc="Clear in-memory caches for projects and manifests. The app will reload data from disk.">
                  <Button variant="ghost" size="sm" icon="trash" onClick={handleClearCache}>
                    Clear cache
                  </Button>
                </SettingRow>

                {showClearCacheModal && (
                  <div style={{ marginTop: "var(--sp-4)" }}>
                    <div className="card" style={{ maxWidth: 400 }}>
                      <h3 style={{ fontSize: "var(--fs-base)", fontWeight: "var(--fw-semibold)", marginBottom: "var(--sp-3)" }}>
                        Clear cache
                      </h3>
                      <p style={{ fontSize: "var(--fs-sm)", color: "var(--fg-secondary)", marginBottom: "var(--sp-4)" }}>
                        Select what to clear:
                      </p>
                      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)", marginBottom: "var(--sp-4)" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={clearCacheOptions.projects}
                            onChange={(e) => setClearCacheOptions({ ...clearCacheOptions, projects: e.target.checked })}
                          />
                          <span style={{ fontSize: "var(--fs-sm)" }}>Projects list ({cacheStats.projectsCached ? "cached" : "empty"})</span>
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={clearCacheOptions.manifests}
                            onChange={(e) => setClearCacheOptions({ ...clearCacheOptions, manifests: e.target.checked })}
                          />
                          <span style={{ fontSize: "var(--fs-sm)" }}>Manifests ({cacheStats.manifestsCached} cached)</span>
                        </label>
                      </div>
                      <div style={{ display: "flex", gap: "var(--sp-2)", justifyContent: "flex-end" }}>
                        <Button variant="ghost" size="sm" onClick={() => setShowClearCacheModal(false)}>
                          Cancel
                        </Button>
                        <Button variant="primary" size="sm" icon="trash" onClick={confirmClearCache}>
                          Clear selected
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                <p className="hint" style={{ marginTop: "var(--sp-3)" }}>
                  Developer tooling (logging wiring, DevTools control, backend log routing) is not yet hooked up — these options will activate in a later phase.
                </p>
              </SettingSection>
            )}

            {section === "about" && (
              <>
                {/* ---- Hero header ---- */}
                <div className="aboutHero">
                  <div className="aboutHeroLogo">
                    <Logo size={56} />
                  </div>
                  <div className="aboutHeroText">
                    <div className="aboutHeroName">
                      Scaffold
                      <span className="aboutVersionPill">
                        v{import.meta.env.VITE_APP_VERSION || "0.0.0"}
                      </span>
                    </div>
                    <div className="aboutHeroTagline">
                      Local-first visual React site builder.
                    </div>
                  </div>
                </div>

                {/* ---- Quick links ---- */}
                <div className="aboutLinkGrid">
                  <button
                    className="aboutLinkCard"
                    onClick={() => isTauri() && open("https://discord.gg/scaffold")}
                  >
                    <span className="aboutLinkIcon"><Icon name="discord" size={18} /></span>
                    <span className="aboutLinkBody">
                      <span className="aboutLinkTitle">Community Discord</span>
                      <span className="aboutLinkDesc">Join the community, get help, and share what you build.</span>
                    </span>
                    <Icon name="chevron-right" size={16} className="aboutLinkChevron" />
                  </button>

                  <button
                    className="aboutLinkCard"
                    onClick={() => isTauri() && open("https://github.com/devvyyxyz/scaffold")}
                  >
                    <span className="aboutLinkIcon"><Icon name="github" size={18} /></span>
                    <span className="aboutLinkBody">
                      <span className="aboutLinkTitle">Source &amp; docs</span>
                      <span className="aboutLinkDesc">View the source and read the docs on GitHub.</span>
                    </span>
                    <Icon name="chevron-right" size={16} className="aboutLinkChevron" />
                  </button>

                  <button
                    className="aboutLinkCard"
                    onClick={() => isTauri() && open("https://github.com/devvyyxyz/scaffold/issues")}
                  >
                    <span className="aboutLinkIcon"><Icon name="external" size={18} /></span>
                    <span className="aboutLinkBody">
                      <span className="aboutLinkTitle">Report an issue</span>
                      <span className="aboutLinkDesc">Found a bug or have a feature request? Let us know.</span>
                    </span>
                    <Icon name="chevron-right" size={16} className="aboutLinkChevron" />
                  </button>

                  <button
                    className="aboutLinkCard"
                    onClick={() => {
                      if (isTauri() && settings.defaultProjectDir) {
                        Command.create("open", [settings.defaultProjectDir]).execute();
                      }
                    }}
                  >
                    <span className="aboutLinkIcon"><Icon name="folder-open" size={18} /></span>
                    <span className="aboutLinkBody">
                      <span className="aboutLinkTitle">Reveal project folder</span>
                      <span className="aboutLinkDesc">Open your default project location in Finder.</span>
                    </span>
                    <Icon name="chevron-right" size={16} className="aboutLinkChevron" />
                  </button>
                </div>

                {/* ---- Tech details ---- */}
                <div className="card">
                  <div className="cardTitle">Details</div>
                  <div className="stack-sm" style={{ fontSize: "var(--fs-sm)" }}>
                    <div className="aboutDetailRow">
                      <span className="muted">Version</span>
                      <span className="mono">{import.meta.env.VITE_APP_VERSION || "0.0.0"}</span>
                    </div>
                    <div className="aboutDetailRow">
                      <span className="muted">Built with</span>
                      <span>React, Tauri &amp; Zustand</span>
                    </div>
                    <div className="aboutDetailRow">
                      <span className="muted">Identifier</span>
                      <span className="mono">app.scaffold.builder</span>
                    </div>
                  </div>
                  <p className="hint" style={{ marginTop: "var(--sp-3)" }}>
                    Scaffold runs entirely on your machine. No accounts, no cloud sync — your projects and settings never leave this device.
                  </p>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function formatShortcutKeys(keys: string[][]): React.ReactNode {
  return keys.map((chord, ci) => (
    <span key={ci} style={{ display: "flex", alignItems: "center", gap: 3 }}>
      {ci > 0 && <span className="kbdSeparator">or</span>}
      {chord.map((k, ki) => (
        <span key={ki}>
          {ki > 0 && <span className="kbdSeparator">+</span>}
          <kbd className={`kbd ${k === "Cmd" || k === "Shift" || k === "Ctrl" || k === "Alt" ? "kbdMod" : ""}`}>{k}</kbd>
        </span>
      ))}
    </span>
  ));
}

function KeyboardSection() {
  const [recording, setRecording] = useState<string | null>(null);
  const shortcuts = useAppStore((s) => s.settings.keyboardShortcuts);
  const setKeyboardShortcuts = useAppStore((s) => s.setKeyboardShortcuts);

  // Group by category.
  const groups = useMemo(() => {
    const catOrder: KeyboardShortcut["category"][] = ["General", "Navigation", "Editor", "Canvas"];
    const all = Object.values(shortcuts);
    return catOrder
      .map((cat) => ({ category: cat, items: all.filter((s) => s.category === cat) }))
      .filter((g) => g.items.length > 0);
  }, [shortcuts]);

  function commit(next: Record<string, KeyboardShortcut>) {
    void setKeyboardShortcuts(next);
  }

  function startRecording(id: string) {
    setRecording(id);
  }

  function handleRecordKey(e: React.KeyboardEvent) {
    if (!recording) return;
    e.preventDefault();
    e.stopPropagation();

    const parts: string[] = [];
    if (e.metaKey) parts.push("Cmd");
    if (e.ctrlKey) parts.push("Ctrl");
    if (e.shiftKey) parts.push("Shift");
    if (e.altKey) parts.push("Alt");

    // Don't record modifier-only chords.
    const key = e.key;
    if (key === "Meta" || key === "Control" || key === "Shift" || key === "Alt") return;

    parts.push(key === " " ? "Space" : key);

    const prev = shortcuts;
    const updated = { ...prev };
    if (updated[recording]) {
      updated[recording] = { ...updated[recording], keys: [parts] };
    }
    commit(updated);
    setRecording(null);
  }

  function resetShortcut(id: string) {
    const prev = shortcuts;
    const updated = { ...prev };
    if (updated[id]) {
      updated[id] = { ...updated[id], keys: updated[id].defaults.map((c) => [...c]) };
    }
    commit(updated);
  }

  function resetAll() {
    const prev = shortcuts;
    const updated = { ...prev };
    for (const id of Object.keys(updated)) {
      updated[id] = { ...updated[id], keys: updated[id].defaults.map((c) => [...c]) };
    }
    commit(updated);
  }

  const hasChanges = Object.values(shortcuts).some(
    (s) => JSON.stringify(s.keys) !== JSON.stringify(s.defaults),
  );

  return (
    <SettingSection title="Shortcuts" icon="keyboard">
      {groups.map((group) => (
        <div key={group.category} style={{ marginBottom: "var(--sp-3)" }}>
          <div
            style={{
              fontSize: "var(--fs-xs)",
              fontWeight: "var(--fw-semibold)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--fg-muted)",
              marginBottom: "var(--sp-1)",
              padding: "0 var(--sp-1)",
            }}
          >
            {group.category}
          </div>
          <div className="keyboardShortcutList">
            {group.items.map((shortcut) => {
              const isRecording = recording === shortcut.id;
              return (
                <div
                  key={shortcut.id}
                  className={`keyboardShortcutRow ${isRecording ? "recording" : ""}`}
                  tabIndex={0}
                  onKeyDown={isRecording ? handleRecordKey : undefined}
                >
                  <div className="keyboardShortcutRowLabel">
                    <div className="keyboardShortcutRowTitle">{shortcut.label}</div>
                    {shortcut.description && (
                      <div className="keyboardShortcutRowDesc">{shortcut.description}</div>
                    )}
                  </div>
                  <div className="keyboardShortcutRowKeys">
                    {isRecording ? (
                      <span className="recordingBadge">
                        <span className="recordingDot" />
                        Press keys…
                      </span>
                    ) : (
                      formatShortcutKeys(shortcut.keys)
                    )}
                    <button
                      className="keyboardResetBtn"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isRecording) {
                          setRecording(null);
                        } else {
                          startRecording(shortcut.id);
                        }
                      }}
                      title={isRecording ? "Cancel" : "Rebind"}
                      style={{ marginLeft: "var(--sp-2)" }}
                    >
                      {isRecording ? "×" : <Icon name="code" size={12} />}
                    </button>
                    {JSON.stringify(shortcut.keys) !== JSON.stringify(shortcut.defaults) && (
                      <button
                        className="keyboardResetBtn"
                        onClick={(e) => {
                          e.stopPropagation();
                          resetShortcut(shortcut.id);
                        }}
                        title="Reset to default"
                      >
                        ↺
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {hasChanges && (
        <div style={{ marginTop: "var(--sp-4)" }}>
          <Button
            variant="ghost"
            size="sm"
            icon="settings"
            onClick={resetAll}
          >
            Reset all to defaults
          </Button>
        </div>
      )}

      <p className="hint" style={{ marginTop: "var(--sp-4)" }}>
        Click the <Icon name="code" size={12} /> icon next to a shortcut to rebind it. Changes apply instantly.
      </p>
    </SettingSection>
  );
}

async function checkForUpdates() {
  // Placeholder — real updater wiring is a later phase (needs signed releases).
}
