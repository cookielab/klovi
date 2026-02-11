import type React from "react";
import { Sidebar } from "./Sidebar.tsx";

interface LayoutProps {
  sidebar: React.ReactNode;
  hideSidebar?: boolean;
  onSearchClick?: () => void;
  children: React.ReactNode;
}

export function Layout({ sidebar, hideSidebar, onSearchClick, children }: LayoutProps) {
  return (
    <div className={`app-layout ${hideSidebar ? "sidebar-hidden" : ""}`}>
      <Sidebar onSearchClick={onSearchClick}>{sidebar}</Sidebar>
      <div className="main-content">{children}</div>
    </div>
  );
}
