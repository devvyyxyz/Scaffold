// Plugins — placeholder screen for the future plugin system.
//
// Plugins extend Scaffold with frameworks, animations, and embeddable widgets.
// The plugin loader itself ships in a later phase, so every plugin is shown as
// "Coming soon" with a disabled install action. Reachable from the sidebar,
// which also badges it.

import { Icon, IconName } from "../components/ui/Icon";
import { Button } from "../components/ui/Button";
import "./screens.css";

interface Plugin {
  name: string;
  desc: string;
  icon: IconName;
}

interface PluginCategory {
  title: string;
  plugins: Plugin[];
}

const CATEGORIES: PluginCategory[] = [
  {
    title: "Frameworks & styling",
    plugins: [
      {
        name: "Tailwind CSS",
        desc: "Utility-first CSS framework for rapidly building custom designs.",
        icon: "code",
      },
      {
        name: "Bootstrap",
        desc: "Popular component library with responsive, mobile-first layouts.",
        icon: "package",
      },
    ],
  },
  {
    title: "Animation & 3D",
    plugins: [
      {
        name: "GSAP",
        desc: "Professional-grade animation library for smooth, sequenced motion.",
        icon: "sparkles",
      },
      {
        name: "Three.js",
        desc: "Create and render 3D graphics in the browser with WebGL.",
        icon: "layers",
      },
    ],
  },
  {
    title: "Embeds & widgets",
    plugins: [
      {
        name: "Discord widget",
        desc: "Embed a live Discord server member list or chat widget on a page.",
        icon: "discord",
      },
      {
        name: "Roblox embed",
        desc: "Embed a Roblox game or experience card on your site.",
        icon: "external",
      },
      {
        name: "Minecraft server status",
        desc: "Show live player count and status for a Minecraft server.",
        icon: "monitor",
      },
    ],
  },
];

export function Plugins() {
  return (
    <div className="screen">
      <div className="screenHeader">
        <div>
          <h1 className="screenTitle">Plugins</h1>
          <p className="screenSub">
            Extend Scaffold with frameworks, animation libraries, and embeddable
            widgets. Install once and use them across all your projects.
          </p>
        </div>
        <div className="comingSoonHeaderPill">Coming soon</div>
      </div>

      {CATEGORIES.map((cat) => (
        <section className="pluginCategory" key={cat.title}>
          <h2 className="pluginCategoryTitle">{cat.title}</h2>
          <div className="deployProviderGrid">
            {cat.plugins.map((p) => (
              <div className="deployProviderCard comingSoon" key={p.name}>
                <div className="deployProviderHead">
                  <span className="deployProviderIcon">
                    <Icon name={p.icon} size={20} />
                  </span>
                  <span className="deployProviderName">{p.name}</span>
                  <span className="comingSoonTag">Coming soon</span>
                </div>
                <p className="deployProviderDesc">{p.desc}</p>
                <div className="deployProviderActions">
                  <Button variant="secondary" size="sm" icon="plus" disabled>
                    Install
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <p className="hint">
        The plugin system lands in a later phase. Installed plugins run entirely
        on your machine — nothing is sent to a remote server.
      </p>
    </div>
  );
}
