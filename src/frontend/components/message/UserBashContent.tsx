import type { UserTurn } from "../../../shared/types.ts";
import { CodeBlock } from "../ui/CodeBlock.tsx";
import { SmartToolOutput } from "./SmartToolOutput.tsx";

interface UserBashContentProps {
  turn: UserTurn;
}

export function UserBashContent({ turn }: UserBashContentProps) {
  const output = [turn.bashStdout, turn.bashStderr].filter(Boolean).join("\n");
  const isError = !turn.bashStdout && !!turn.bashStderr;

  return (
    <>
      {turn.bashInput !== undefined && (
        <div style={{ marginBottom: output ? 8 : 0 }}>
          <div className="tool-section-label">Command</div>
          <CodeBlock language="bash">{turn.bashInput}</CodeBlock>
        </div>
      )}
      {output && <SmartToolOutput output={output} isError={isError} />}
    </>
  );
}
