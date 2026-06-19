import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { StatusBar } from "./StatusBar";
import "./AppShell.css";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <aside className="sidebarArea">
        <Sidebar />
      </aside>
      <header className="topbarArea">
        <TopBar />
      </header>
      <main className="contentArea scroll-y">{children}</main>
      <footer className="statusArea">
        <StatusBar />
      </footer>
    </div>
  );
}
