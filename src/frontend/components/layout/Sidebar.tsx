import type React from "react";
import faviconUrl from "../../../../favicon.svg";

interface SidebarProps {
  children: React.ReactNode;
}

export function Sidebar({ children }: SidebarProps) {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <img src={faviconUrl} alt="" width="28" height="28" />
        <h1>Klovi</h1>
      </div>
      <div className="sidebar-content">{children}</div>
    </div>
  );
}
