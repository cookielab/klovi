import type { ToolResultImage } from "../../../shared/types.ts";
import { detectOutputFormat } from "../../utils/format-detector.ts";
import { CodeBlock } from "../ui/CodeBlock.tsx";
import { MAX_OUTPUT_LENGTH, truncateOutput } from "./ToolCall.tsx";

interface SmartToolOutputProps {
  output: string;
  isError: boolean;
  resultImages?: ToolResultImage[];
}

export function SmartToolOutput({ output, isError, resultImages }: SmartToolOutputProps) {
  const truncated = truncateOutput(output);
  const wasTruncated = output.length > MAX_OUTPUT_LENGTH;
  const detectedLang = truncated ? detectOutputFormat(truncated) : null;

  if (!output && (!resultImages || resultImages.length === 0)) return null;

  return (
    <div>
      <div className="tool-section-label">Output</div>
      {output &&
        (detectedLang && !isError ? (
          <CodeBlock language={detectedLang}>{truncated}</CodeBlock>
        ) : (
          <div className={`tool-call-output ${isError ? "tool-call-error" : ""}`}>{truncated}</div>
        ))}
      {wasTruncated && <div className="tool-call-truncated">... (truncated)</div>}
      {resultImages && resultImages.length > 0 && (
        <div className="tool-result-images">
          {resultImages.map((img, i) => (
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
  );
}
