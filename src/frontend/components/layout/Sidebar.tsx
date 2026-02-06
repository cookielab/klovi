import type React from "react";

interface SidebarProps {
  children: React.ReactNode;
}

export function Sidebar({ children }: SidebarProps) {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h1>Klovi</h1>
      </div>
      <div className="sidebar-content">{children}</div>
    </div>
  );
}
