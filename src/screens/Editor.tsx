import { useState } from "react";
import { useAppStore } from "../lib/store";
import { Icon, IconName } from "../components/ui/Icon";
import { Segmented } from "../components/ui/Field";
import { EmptyState } from "../components/EmptyState";
import { Button } from "../components/ui/Button";
import "./screens.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Device = "desktop" | "tablet" | "mobile";
const DEVICE_WIDTH: Record<Device, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "390px",
};

type ComponentKind = "hero" | "features" | "navbar" | "footer" | "cta" | "testimonial";

interface CanvasComponent {
  id: string;
  kind: ComponentKind;
}

// ---------------------------------------------------------------------------
// Component registry — defines the blocks available in the right panel
// ---------------------------------------------------------------------------

interface ComponentBlock {
  kind: ComponentKind;
  label: string;
  icon: IconName;
  /** Default props used when a new instance is placed on the canvas. */
  defaultProps: Record<string, string>;
}

const COMPONENT_BLOCKS: ComponentBlock[] = [
  {
    kind: "hero",
    label: "Hero",
    icon: "publish",
    defaultProps: {
      title: "Build something amazing",
      subtitle: "Start with a blank canvas and create your dream project.",
      cta: "Get Started",
    },
  },
  {
    kind: "features",
    label: "Features",
    icon: "layers",
    defaultProps: {
      heading: "Why choose us",
      items: "Fast, Reliable, Scalable",
    },
  },
  {
    kind: "navbar",
    label: "Navbar",
    icon: "dashboard",
    defaultProps: {
      brand: "My Site",
      links: "Home, About, Contact",
    },
  },
  {
    kind: "footer",
    label: "Footer",
    icon: "code",
    defaultProps: {
      text: "© 2026 My Site. All rights reserved.",
    },
  },
  {
    kind: "cta",
    label: "CTA",
    icon: "sparkles",
    defaultProps: {
      heading: "Ready to get started?",
      body: "Join thousands of happy users today.",
      button: "Sign Up Free",
    },
  },
  {
    kind: "testimonial",
    label: "Testimonial",
    icon: "eye",
    defaultProps: {
      quote: "This tool changed the way I build websites.",
      author: "Jane Doe, Designer",
    },
  },
];

// ---------------------------------------------------------------------------
// Canvas component renderers
// ---------------------------------------------------------------------------

