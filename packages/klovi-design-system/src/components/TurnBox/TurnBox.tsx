import type React from "react";
import type { TurnRole } from "../../types.ts";
import styles from "./TurnBox.module.css";

interface TurnBoxProps {
  role: TurnRole;
  badge?: string;
  model?: string;
  timestamp?: React.ReactNode;
  children: React.ReactNode;
}

function s(name: string | undefined): string {
  return name ?? "";
}

const BADGE_STYLES: Record<TurnRole, string> = {
  user: s(styles["turnBadgeUser"]),
  assistant: s(styles["turnBadgeAssistant"]),
  agent: s(styles["turnBadgeAgent"]),
  "sub-agent": s(styles["turnBadgeSubAgent"]),
  system: s(styles["turnBadgeSystem"]),
  error: s(styles["turnBadgeError"]),
};

const MESSAGE_STYLES: Record<TurnRole, string> = {
  user: s(styles["messageUser"]),
  assistant: s(styles["messageAssistant"]),
  agent: s(styles["messageAgent"]),
  "sub-agent": s(styles["messageSubAgent"]),
  system: s(styles["messageSystem"]),
  error: s(styles["messageError"]),
};

const DEFAULT_LABELS: Record<TurnRole, string> = {
  user: "User",
  assistant: "Assistant",
  agent: "Root Agent",
  "sub-agent": "Sub-Agent",
  system: "System",
  error: "Error",
};

export function TurnBox({ role, badge, model, timestamp, children }: TurnBoxProps) {
  const label = badge ?? DEFAULT_LABELS[role];

  return (
    <div className={s(styles["turn"])}>
      <div className={s(styles["turnHeader"])}>
        <span className={`${s(styles["turnBadge"])} ${BADGE_STYLES[role]}`}>{label}</span>
        {model && (
          <span className={`${s(styles["turnBadge"])} ${s(styles["turnBadgeModel"])}`}>
            {model}
          </span>
        )}
        {timestamp && <span className={s(styles["turnTimestamp"])}>{timestamp}</span>}
      </div>
      <div className={`${s(styles["message"])} ${MESSAGE_STYLES[role]}`}>{children}</div>
    </div>
  );
}
