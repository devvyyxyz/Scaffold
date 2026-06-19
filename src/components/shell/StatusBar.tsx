import { useAppStore } from "../../lib/store";
import { isTauri } from "../../lib/ipc";
import "./StatusBar.css";

export function StatusBar() {
  const route = useAppStore((s) => s.route);
  const settings = useAppStore((s) => s.settings);

  const runtimeLabel = isTauri() ? "Native" : "Browser (dev)";

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
        <div className="item">v0.1.0</div>
        <div className="item">theme: {settings.theme}</div>
      </div>
    </div>
  );
}
