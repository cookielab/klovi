import type { FrontendPlugin } from "@cookielab.io/klovi-plugin-core";
import type { Turn } from "../types/index.ts";
import { FetchError } from "../utilities/index.ts";
import { MessageList } from "./MessageList.tsx";
import styles from "./SubAgentView.module.css";

function s(name: string | undefined): string {
  return name ?? "";
}

interface SubAgentViewProps {
  turns: Turn[];
  sessionId?: string | undefined;
  project?: string | undefined;
  pluginId?: string | undefined;
  loading?: boolean | undefined;
  error?: string | undefined;
  onRetry?: (() => void) | undefined;
  onLinkClick?: ((url: string) => void) | undefined;
  getFrontendPlugin?: ((id: string) => FrontendPlugin | undefined) | undefined;
}

export function SubAgentView({
  turns,
  sessionId,
  project,
  pluginId,
  loading,
  error,
  onRetry,
  onLinkClick,
  getFrontendPlugin,
}: SubAgentViewProps) {
  if (loading) return <div className={s(styles["loading"])}>Loading sub-agent conversation...</div>;
  if (error) return <FetchError error={error} {...(onRetry ? { onRetry } : {})} showPrefix />;
  if (turns.length === 0)
    return <div className={s(styles["empty"])}>No sub-agent conversation data available.</div>;

  return (
    <MessageList
      turns={turns}
      sessionId={sessionId}
      project={project}
      pluginId={pluginId}
      isSubAgent
      onLinkClick={onLinkClick}
      getFrontendPlugin={getFrontendPlugin}
    />
  );
}
