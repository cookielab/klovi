import type React from "react";
import type { BadgeVariant } from "../../types.ts";
import styles from "./Badge.module.css";

interface BadgeProps {
  variant?: BadgeVariant;
  mono?: boolean;
  children: React.ReactNode;
}

function s(name: string | undefined): string {
  return name ?? "";
}

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  user: s(styles["user"]),
  assistant: s(styles["assistant"]),
  agent: s(styles["agent"]),
  "sub-agent": s(styles["subAgent"]),
  tool: s(styles["tool"]),
  system: s(styles["system"]),
  error: s(styles["error"]),
  plan: s(styles["plan"]),
  implementation: s(styles["implementation"]),
  default: s(styles["default"]),
};

export function Badge({ variant = "default", mono, children }: BadgeProps) {
  const classes = [s(styles["badge"]), VARIANT_STYLES[variant], mono ? s(styles["mono"]) : ""]
    .filter(Boolean)
    .join(" ");

  return <span className={classes}>{children}</span>;
}
