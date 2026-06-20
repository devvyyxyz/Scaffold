// In-app documentation window.
//
// Rendered in its own native window (see openDocsWindow / isDocsWindow), so it
// is a standalone two-pane viewer with no AppShell chrome. The "Getting
// Started" pages are written; every other page is a stub describing what it
// will cover, flagged with a "Coming soon" tag. Selection is local state — no
// router/store involvement.

import { useState } from "react";
import { Logo } from "../components/ui/Logo";
import "./docs.css";

// A doc page is either fully written (has prose) or a stub (short description
// of planned content + a Coming soon badge).
type DocPage =
  | { id: string; title: string; written: true; body: DocBlock[] }
  | { id: string; title: string; written: false; desc: string };

interface DocSection {
  title: string;
  pages: DocPage[];
}

type DocBlock =
  | { kind: "p"; text: string }
  | { kind: "h"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "callout"; text: string };

const SECTIONS: DocSection[] = [
  {
    title: "Getting Started",
    pages: [
      {
        id: "welcome",
        title: "Welcome to Scaffold",
        written: true,
        body: [
          {
            kind: "p",
            text: "Scaffold is a local-first visual builder for React sites. You compose pages from blocks, preview them live, and export clean, framework-ready code — all without an account or a cloud. Your projects and settings never leave your machine.",
          },
          { kind: "h", text: "Local-first by design" },
          {
            kind: "p",
            text: "Everything runs on your desktop. There's no sign-in, no sync, and no telemetry unless you opt in. Projects are plain folders on disk, so you can open them in any editor, version them with Git, or deploy them anywhere.",
          },
          {
            kind: "p",
            text: "Use the left sidebar to move between Projects, Archive, Deployment, Plugins, and Settings. The Documentation window you're reading now opens in its own window so you can keep it beside your work.",
          },
        ],
      },
      {
        id: "install",
        title: "Installation & first launch",
        written: true,
        body: [
          { kind: "h", text: "The boot screen" },
          {
            kind: "p",
            text: "When you launch Scaffold, a short boot animation plays while the app loads your saved settings. Click Next once it finishes to continue.",
          },
          { kind: "h", text: "The onboarding wizard" },
          {
            kind: "p",
            text: "On first launch, Scaffold opens a setup window that walks you through the basics: choosing where projects are saved and picking a theme. You can redo this any time from Settings → Restart onboarding.",
          },
          {
            kind: "callout",
            text: "The setup wizard runs in its own window. Once you finish, the main window appears automatically.",
          },
        ],
      },
      {
        id: "first-project",
        title: "Create your first project",
        written: true,
        body: [
          {
            kind: "p",
            text: "From the Projects screen, click New Project to open the project wizard.",
          },
          { kind: "h", text: "Wizard steps" },
          {
            kind: "ul",
            items: [
              "Name — give your project a name. This becomes the folder name (sanitised to lowercase, hyphenated).",
              "Stack — choose the target framework: Vite, Next.js, Remix, or plain HTML.",
              "Template — pick a starter: Landing, Blog, Docs, or Blank.",
              "Location — confirm the parent folder (defaults to your chosen project directory).",
            ],
          },
          {
            kind: "p",
            text: "Scaffold creates the project folder, writes the boilerplate files, and registers it. You'll land back on the Projects screen, where the new project appears as a card.",
          },
        ],
      },
    ],
  },
  {
    title: "Projects",
    pages: [
      {
        id: "managing-projects",
        title: "Managing projects",
        written: false,
        desc: "Opening, duplicating, and revealing projects on disk from the Projects dashboard (grid and list views).",
      },
      {
        id: "folder-structure",
        title: "The project folder structure",
        written: false,
        desc: "What Scaffold writes to disk: the .scaffold/manifest.json marker, package.json, index.html, and src/ boilerplate.",
      },
      {
        id: "archive-restore",
        title: "Archive & restore",
        written: false,
        desc: "Archiving projects, the 30-day retention window, restoring, and permanently deleting.",
      },
    ],
  },
  {
    title: "Editor",
    pages: [
      {
        id: "canvas-overview",
        title: "Canvas overview",
        written: false,
        desc: "The visual canvas, zoom levels, device previews (desktop/tablet/mobile), and the component outline toggle.",
      },
      {
        id: "blocks-components",
        title: "Blocks & components",
        written: false,
        desc: "Adding, reordering, and configuring blocks (Hero, Features, Navbar, Footer, CTA, Testimonial).",
      },
      {
        id: "pages-routing",
        title: "Pages & routing",
        written: false,
        desc: "Creating pages and routes, nesting for navigation, and managing page titles and meta descriptions.",
      },
    ],
  },
  {
    title: "Publishing & Export",
    pages: [
      {
        id: "publishing",
        title: "Publishing a project",
        written: false,
        desc: "The publish flow and one-click itch.io upload via butler (macOS, Linux, Windows).",
      },
      {
        id: "export-formats",
        title: "Export formats",
        written: false,
        desc: "Exporting clean vs. minified code, source maps, and custom output directories.",
      },
    ],
  },
  {
    title: "Deployment Manager",
    pages: [
      {
        id: "connecting-provider",
        title: "Connecting a provider",
        written: false,
        desc: "How provider credentials are stored locally and reused across projects.",
      },
      {
        id: "providers",
        title: "Providers",
        written: false,
        desc: "Supported deployment targets: GitHub Pages, Cloudflare Pages, Netlify, Vercel, and FTP/SFTP.",
      },
    ],
  },
  {
    title: "Plugins",
    pages: [
      {
        id: "installing-plugins",
        title: "Installing plugins",
        written: false,
        desc: "How the plugin system will work: install once, use across projects, all local.",
      },
      {
        id: "available-plugins",
        title: "Available plugins",
        written: false,
        desc: "Planned plugins: Tailwind CSS, Bootstrap, GSAP, Three.js, Discord widgets, Roblox embeds, and Minecraft server status.",
      },
    ],
  },
  {
    title: "Settings",
    pages: [
      {
        id: "preferences-overview",
        title: "Preferences overview",
        written: false,
        desc: "A tour of every Settings tab and which options are currently active versus coming soon.",
      },
      {
        id: "themes",
        title: "Themes",
        written: false,
        desc: "Light, dark, and system themes, and how they apply instantly across the app.",
      },
      {
        id: "developer-mode",
        title: "Developer mode",
        written: false,
        desc: "Unlocking the Developer tab and its debugging options.",
      },
    ],
  },
  {
    title: "Reference",
    pages: [
      {
        id: "keyboard-shortcuts",
        title: "Keyboard shortcuts",
        written: false,
        desc: "Global and editor shortcuts, including Cmd/Ctrl+K for the command palette.",
      },
      {
        id: "data-locations",
        title: "App data & storage locations",
        written: false,
        desc: "Where Scaffold stores settings.json, your projects, and the archive folder on each OS.",
      },
    ],
  },
];

