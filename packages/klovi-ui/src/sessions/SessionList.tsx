import { BUILTIN_KLOVI_PLUGIN_DISPLAY_NAMES } from "@cookielab.io/klovi-plugin-core";
import type { SessionSummary } from "../types/index.ts";
import { FetchError } from "../utilities/FetchError.tsx";
import { formatFullDateTime, formatTime } from "../utilities/formatters.ts";
import styles from "./SessionList.module.css";

function s(name: string | undefined): string {
  return name ?? "";
}

function defaultPluginDisplayName(pluginId: string): string {
  return (
    BUILTIN_KLOVI_PLUGIN_DISPLAY_NAMES[
      pluginId as keyof typeof BUILTIN_KLOVI_PLUGIN_DISPLAY_NAMES
    ] ?? pluginId
  );
}

export interface SessionListProps {
  sessions: SessionSummary[];
  loading?: boolean | undefined;
  error?: string | undefined;
  onRetry?: (() => void) | undefined;
  selectedId?: string | undefined;
  projectName: string;
  onSelect: (sessionId: string) => void;
  onBack: () => void;
  pluginDisplayName?: ((id: string) => string) | undefined;
}

export function SessionList({
  sessions,
  loading,
  error,
  onRetry,
  selectedId,
  projectName,
  onSelect,
  onBack,
  pluginDisplayName = defaultPluginDisplayName,
}: SessionListProps) {
  const parts = projectName.split("/").filter(Boolean);
  const displayName = parts.slice(-2).join("/");

  return (
    <div>
      <button type="button" className={s(styles["backBtn"])} onClick={onBack}>
        ← Projects
      </button>
      <div className={s(styles["sectionTitle"])}>{displayName}</div>
      {loading && <div className={s(styles["loading"])}>Loading sessions...</div>}
      {error && <FetchError error={error} {...(onRetry ? { onRetry } : {})} />}
      {!loading &&
        !error &&
        sessions.map((session) => {
          const itemClasses = [
            s(styles["listItemButton"]),
            s(styles["listItem"]),
            selectedId === session.sessionId ? s(styles["listItemActive"]) : "",
            session.sessionType === "plan" ? s(styles["listItemPlan"]) : "",
            session.sessionType === "implementation" ? s(styles["listItemImplementation"]) : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              type="button"
              key={session.sessionId}
              className={itemClasses}
              onClick={() => onSelect(session.sessionId)}
            >
              <div className={s(styles["listItemTitle"])}>
                {session.firstMessage || session.slug}
              </div>
              <div className={s(styles["listItemMeta"])}>
                {session.pluginId && (
                  <span className={s(styles["pluginBadge"])}>
                    {pluginDisplayName(session.pluginId)}
                  </span>
                )}{" "}
                {session.sessionType && (
                  <span
                    className={`${s(styles["sessionTypeBadge"])} ${
                      session.sessionType === "plan"
                        ? s(styles["sessionTypeBadgePlan"])
                        : s(styles["sessionTypeBadgeImplementation"])
                    }`}
                  >
                    {session.sessionType === "plan" ? "Plan" : "Impl"}
                  </span>
                )}{" "}
                <time dateTime={session.timestamp} title={formatFullDateTime(session.timestamp)}>
                  {formatTime(session.timestamp)}
                </time>
              </div>
            </button>
          );
        })}
      {!loading && !error && sessions.length === 0 && (
        <div className={s(styles["emptyMessage"])}>No sessions found</div>
      )}
    </div>
  );
}
