// Deployment Manager — placeholder screen.
//
// The eventual home for configuring how projects are deployed (GitHub Pages,
// Cloudflare Pages, Netlify, Vercel, FTP/SFTP). The integration itself ships
// in a later phase, so every provider is shown as "Coming soon" with a
// disabled connect action. Reachable from the sidebar, which also badges it.

import { Icon, IconName } from "../components/ui/Icon";
import { Button } from "../components/ui/Button";
import "./screens.css";

interface Provider {
  name: string;
  desc: string;
  icon: IconName;
}

const PROVIDERS: Provider[] = [
  {
    name: "GitHub Pages",
    desc: "Push a built site to a gh-pages branch or the docs/ folder of your repository.",
    icon: "github",
  },
  {
    name: "Cloudflare Pages",
    desc: "Deploy to Cloudflare's global edge network with Git-based or direct uploads.",
    icon: "cloud",
  },
  {
    name: "Netlify",
    desc: "Continuous deployment from Git with a global CDN and form handling.",
    icon: "cloud",
  },
  {
    name: "Vercel",
    desc: "Deploy to Vercel with automatic previews and global edge routing.",
    icon: "rocket",
  },
  {
    name: "FTP / SFTP",
    desc: "Upload files directly to your own server over FTP or SFTP.",
    icon: "external",
  },
];

export function DeploymentManager() {
  return (
    <div className="screen">
      <div className="screenHeader">
        <div>
          <h1 className="screenTitle">Deployment Manager</h1>
          <p className="screenSub">
            Connect a hosting provider to publish your projects to the web. Set
            up credentials once, then deploy any project with a click.
          </p>
        </div>
        <div className="comingSoonHeaderPill">Coming soon</div>
      </div>

      <div className="deployProviderGrid">
        {PROVIDERS.map((p) => (
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
                Connect
              </Button>
            </div>
          </div>
        ))}
      </div>

      <p className="hint" style={{ marginTop: "var(--sp-4)" }}>
        Deployment integrations land in a later phase. Your provider credentials
        will be stored locally and never leave your machine.
      </p>
    </div>
  );
}