const ALL_PAGES: DocPage[] = SECTIONS.flatMap((s) => s.pages);

export function Docs() {
  const [activeId, setActiveId] = useState<string>(ALL_PAGES[0].id);
  const active = ALL_PAGES.find((p) => p.id === activeId) ?? ALL_PAGES[0];

  return (
    <div className="docsWin">
      <header className="docsHeader">
        <div className="docsBrand">
          <Logo size={20} />
          <span className="docsBrandName">Scaffold</span>
        </div>
        <span className="docsHeaderTitle">Documentation</span>
        <span className="docsVersionPill">
          v{import.meta.env.VITE_APP_VERSION || "0.0.0"}
        </span>
      </header>

      <div className="docsBody">
        <nav className="docsNav scroll-y">
          {SECTIONS.map((section) => (
            <div className="docsNavSection" key={section.title}>
              <div className="docsNavSectionTitle">{section.title}</div>
              {section.pages.map((page) => (
                <button
                  key={page.id}
                  className={`docsNavLink ${page.id === activeId ? "active" : ""}`}
                  onClick={() => setActiveId(page.id)}
                >
                  <span className="docsNavLinkLabel">{page.title}</span>
                  {!page.written && <span className="docsNavLinkTag">Soon</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <main className="docsContent scroll-y">
          {active.written ? (
            <DocArticle page={active} />
          ) : (
            <DocStub page={active} />
          )}
        </main>
      </div>
    </div>
  );
}

function DocArticle({ page }: { page: Extract<DocPage, { written: true }> }) {
  return (
    <article className="docArticle">
      <h1 className="docTitle">{page.title}</h1>
      {page.body.map((block, i) => {
        if (block.kind === "h") return <h2 key={i} className="docH">{block.text}</h2>;
        if (block.kind === "ul")
          return (
            <ul key={i} className="docUl">
              {block.items.map((it, j) => (
                <li key={j}>{it}</li>
              ))}
            </ul>
          );
        if (block.kind === "callout")
          return (
            <div key={i} className="docCallout">
              {block.text}
            </div>
          );
        return <p key={i} className="docP">{block.text}</p>;
      })}
    </article>
  );
}

function DocStub({ page }: { page: Extract<DocPage, { written: false }> }) {
  return (
    <article className="docArticle">
      <div className="docTitleLine">
        <h1 className="docTitle">{page.title}</h1>
        <span className="comingSoonTag">Coming soon</span>
      </div>
      <p className="docP docStubDesc">{page.desc}</p>
      <p className="docP faint">
        This page hasn't been written yet. It will be filled in as the feature it
        documents becomes available.
      </p>
    </article>
  );
}
