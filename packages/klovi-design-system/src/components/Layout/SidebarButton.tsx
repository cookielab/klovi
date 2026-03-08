import type React from "react";
import styles from "./Layout.module.css";

interface SidebarButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

function s(name: string | undefined): string {
  return name ?? "";
}

export function SidebarButton({ className, ...props }: SidebarButtonProps) {
  const classes = [s(styles["sidebarButton"]), className ?? ""].filter(Boolean).join(" ");

  return <button type="button" {...props} className={classes} />;
}
