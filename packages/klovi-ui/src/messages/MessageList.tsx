import { TurnBox } from "@cookielab.io/klovi-design-system";
import type { FrontendPlugin } from "@cookielab.io/klovi-plugin-core";
import type { Turn } from "../types/index.ts";
import { ErrorBoundary, formatFullDateTime, formatTimestamp } from "../utilities/index.ts";
import { AssistantMessage } from "./AssistantMessage.tsx";
import { MarkdownRenderer } from "./MarkdownRenderer.tsx";
import styles from "./MessageList.module.css";
import { UserMessage } from "./UserMessage.tsx";

function s(name: string | undefined): string {
  return name ?? "";
}

interface MessageListProps {
  turns: Turn[];
  visibleSubSteps?: Map<number, number> | undefined;
  sessionId?: string | undefined;
  project?: string | undefined;
  pluginId?: string | undefined;
  isSubAgent?: boolean | undefined;
  planSessionId?: string | undefined;
  implSessionId?: string | undefined;
  onSessionLink?: ((sessionId: string) => void) | undefined;
  onLinkClick?: ((url: string) => void) | undefined;
  getFrontendPlugin?: ((id: string) => FrontendPlugin | undefined) | undefined;
}

function renderTurn(
  turn: Turn,
  index: number,
  isActive: boolean,
  visibleSubSteps: Map<number, number> | undefined,
  sessionId: string | undefined,
  project: string | undefined,
  pluginId: string | undefined,
  isSubAgent: boolean | undefined,
  planSessionId: string | undefined,
  implSessionId: string | undefined,
  onSessionLink: ((sessionId: string) => void) | undefined,
  onLinkClick: ((url: string) => void) | undefined,
  getFrontendPlugin: ((id: string) => FrontendPlugin | undefined) | undefined,
) {
  const activeClass = isActive ? s(styles["activeMessage"]) : "";

  switch (turn.kind) {
    case "user":
      return (
        <div className={isActive ? `${s(styles["activeMessage"])} ${s(styles["stepEnter"])}` : ""}>
          <UserMessage
            turn={turn}
            isSubAgent={isSubAgent}
            planSessionId={planSessionId}
            implSessionId={implSessionId}
            project={project}
            onSessionLink={onSessionLink}
            onLinkClick={onLinkClick}
          />
        </div>
      );
    case "assistant":
      return (
        <div className={activeClass}>
          <AssistantMessage
            turn={turn}
            visibleSubSteps={visibleSubSteps?.get(index)}
            sessionId={sessionId}
            project={project}
            pluginId={pluginId}
            onLinkClick={onLinkClick}
            getFrontendPlugin={getFrontendPlugin}
          />
        </div>
      );
    case "system":
      return (
        <div className={activeClass}>
          {/* biome-ignore lint/a11y/useValidAriaRole: role is a component prop, not HTML role */}
          <TurnBox
            role="system"
            timestamp={
              turn.timestamp ? (
                <time dateTime={turn.timestamp} data-tooltip={formatFullDateTime(turn.timestamp)}>
                  {formatTimestamp(turn.timestamp)}
                </time>
              ) : undefined
            }
          >
            <MarkdownRenderer content={turn.text} onLinkClick={onLinkClick} />
          </TurnBox>
        </div>
      );
    case "parse_error":
      return (
        <div className={activeClass}>
          {/* biome-ignore lint/a11y/useValidAriaRole: role is a component prop, not HTML role */}
          <TurnBox
            role="error"
            badge="Parse Error"
            timestamp={
              turn.lineNumber > 0 ? (
                <span className={s(styles["parseErrorLine"])}>line {turn.lineNumber}</span>
              ) : undefined
            }
          >
            <div className={s(styles["parseErrorType"])}>
              {turn.errorType === "json_parse" ? "Invalid JSON" : "Invalid Structure"}
            </div>
            {turn.errorDetails && (
              <div className={s(styles["parseErrorDetails"])}>{turn.errorDetails}</div>
            )}
            <details className={s(styles["parseErrorRaw"])}>
              <summary>Raw content</summary>
              <pre>{turn.rawLine}</pre>
            </details>
          </TurnBox>
        </div>
      );
    default:
      return null;
  }
}

const STATUS_RE = /^\[.+\]$/;

export function MessageList({
  turns,
  visibleSubSteps,
  sessionId,
  project,
  pluginId,
  isSubAgent,
  planSessionId,
  implSessionId,
  onSessionLink,
  onLinkClick,
  getFrontendPlugin,
}: MessageListProps) {
  const firstUserTurnIndex = turns.findIndex((t) => {
    if (t.kind !== "user") return false;
    return !STATUS_RE.test(t.text.trim());
  });

  return (
    <div className={s(styles["messageList"])}>
      {turns.map((turn, index) => {
        const isActive = visibleSubSteps ? index === turns.length - 1 : false;
        return (
          <ErrorBoundary key={turn.uuid || index} inline>
            {renderTurn(
              turn,
              index,
              isActive,
              visibleSubSteps,
              sessionId,
              project,
              pluginId,
              isSubAgent,
              planSessionId,
              index === firstUserTurnIndex ? implSessionId : undefined,
              onSessionLink,
              onLinkClick,
              getFrontendPlugin,
            )}
          </ErrorBoundary>
        );
      })}
    </div>
  );
}
