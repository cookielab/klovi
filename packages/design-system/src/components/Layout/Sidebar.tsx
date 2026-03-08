import type React from "react";
import styles from "./Layout.module.css";

interface SidebarProps {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

function s(name: string | undefined): string {
  return name ?? "";
}

export function Sidebar({ header, footer, children }: SidebarProps) {
  return (
    <div className={s(styles["sidebar"])}>
      {header && <div className={s(styles["sidebarHeader"])}>{header}</div>}
      <div className={s(styles["sidebarContent"])}>{children}</div>
      {footer && <div className={s(styles["sidebarFooter"])}>{footer}</div>}
    </div>
  );
}
