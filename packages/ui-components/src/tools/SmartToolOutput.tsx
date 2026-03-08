import { CodeBox } from "@cookielab.io/klovi-design-system";
import { useCallback, useState } from "react";
import type { ToolResultImage } from "../types/index.ts";
import { detectOutputFormat } from "../utilities/format-detector.ts";
import { ImageLightbox } from "../utilities/ImageLightbox.tsx";
import styles from "./SmartToolOutput.module.css";
import { MAX_OUTPUT_LENGTH, truncateOutput } from "./ToolCallDefaults.ts";

function s(name: string | undefined): string {
  return name ?? "";
}

interface SmartToolOutputProps {
  output: string;
  isError: boolean;
  resultImages?: ToolResultImage[] | undefined;
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
      <div className={s(styles["toolSectionLabel"])}>Output</div>
      {output &&
        (detectedLang && !isError ? (
          <CodeBox language={detectedLang}>{truncated}</CodeBox>
        ) : (
          <div
            className={`${s(styles["toolCallOutput"])} ${isError ? s(styles["toolCallError"]) : ""}`}
          >
            {truncated}
          </div>
        ))}
      {wasTruncated && <div className={s(styles["toolCallTruncated"])}>... (truncated)</div>}
      {resultImages && resultImages.length > 0 && (
        <div className={s(styles["toolResultImages"])}>
          {resultImages.map((img, i) => (
            <button
              // biome-ignore lint/suspicious/noArrayIndexKey: images have no stable unique identifier
              key={i}
              type="button"
              className={s(styles["toolResultImageBtn"])}
              onClick={() => setLightboxSrc(`data:${img.mediaType};base64,${img.data}`)}
            >
              <img
                className={s(styles["toolResultImage"])}
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
