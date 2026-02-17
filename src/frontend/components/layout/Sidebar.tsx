import type React from "react";
import faviconUrl from "../../../../favicon.svg";
import { useFetch } from "../../hooks/useFetch.ts";

interface VersionInfo {
  version: string;
  commitHash: string | null;
}

interface SidebarProps {
  children: React.ReactNode;
  onSearchClick?: () => void;
}

export function Sidebar({ children, onSearchClick }: SidebarProps) {
  const { data: versionInfo } = useFetch<VersionInfo>("/api/version", []);

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
        {onSearchClick && (
          <button
            type="button"
            className="btn-sidebar-search"
            onClick={onSearchClick}
            title="Search sessions (Cmd+K)"
          >
            Search
          </button>
        )}
      </div>
      <div className="sidebar-content">{children}</div>
      <div className="sidebar-footer">
        Made by{" "}
        <a
          href="https://cookielab.io?utm_source=opensource&utm_medium=klovi"
          target="_blank"
          rel="noopener noreferrer"
        >
          cookielab.io
        </a>
      </div>
    </div>
  );
}
