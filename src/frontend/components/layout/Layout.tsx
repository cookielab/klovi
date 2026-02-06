import type React from "react";
import { Sidebar } from "./Sidebar.tsx";

interface LayoutProps {
  sidebar: React.ReactNode;
  hideSidebar?: boolean;
  children: React.ReactNode;
}

export function Layout({ sidebar, hideSidebar, children }: LayoutProps) {
  return (
    <div className={`app-layout ${hideSidebar ? "sidebar-hidden" : ""}`}>
      <Sidebar>{sidebar}</Sidebar>
      <div className="main-content">{children}</div>
    </div>
  );
}
