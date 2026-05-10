import { CodeBox, Text } from "@cookielab.io/klovi-design-system";
import React from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";


const T_TEXT = "@";

const FILE_REF_RE = /@(?<path>[\w./-]+\.\w+)/gu;
const LANGUAGE_CLASS_REGEX = /language-(?<lang>\w+)/u;
const TRAILING_NEWLINE_REGEX = /\n$/u;

const FILE_REF_CLASSES = "bg-transparent p-0 border-none font-medium text-accent";

const MARKDOWN_CONTENT_CLASSES = [
	"text-[0.95rem] leading-[1.7] text-foreground",
	"[&_p]:mb-[0.75em] [&_p:last-child]:mb-0",
	"[&_h1]:mt-[1em] [&_h1]:mb-[0.5em] [&_h1]:font-semibold [&_h1]:text-[1.4em]",
	"[&_h2]:mt-[1em] [&_h2]:mb-[0.5em] [&_h2]:font-semibold [&_h2]:text-[1.2em]",
	"[&_h3]:mt-[1em] [&_h3]:mb-[0.5em] [&_h3]:font-semibold [&_h3]:text-[1.1em]",
	"[&_h4]:mt-[1em] [&_h4]:mb-[0.5em] [&_h4]:font-semibold",
	"[&_ul]:mb-[0.75em] [&_ul]:pl-[1.5em] [&_ol]:mb-[0.75em] [&_ol]:pl-[1.5em]",
	"[&_li]:mb-[0.25em]",
	"[&_code:not(pre_code)]:bg-surface-sunken [&_code:not(pre_code)]:px-[6px] [&_code:not(pre_code)]:py-[2px] [&_code:not(pre_code)]:text-[0.88em]",
	"[&_pre]:my-[0.75em] [&_pre]:overflow-hidden",
	"[&_blockquote]:border-l-[3px] [&_blockquote]:border-border [&_blockquote]:pl-[1em] [&_blockquote]:my-[0.75em] [&_blockquote]:text-foreground-muted",
	"[&_table]:border-collapse [&_table]:my-[0.75em] [&_table]:w-full",
	"[&_th]:border [&_th]:border-border [&_th]:px-[10px] [&_th]:py-[6px] [&_th]:text-left [&_th]:bg-surface-muted [&_th]:font-semibold",
	"[&_td]:border [&_td]:border-border [&_td]:px-[10px] [&_td]:py-[6px] [&_td]:text-left",
].join(" ");

function renderTextWithFileRefs(text: string): React.ReactNode {
	const parts: React.ReactNode[] = [];
	let last = 0;
	FILE_REF_RE.lastIndex = 0;
	let match = FILE_REF_RE.exec(text);
	while (match !== null) {
		if (match.index > last) {
			parts.push(text.slice(last, match.index));
		}
		parts.push(
			<code key={match.index} className={FILE_REF_CLASSES}>
				<Text>{T_TEXT}</Text>{match.groups?.["path"]}
			</code>,
		);
		last = FILE_REF_RE.lastIndex;
		match = FILE_REF_RE.exec(text);
	}

	if (parts.length === 0) {
		return text;
	}
	if (last < text.length) {
		parts.push(text.slice(last));
	}
	return <>{parts}</>;
}

type MarkdownRendererProps = {
	content: string;
	onLinkClick?: ((url: string) => void) | undefined;
};

export function MarkdownRenderer({ content, onLinkClick }: MarkdownRendererProps) {
	return (
		<div className={MARKDOWN_CONTENT_CLASSES}>
			<Markdown
				remarkPlugins={[remarkGfm]}
				components={{
					p: ({ children }) => (
						<p>
							{React.Children.map(children, (child) =>
								typeof child === "string" ? renderTextWithFileRefs(child) : child,
							)}
						</p>
					),
					code: ({ className, children, ...props }) => {
						const match = LANGUAGE_CLASS_REGEX.exec(className || "");
						const text = String(children).replace(TRAILING_NEWLINE_REGEX, "");

						// Inline code (no language class, single line)
						if (!(match || text.includes("\n"))) {
							return (
								<code className={className} {...props}>
									{children}
								</code>
							);
						}

						const lang = match?.groups?.["lang"];
						return <CodeBox {...(lang ? { language: lang } : {})}>{text}</CodeBox>;
					},
					a: ({ href, children, ...props }) => {
						const isExternal = href?.startsWith("http://") || href?.startsWith("https://");
						return (
							<a
								href={href}
								{...(isExternal && onLinkClick
									? {
											onClick: (e: React.MouseEvent) => {
												e.preventDefault();
												if (href) {
													onLinkClick(href);
												}
											},
										}
									: {})}
								{...props}
							>
								{children}
							</a>
						);
					},
				}}
			>
				{content}
			</Markdown>
		</div>
	);
}
