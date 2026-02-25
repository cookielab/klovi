import type { ToolCallWithResult } from "../../../shared/types.ts";
import { CodeBlock } from "../ui/CodeBlock.tsx";
import { SmartToolOutput } from "./SmartToolOutput.tsx";

interface BashToolContentProps {
  call: ToolCallWithResult;
}

export function BashToolContent({ call }: BashToolContentProps) {
  const command = String(call.input["command"] || "");

  return (
    <>
      <div style={{ marginBottom: 8 }}>
        <div className="tool-section-label">Command</div>
        <CodeBlock language="bash">{command}</CodeBlock>
      </div>
      <SmartToolOutput
        output={call.result}
        isError={call.isError}
        resultImages={call.resultImages}
      />
    </>
  );
}
