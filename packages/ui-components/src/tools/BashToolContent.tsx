import { CodeBox } from "@cookielab.io/klovi-design-system";
import type { ToolCallWithResult } from "../types/index.ts";
import styles from "./SmartToolOutput.module.css";
import { SmartToolOutput } from "./SmartToolOutput.tsx";

function s(name: string | undefined): string {
  return name ?? "";
}

interface BashToolContentProps {
  call: ToolCallWithResult;
}

export function BashToolContent({ call }: BashToolContentProps) {
  const command = String(call.input["command"] || "");

  return (
    <>
      <div style={{ marginBottom: 8 }}>
        <div className={s(styles["toolSectionLabel"])}>Command</div>
        <CodeBox language="bash">{command}</CodeBox>
      </div>
      <SmartToolOutput
        output={call.result}
        isError={call.isError}
        resultImages={call.resultImages}
      />
    </>
  );
}
