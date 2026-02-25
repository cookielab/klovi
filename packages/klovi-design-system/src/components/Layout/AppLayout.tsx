import type React from "react";
import styles from "./Layout.module.css";

interface AppLayoutProps {
  sidebar: React.ReactNode;
  hideSidebar?: boolean;
  children: React.ReactNode;
}

function s(name: string | undefined): string {
  return name ?? "";
}

export function AppLayout({ sidebar, hideSidebar, children }: AppLayoutProps) {
  return (
    <div className={`${s(styles["appLayout"])} ${hideSidebar ? s(styles["sidebarHidden"]) : ""}`}>
      {sidebar}
      <div className={s(styles["mainContent"])}>{children}</div>
    </div>
  );
}
