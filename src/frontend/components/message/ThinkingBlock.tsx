import type { ThinkingBlock as ThinkingBlockType } from "../../../shared/types.ts";
import { CollapsibleSection } from "../ui/CollapsibleSection.tsx";
import { MarkdownRenderer } from "../ui/MarkdownRenderer.tsx";
import { MAX_THINKING_PREVIEW } from "./ToolCall.tsx";

interface ThinkingBlockProps {
  block: ThinkingBlockType;
}

export function ThinkingBlock({ block }: ThinkingBlockProps) {
  const preview =
    block.text.length > MAX_THINKING_PREVIEW
      ? `${block.text.slice(0, MAX_THINKING_PREVIEW)}...`
      : block.text;

  return (
    <div className="thinking-block">
      <CollapsibleSection
        title={
          <span>
            <span style={{ color: "var(--text-muted)" }}>Thinking:</span>{" "}
            <span className="tool-call-summary">{preview}</span>
          </span>
        }
      >
        <div className="thinking-content">
          <MarkdownRenderer content={block.text} />
        </div>
      </CollapsibleSection>
    </div>
  );
}
