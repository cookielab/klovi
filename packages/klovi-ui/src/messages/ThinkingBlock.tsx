import { Collapsible } from "@cookielab.io/klovi-design-system";
import { MAX_THINKING_PREVIEW } from "../tools/index.ts";
import type { ThinkingBlock as ThinkingBlockType } from "../types/index.ts";
import { MarkdownRenderer } from "./MarkdownRenderer.tsx";
import styles from "./ThinkingBlock.module.css";

function s(name: string | undefined): string {
  return name ?? "";
}

interface ThinkingBlockProps {
  block: ThinkingBlockType;
  onLinkClick?: ((url: string) => void) | undefined;
}

export function ThinkingBlock({ block, onLinkClick }: ThinkingBlockProps) {
  const preview =
    block.text.length > MAX_THINKING_PREVIEW
      ? `${block.text.slice(0, MAX_THINKING_PREVIEW)}...`
      : block.text;

  return (
    <div className={s(styles["thinkingBlock"])}>
      <Collapsible
        title={
          <span>
            <span style={{ color: "var(--text-muted)" }}>Thinking:</span>{" "}
            <span
              style={{
                fontSize: "0.78rem",
                color: "var(--text-muted)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {preview}
            </span>
          </span>
        }
      >
        <div className={s(styles["thinkingContent"])}>
          <MarkdownRenderer content={block.text} onLinkClick={onLinkClick} />
        </div>
      </Collapsible>
    </div>
  );
}
