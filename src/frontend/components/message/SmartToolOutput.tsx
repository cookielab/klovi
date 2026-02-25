import { useCallback, useState } from "react";
import type { ToolResultImage } from "../../../shared/types.ts";
import { detectOutputFormat } from "../../utils/format-detector.ts";
import { CodeBlock } from "../ui/CodeBlock.tsx";
import { ImageLightbox } from "../ui/ImageLightbox.tsx";
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
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const closeLightbox = useCallback(() => setLightboxSrc(null), []);

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
            <button
              // biome-ignore lint/suspicious/noArrayIndexKey: images have no stable unique identifier
              key={i}
              type="button"
              className="tool-result-image-btn"
              onClick={() => setLightboxSrc(`data:${img.mediaType};base64,${img.data}`)}
            >
              <img
                className="tool-result-image"
                src={`data:${img.mediaType};base64,${img.data}`}
                alt={`Tool result ${i + 1}`}
              />
            </button>
          ))}
        </div>
      )}
      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={closeLightbox} />}
    </div>
  );
}
