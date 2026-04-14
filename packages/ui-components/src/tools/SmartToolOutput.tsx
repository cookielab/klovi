import { CodeBox } from "@cookielab.io/klovi-design-system";
import { useCallback, useState } from "react";
import type { ToolResultImage } from "../types/index.ts";
import { detectOutputFormat } from "../utilities/format-detector.ts";
import { ImageLightbox } from "../utilities/ImageLightbox.tsx";
import { MAX_OUTPUT_LENGTH, truncateOutput } from "./ToolCallDefaults.ts";

const SECTION_LABEL_CLASSES = "mb-1 text-[0.7rem] font-semibold text-foreground-subtle uppercase";
const OUTPUT_BASE_CLASSES =
	"font-mono text-[0.78rem] leading-[1.5] whitespace-pre-wrap break-words text-foreground-muted";
const IMAGE_CLASSES =
	"max-h-[200px] object-contain border border-border-muted transition-colors duration-150 group-hover:border-accent";

type SmartToolOutputProps = {
	output: string;
	isError: boolean;
	resultImages?: ToolResultImage[] | undefined;
};

function ToolResultImageButton({
	img,
	index,
	onSelect,
}: {
	img: ToolResultImage;
	index: number;
	onSelect: (src: string) => void;
}) {
	const src = `data:${img.mediaType};base64,${img.data}`;
	const handleClick = useCallback(() => onSelect(src), [onSelect, src]);

	return (
		<button type="button" className="group inline-block cursor-pointer [all:unset]" onClick={handleClick}>
			<img className={IMAGE_CLASSES} src={src} alt={`Tool result ${index + 1}`} width={200} height={200} />
		</button>
	);
}

export function SmartToolOutput({ output, isError, resultImages }: SmartToolOutputProps) {
	const truncated = truncateOutput(output);
	const wasTruncated = output.length > MAX_OUTPUT_LENGTH;
	const detectedLang = truncated ? detectOutputFormat(truncated) : null;
	const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

	const closeLightbox = useCallback(() => setLightboxSrc(null), []);

	if (!output && (!resultImages || resultImages.length === 0)) {
		return null;
	}

	return (
		<div>
			<div className={SECTION_LABEL_CLASSES}>Output</div>
			{output && detectedLang && !isError ? <CodeBox language={detectedLang}>{truncated}</CodeBox> : null}
			{output && !(detectedLang && !isError) ? (
				<div className={`${OUTPUT_BASE_CLASSES}${isError ? "text-error" : ""}`}>{truncated}</div>
			) : null}
			{wasTruncated && <div className="py-1 text-[0.75rem] text-foreground-subtle italic">... (truncated)</div>}
			{resultImages && resultImages.length > 0 && (
				<div className="mt-2 flex flex-wrap gap-2">
					{resultImages.map((img, i) => (
						<ToolResultImageButton
							// biome-ignore lint/suspicious/noArrayIndexKey: images have no stable unique identifier
							key={i}
							img={img}
							index={i}
							onSelect={setLightboxSrc}
						/>
					))}
				</div>
			)}
			{lightboxSrc ? <ImageLightbox src={lightboxSrc} onClose={closeLightbox} /> : null}
		</div>
	);
}
