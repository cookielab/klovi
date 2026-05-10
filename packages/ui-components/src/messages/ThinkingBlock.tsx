import { Collapsible } from "@cookielab.io/klovi-design-system";
import { MAX_THINKING_PREVIEW } from "../tools/index";
import type { ThinkingBlock as ThinkingBlockType } from "../types/index";
import { MarkdownRenderer } from "./MarkdownRenderer";

type ThinkingBlockProps = {
	block: ThinkingBlockType;
	onLinkClick?: ((url: string) => void) | undefined;
};

const THINKING_CONTENT_CLASSES =
	"text-[0.85rem] leading-[1.6] text-foreground-muted italic whitespace-pre-wrap break-words";

const PREVIEW_CLASSES = "text-[0.78rem] text-foreground-subtle font-mono";

export function ThinkingBlock({ block, onLinkClick }: ThinkingBlockProps) {
	const preview =
		block.text.length > MAX_THINKING_PREVIEW ? `${block.text.slice(0, MAX_THINKING_PREVIEW)}...` : block.text;

	return (
		<div className="my-[2px]">
			<Collapsible
				title={
					<span>
						<span className="text-foreground-subtle">Thinking:</span> <span className={PREVIEW_CLASSES}>{preview}</span>
					</span>
				}
			>
				<div className={THINKING_CONTENT_CLASSES}>
					<MarkdownRenderer content={block.text} onLinkClick={onLinkClick} />
				</div>
			</Collapsible>
		</div>
	);
}
