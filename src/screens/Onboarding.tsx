import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useAppStore } from "../lib/store";
import { defaultProjectDir } from "../lib/paths";
import { isTauri, isOnboardingWindow, closeOnboardingWindow } from "../lib/ipc";
import { ThemePref, ProjectStack, ProjectTemplate, AutoSaveInterval, AppSettings } from "../lib/types";
import { Button } from "../components/ui/Button";
import { Icon, IconName } from "../components/ui/Icon";
import { Logo } from "../components/ui/Logo";
import { OptionCard, Field, Segmented, Select } from "../components/ui/Field";
import { applyTheme } from "../lib/store";
import "./screens.css";

const THEME_OPTIONS: { value: ThemePref; label: string; icon: IconName; desc: string }[] = [
  { value: "light", label: "Light", icon: "sun", desc: "Bright and crisp" },
  { value: "dark", label: "Dark", icon: "moon", desc: "Easy on the eyes" },
  { value: "system", label: "System", icon: "monitor", desc: "Match my OS" },
];

const STACKS: { value: ProjectStack; title: string; desc: string; icon: IconName }[] = [
  { value: "vite", title: "Vite", desc: "Fast SPA. React + Vite.", icon: "sparkles" },
  { value: "next", title: "Next.js", desc: "SSR / SSG. App router.", icon: "layers" },
  { value: "remix", title: "Remix", desc: "Nested routes, edge-ready.", icon: "layers" },
  { value: "plain", title: "Plain HTML", desc: "No framework. Static only.", icon: "code" },
];

const TEMPLATES: { value: ProjectTemplate; title: string; desc: string; icon: IconName }[] = [
  { value: "landing", title: "Landing Page", desc: "Hero, features, CTA.", icon: "publish" },
  { value: "blog", title: "Blog", desc: "Posts, listing, article.", icon: "editor" },
  { value: "docs", title: "Docs", desc: "Sidebar, content, search.", icon: "folder-open" },
  { value: "blank", title: "Blank", desc: "Start from scratch.", icon: "plus" },
];

interface StepDef {
  label: string;
}

const STEPS: StepDef[] = [
  { label: "Theme" },
  { label: "Stack" },
  { label: "Template" },
  { label: "Folder" },
  { label: "General" },
  { label: "Privacy" },
];

