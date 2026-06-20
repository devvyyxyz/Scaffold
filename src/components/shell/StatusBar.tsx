import { useEffect, useState } from "react";
import { useAppStore } from "../../lib/store";
import { isTauri, getAppVersion } from "../../lib/ipc";
import "./StatusBar.css";

export function StatusBar() {
  const route = useAppStore((s) => s.route);
  const settings = useAppStore((s) => s.settings);
  const [version, setVersion] = useState(import.meta.env.VITE_APP_VERSION || "0.1.0");

  const runtimeLabel = isTauri() ? "Native" : "Browser (dev)";

  useEffect(() => {
    getAppVersion().then(setVersion);
  }, []);

  return (
    <div className="statusbar">
      <div className="group">
        <div className="item">
          <span className="statusDot" />
          Ready
        </div>
        <div className="item">{route.name}</div>
      </div>
      <div className="group">
        <div className="item">{runtimeLabel} runtime</div>
        <div className="item">v{version}</div>
        <div className="item">theme: {settings.theme}</div>
      </div>
    </div>
  );
}
