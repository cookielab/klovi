import { TurnBox } from "@cookielab.io/klovi-design-system";
import type React from "react";
import type { UserTurn } from "../types/index.ts";
import { formatFullDateTime, formatTimestamp } from "../utilities/index.ts";
import { MarkdownRenderer } from "./MarkdownRenderer.tsx";
import { UserBashContent } from "./UserBashContent.tsx";
import styles from "./UserMessage.module.css";

function s(name: string | undefined): string {
  return name ?? "";
}

const IMAGE_MEDIA_TYPE_PREFIX_REGEX = /^image\//;
const STATUS_RE = /^\[.+\]$/;
const PLAN_PREFIX = "Implement the following plan";

interface UserMessageProps {
  turn: UserTurn;
  isSubAgent?: boolean | undefined;
  planSessionId?: string | undefined;
  implSessionId?: string | undefined;
  project?: string | undefined;
  onSessionLink?: ((sessionId: string) => void) | undefined;
  onLinkClick?: ((url: string) => void) | undefined;
}

function TimestampLabel({ timestamp }: { timestamp: string }) {
  return (
    <time dateTime={timestamp} data-tooltip={formatFullDateTime(timestamp)}>
      {formatTimestamp(timestamp)}
    </time>
  );
}

function SessionLink({
  sessionId,
  project,
  label,
  onSessionLink,
}: {
  sessionId: string;
  project: string;
  label: string;
  onSessionLink?: ((id: string) => void) | undefined;
}) {
  return (
    <a
      className={s(styles["sessionLink"])}
      href={`#/${project}/${sessionId}`}
      onClick={
        onSessionLink
          ? (e: React.MouseEvent) => {
              e.preventDefault();
              onSessionLink(sessionId);
            }
          : undefined
      }
    >
      {label}
    </a>
  );
}

export function UserMessage({
  turn,
  isSubAgent,
  planSessionId,
  implSessionId,
  project,
  onSessionLink,
  onLinkClick,
}: UserMessageProps) {
  if (turn.bashInput !== undefined || turn.bashStdout !== undefined) {
    return (
      // biome-ignore lint/a11y/useValidAriaRole: role is a component prop, not HTML role
      <TurnBox
        role="user"
        timestamp={turn.timestamp ? <TimestampLabel timestamp={turn.timestamp} /> : undefined}
      >
        <UserBashContent turn={turn} />
      </TurnBox>
    );
  }

  if (turn.ideOpenedFile !== undefined) {
    return (
      <div className={`${s(styles["statusNotice"])} ${s(styles["ideOpenedFileNotice"])}`}>
        Opened <code className={s(styles["ideOpenedFilePath"])}>{turn.ideOpenedFile}</code>
      </div>
    );
  }

  if (STATUS_RE.test(turn.text.trim())) {
    return <div className={s(styles["statusNotice"])}>{turn.text}</div>;
  }

  const isPlanMessage = turn.text.startsWith(PLAN_PREFIX);
  const showPlanLink = planSessionId && project && isPlanMessage;
  const showImplLink = implSessionId && project && !isPlanMessage;
  const role = isSubAgent ? "agent" : "user";

  return (
    <TurnBox
      role={role}
      timestamp={
        <>
          {showPlanLink && (
            <SessionLink
              sessionId={planSessionId}
              project={project}
              label="View planning session"
              onSessionLink={onSessionLink}
            />
          )}
          {showImplLink && (
            <SessionLink
              sessionId={implSessionId}
              project={project}
              label="View implementation session"
              onSessionLink={onSessionLink}
            />
          )}
          {turn.timestamp ? <TimestampLabel timestamp={turn.timestamp} /> : undefined}
        </>
      }
    >
      {turn.command && (
        <div className={s(styles["commandCall"])}>
          <span className={s(styles["skillBadge"])}>skill</span>
          <span className={s(styles["commandCallLabel"])}>{turn.command.name}</span>
        </div>
      )}
      <MarkdownRenderer content={turn.text} onLinkClick={onLinkClick} />
      {turn.attachments && turn.attachments.length > 0 && (
        <div className={s(styles["attachments"])}>
          {turn.attachments.map((a, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: attachments have no unique identifier
            <span key={i} className={s(styles["attachmentBadge"])}>
              image/{a.mediaType.replace(IMAGE_MEDIA_TYPE_PREFIX_REGEX, "")}
            </span>
          ))}
        </div>
      )}
    </TurnBox>
  );
}