function renderCanvasBlock(block: ComponentBlock) {
  const p = block.defaultProps;
  switch (block.kind) {
    case "hero":
      return (
        <div className="canvasBlockHero">
          <h1 className="canvasHeroTitle">{p.title}</h1>
          <p className="canvasHeroSub">{p.subtitle}</p>
          <span className="canvasHeroCta">{p.cta}</span>
        </div>
      );
    case "features":
      return (
        <div className="canvasBlockFeatures">
          <h2 className="canvasFeaturesHeading">{p.heading}</h2>
          <div className="canvasFeaturesGrid">
            {p.items.split(", ").map((item) => (
              <div key={item} className="canvasFeatureCard">
                <Icon name="sparkles" size={18} />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      );
    case "navbar":
      return (
        <div className="canvasBlockNavbar">
          <span className="canvasNavbarBrand">{p.brand}</span>
          <div className="canvasNavbarLinks">
            {p.links.split(", ").map((link) => (
              <span key={link} className="canvasNavbarLink">{link}</span>
            ))}
          </div>
        </div>
      );
    case "footer":
      return (
        <div className="canvasBlockFooter">
          <span>{p.text}</span>
        </div>
      );
    case "cta":
      return (
        <div className="canvasBlockCta">
          <h2 className="canvasCtaHeading">{p.heading}</h2>
          <p className="canvasCtaBody">{p.body}</p>
          <span className="canvasCtaButton">{p.button}</span>
        </div>
      );
    case "testimonial":
      return (
        <div className="canvasBlockTestimonial">
          <p className="canvasTestimonialQuote">"{p.quote}"</p>
          <span className="canvasTestimonialAuthor">— {p.author}</span>
        </div>
      );
  }
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

let _nextId = 0;
function makeId(): string {
  return `c-${Date.now().toString(36)}-${(++_nextId).toString(36)}`;
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

export function Editor({ projectId }: { projectId: string }) {
  const projects = useAppStore((s) => s.projects);
  const navigate = useAppStore((s) => s.navigate);
  const [device, setDevice] = useState<Device>("desktop");

  // Canvas state
  const [canvas, setCanvas] = useState<CanvasComponent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const project = projects.find((p) => p.id === projectId);

  if (!project) {
    return (
      <div className="screen">
        <EmptyState
          icon="folder-open"
          title="Project not found"
          desc="This project may have been moved or removed from the registry."
          actions={<Button variant="primary" onClick={() => navigate({ name: "dashboard" })}>Back to projects</Button>}
        />
      </div>
    );
  }

  // ---- actions ----

  function addComponent(kind: ComponentKind) {
    setCanvas((prev) => [...prev, { id: makeId(), kind }]);
  }

  function removeSelected() {
    if (!selectedId) return;
    setCanvas((prev) => prev.filter((c) => c.id !== selectedId));
    setSelectedId(null);
  }

  function moveComponent(index: number, dir: -1 | 1) {
    setCanvas((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  // ---- render ----

  return (
    <div className="screen" style={{ padding: "var(--sp-4)", gap: "var(--sp-3)" }}>
      {/* Device switcher */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <Segmented
          value={device}
          onChange={setDevice}
          options={[
            { value: "desktop", label: "Desktop", icon: <Icon name="desktop" size={14} /> },
            { value: "tablet", label: "Tablet", icon: <Icon name="tablet" size={14} /> },
            { value: "mobile", label: "Mobile", icon: <Icon name="mobile" size={14} /> },
          ]}
        />
      </div>

      <div className="editorGrid" style={{ flex: 1, minHeight: 0 }}>
        {/* ---- Pages ---- */}
        <div className="editorPane">
          <div className="paneTitle">Pages</div>
          <div className="stack-sm">
            <div className="navItem" style={{ height: 30, paddingLeft: "var(--sp-2)" }}>
              <Icon name="editor" size={14} /> <span style={{ fontSize: "var(--fs-sm)" }}>/</span>
            </div>
          </div>
          <Button variant="ghost" size="sm" icon="plus" block style={{ marginTop: "var(--sp-3)" }}>
            Add page
          </Button>
        </div>

        {/* ---- Canvas ---- */}
        <div className="editorCanvas">
          <div
            className="editorCanvasFrame"
            style={{ width: DEVICE_WIDTH[device] }}
            onClick={() => setSelectedId(null)}
          >
            {canvas.length === 0 ? (
              <div className="canvasEmpty">
                <Icon name="plus" size={28} />
                <div style={{ fontSize: "var(--fs-sm)", marginTop: "var(--sp-2)" }}>
                  Click a component to add it
                </div>
              </div>
            ) : (
              canvas.map((c, i) => {
                const block = COMPONENT_BLOCKS.find((b) => b.kind === c.kind);
                if (!block) return null;
                const isSelected = c.id === selectedId;
                return (
                  <div
                    key={c.id}
                    className={`canvasBlock${isSelected ? " selected" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedId(c.id);
                    }}
                  >
                    {renderCanvasBlock(block)}
                    {isSelected && (
                      <div className="canvasBlockToolbar">
                        <button
                          className="canvasToolbarBtn"
                          title="Move up"
                          onClick={(e) => { e.stopPropagation(); moveComponent(i, -1); }}
                          disabled={i === 0}
                        >
                          <Icon name="chevron-right" size={12} style={{ transform: "rotate(-90deg)" }} />
                        </button>
                        <button
                          className="canvasToolbarBtn"
                          title="Move down"
                          onClick={(e) => { e.stopPropagation(); moveComponent(i, 1); }}
                          disabled={i === canvas.length - 1}
                        >
                          <Icon name="chevron-right" size={12} style={{ transform: "rotate(90deg)" }} />
                        </button>
                        <button
                          className="canvasToolbarBtn danger"
                          title="Remove"
                          onClick={(e) => { e.stopPropagation(); setCanvas((prev) => prev.filter((x) => x.id !== c.id)); setSelectedId(null); }}
                        >
                          <Icon name="close" size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ---- Components + Style ---- */}
        <div className="editorPane">
          <div className="paneTitle">Components</div>
          <div className="componentGrid">
            {COMPONENT_BLOCKS.map((b) => (
              <button
                key={b.kind}
                className="componentBlock"
                onClick={() => addComponent(b.kind)}
                title={`Add ${b.label}`}
              >
                <Icon name={b.icon} size={16} />
                {b.label}
              </button>
            ))}
          </div>

          {selectedId && (
            <div style={{ marginTop: "var(--sp-4)" }}>
              <Button variant="danger" size="sm" icon="close" block onClick={removeSelected}>
                Remove selected
              </Button>
            </div>
          )}

          <div className="paneTitle" style={{ marginTop: "var(--sp-5)" }}>Style</div>
          <div className="stack-sm">
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--fs-xs)" }}>
              <span className="muted">Font</span>
              <span>Inter</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--fs-xs)" }}>
              <span className="muted">Radius</span>
              <span>10px</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}