export function Onboarding() {
  const complete = useAppStore((s) => s.completeOnboarding);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemePref>("system");
  const [defaultStack, setDefaultStack] = useState<ProjectStack>("vite");
  const [defaultTemplate, setDefaultTemplate] = useState<ProjectTemplate>("landing");
  const [telemetry, setTelemetry] = useState(false);
  const [autoSaveInterval, setAutoSaveInterval] = useState<AutoSaveInterval>(60);
  const [showWelcomeScreen, setShowWelcomeScreen] = useState(true);
  const [language, setLanguage] = useState("en");

  // Pre-seed the default directory suggestion and apply live theme previews.
  // Also set body background so there's no gap around the frosted window.
  useEffect(() => {
    defaultProjectDir().then((d) => setDir(d));
    document.body.style.background = "transparent";
    return () => {
      document.body.style.background = "";
    };
  }, []);
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  async function pickFolder() {
    if (!isTauri()) {
      setDir("/tmp/Scaffold-projects");
      return;
    }
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string") setDir(selected);
  }

  function buildSettings(): Partial<AppSettings> {
    return {
      defaultStack,
      defaultTemplate,
      language,
      telemetry,
      autoSaveInterval,
      showWelcomeScreen,
      pageTitlePrefix: "",
      metaDescriptionTemplate: "{{page}} — Built with Scaffold",
    };
  }

  async function handleComplete() {
    if (!dir) return;
    await complete(dir, theme, buildSettings());
    if (isOnboardingWindow()) {
      await closeOnboardingWindow();
    }
  }

  const isLastStep = step === STEPS.length - 1;

  function canAdvance(): boolean {
    if (step === 0) return true; // theme always selected
    if (step === 3) return !!dir; // folder required
    return true;
  }

  async function handleNext() {
    if (isLastStep) {
      await handleComplete();
    } else {
      setStep(step + 1);
    }
  }

  return (
    <div className="onboarding">
      <div className="onboardingHeader">
        <div className="brand" style={{ justifyContent: "center" }}>
          <div className="brandMark" style={{ width: 36, height: 36 }}>
            <Logo size={20} />
          </div>
        </div>
        <h1 style={{ fontSize: "var(--fs-xl)", textAlign: "center" }}>Welcome to Scaffold</h1>
        <p className="muted" style={{ textAlign: "center", fontSize: "var(--fs-sm)", marginTop: "var(--sp-1)" }}>
          The local-first visual builder for React sites. Let's get you set up.
        </p>
      </div>

      {/* Step indicator — compact dots with no labels (title is shown in body) */}
      <div className="wizardSteps">
        {STEPS.map((_, i) => (
          <div key={i} className={`wizardStepDot ${i === step ? "active" : i < step ? "done" : ""}`}>
            <span className="wizardStepNum">
              {i < step ? <Icon name="check" size={10} /> : i + 1}
            </span>
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="onboardingBody">
        {step === 0 && (
          <div className="onboardingStepContent">
            <h2 className="onboardingStepTitle">Pick a theme</h2>
            <p className="hint" style={{ marginBottom: "var(--sp-5)" }}>
              Choose your preferred look for the app. You can change this later in Settings.
            </p>
            <div className="optionGrid">
              {THEME_OPTIONS.map((opt) => (
                <OptionCard
                  key={opt.value}
                  title={opt.label}
                  desc={opt.desc}
                  icon={<Icon name={opt.icon} size={18} />}
                  selected={theme === opt.value}
                  onClick={() => setTheme(opt.value)}
                />
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="onboardingStepContent">
            <h2 className="onboardingStepTitle">Default stack</h2>
            <p className="hint" style={{ marginBottom: "var(--sp-5)" }}>
              Which framework should new projects use by default?
            </p>
            <div className="optionGrid">
              {STACKS.map((s) => (
                <OptionCard
                  key={s.value}
                  title={s.title}
                  desc={s.desc}
                  icon={<Icon name={s.icon} size={18} />}
                  selected={defaultStack === s.value}
                  onClick={() => setDefaultStack(s.value)}
                />
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="onboardingStepContent">
            <h2 className="onboardingStepTitle">Default template</h2>
            <p className="hint" style={{ marginBottom: "var(--sp-5)" }}>
              What kind of site do you usually build? You can pick a different one each time.
            </p>
            <div className="optionGrid">
              {TEMPLATES.map((t) => (
                <OptionCard
                  key={t.value}
                  title={t.title}
                  desc={t.desc}
                  icon={<Icon name={t.icon} size={18} />}
                  selected={defaultTemplate === t.value}
                  onClick={() => setDefaultTemplate(t.value)}
                />
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="onboardingStepContent">
            <h2 className="onboardingStepTitle">Project folder</h2>
            <p className="hint" style={{ marginBottom: "var(--sp-5)" }}>
              Where should new projects live? A subfolder will be created for each project.
            </p>
            <Field label="Location">
              <div className="inputRow">
                <input className="control" value={dir ?? "Select a folder…"} readOnly placeholder="Select a folder" />
                <Button icon="folder-open" onClick={pickFolder}>Choose</Button>
              </div>
            </Field>
          </div>
        )}

        {step === 4 && (
          <div className="onboardingStepContent">
            <h2 className="onboardingStepTitle">General settings</h2>
            <p className="hint" style={{ marginBottom: "var(--sp-5)" }}>
              A few preferences to get you started.
            </p>
            <div className="stack">
              <Field label="Language">
                <Select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  <option value="en">English</option>
                </Select>
              </Field>

              <Field label="Auto-save" hint="Automatically save editor changes at this interval.">
                <Select
                  value={autoSaveInterval}
                  onChange={(e) => setAutoSaveInterval(Number(e.target.value) as AutoSaveInterval)}
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
                  value={showWelcomeScreen ? "on" : "off"}
                  onChange={(v) => setShowWelcomeScreen(v === "on")}
                  options={[
                    { value: "on", label: "On" },
                    { value: "off", label: "Off" },
                  ]}
                />
              </Field>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="onboardingStepContent">
            <h2 className="onboardingStepTitle">Privacy</h2>
            <p className="hint" style={{ marginBottom: "var(--sp-5)" }}>
              Scaffold is local-first — everything stays on your machine.
            </p>
            <Field label="Telemetry" hint="Anonymous usage data helps improve Scaffold. Off by default.">
              <Segmented
                value={telemetry ? "on" : "off"}
                onChange={(v) => setTelemetry(v === "on")}
                options={[
                  { value: "on", label: "On" },
                  { value: "off", label: "Off" },
                ]}
              />
            </Field>
          </div>
        )}

      </div>

      {/* Navigation */}
      <div className="onboardingFooter">
        {step > 0 && (
          <Button variant="ghost" onClick={() => setStep(step - 1)}>
            Back
          </Button>
        )}
        <div style={{ flex: 1 }} />
        <Button
          variant="primary"
          icon={isLastStep ? "check" : "chevron-right"}
          disabled={!canAdvance()}
          onClick={handleNext}
        >
          {isLastStep ? "Get started" : "Next"}
        </Button>
      </div>
    </div>
  );
}