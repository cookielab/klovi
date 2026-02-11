import type React from "react";
import { useEffect, useState } from "react";
import faviconUrl from "../../../../favicon.svg";

interface VersionInfo {
  version: string;
  commitHash: string | null;
}

interface SidebarProps {
  children: React.ReactNode;
}

export function Sidebar({ children }: SidebarProps) {
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);

  useEffect(() => {
    fetch("/api/version")
      .then((res) => res.json())
      .then((data: VersionInfo) => setVersionInfo(data))
      .catch(() => {});
  }, []);

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <img src={faviconUrl} alt="" width="28" height="28" />
        <h1>Klovi</h1>
        {versionInfo && (
          <span className="sidebar-version">
            {versionInfo.version}
            {versionInfo.commitHash ? ` (${versionInfo.commitHash})` : ""}
          </span>
        )}
      </div>
      <div className="sidebar-content">{children}</div>
      <div className="sidebar-footer">
        Made by{" "}
        <a href="https://cookielab.io" target="_blank" rel="noopener noreferrer">
          cookielab.io
        </a>
      </div>
    </div>
  );
}
