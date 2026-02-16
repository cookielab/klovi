import type { ToolCallWithResult } from "../../../shared/types.ts";
import { detectOutputFormat } from "../../utils/format-detector.ts";
import { CodeBlock } from "../ui/CodeBlock.tsx";
import { MAX_OUTPUT_LENGTH, truncateOutput } from "./ToolCall.tsx";

interface BashToolContentProps {
  call: ToolCallWithResult;
}

export function BashToolContent({ call }: BashToolContentProps) {
  const command = String(call.input.command || "");
  const output = call.result || "";
  const truncated = truncateOutput(output);
  const wasTruncated = output.length > MAX_OUTPUT_LENGTH;
  const detectedLang = truncated ? detectOutputFormat(truncated) : null;

  return (
    <>
      <div style={{ marginBottom: 8 }}>
        <div className="tool-section-label">Command</div>
        <CodeBlock language="bash">{command}</CodeBlock>
      </div>
      {(output || (call.resultImages && call.resultImages.length > 0)) && (
        <div>
          <div className="tool-section-label">Output</div>
          {output &&
            (detectedLang && !call.isError ? (
              <CodeBlock language={detectedLang}>{truncated}</CodeBlock>
            ) : (
              <div className={`tool-call-output ${call.isError ? "tool-call-error" : ""}`}>
                {truncated}
              </div>
            ))}
          {wasTruncated && <div className="tool-call-truncated">... (truncated)</div>}
          {call.resultImages && call.resultImages.length > 0 && (
            <div className="tool-result-images">
              {call.resultImages.map((img, i) => (
                <a
                  key={i}
                  href={`data:${img.mediaType};base64,${img.data}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img
                    className="tool-result-image"
                    src={`data:${img.mediaType};base64,${img.data}`}
                    alt={`Tool result ${i + 1}`}
                  />
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
