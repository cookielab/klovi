import React from "react";
import type { ThinkingBlock as ThinkingBlockType } from "../../../shared/types.ts";
import { CollapsibleSection } from "../ui/CollapsibleSection.tsx";

interface ThinkingBlockProps {
  block: ThinkingBlockType;
}

export function ThinkingBlock({ block }: ThinkingBlockProps) {
  const preview =
    block.text.length > 100
      ? block.text.slice(0, 100) + "..."
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
        <div className="thinking-content">{block.text}</div>
      </CollapsibleSection>
    </div>
  );
}
