import type React from "react";
import faviconUrl from "../../../../favicon.svg";
import { useRPC } from "../../hooks/useRpc.ts";
import { getRPC } from "../../rpc.ts";

interface VersionInfo {
  version: string;
  commit: string;
}

interface SidebarProps {
  children: React.ReactNode;
  onSearchClick?: () => void;
}

export function Sidebar({ children, onSearchClick }: SidebarProps) {
  const { data: versionInfo } = useRPC<VersionInfo>(() => getRPC().request.getVersion({}), []);

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <img src={faviconUrl} alt="" width="28" height="28" />
        <h1>Klovi</h1>
        {versionInfo && (
          <span className="sidebar-version">
            {versionInfo.version}
            {versionInfo.commit ? ` (${versionInfo.commit})` : ""}
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
          onClick={(e) => {
            e.preventDefault();
            void getRPC().request.openExternal({
              url: "https://cookielab.io?utm_source=opensource&utm_medium=klovi",
            });
          }}
        >
          cookielab.io
        </a>
      </div>
    </div>
  );
}
