import { CodeBox } from "@cookielab.io/klovi-design-system";
import { SmartToolOutput } from "../tools/index.ts";
import type { UserTurn } from "../types/index.ts";

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
          <div
            style={{
              fontSize: "0.7rem",
              fontWeight: 600,
              textTransform: "uppercase",
              color: "var(--text-muted)",
              marginBottom: 4,
            }}
          >
            Command
          </div>
          <CodeBox language="bash">{turn.bashInput}</CodeBox>
        </div>
      )}
      {output && <SmartToolOutput output={output} isError={isError} />}
    </>
  );
}
