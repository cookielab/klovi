import type React from "react";
import { Sidebar } from "./Sidebar.tsx";

interface LayoutProps {
  sidebar: React.ReactNode;
  hideSidebar?: boolean;
  onSearchClick?: () => void;
  onSettingsClick?: () => void;
  children: React.ReactNode;
}

export function Layout({
  sidebar,
  hideSidebar,
  onSearchClick,
  onSettingsClick,
  children,
}: LayoutProps) {
  return (
    <div className={`app-layout ${hideSidebar ? "sidebar-hidden" : ""}`}>
      <Sidebar onSearchClick={onSearchClick} onSettingsClick={onSettingsClick}>
        {sidebar}
      </Sidebar>
      <div className="main-content">{children}</div>
    </div>
  );
}
