import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useTheme } from "../../hooks/useTheme.ts";

const TRAILING_NEWLINE_REGEX = /\n$/u;

type CodeBoxProps = {
	language?: string;
	children: string;
	showLineNumbers?: boolean;
};

const LINE_NUMBER_THRESHOLD = 3;

const CUSTOM_STYLE = {
	margin: 0,
	padding: "12px 16px",
	background: "var(--color-surface-code)",
	fontSize: "0.85em",
	lineHeight: 1.5,
};

export function CodeBox({ language, children, showLineNumbers }: CodeBoxProps) {
	const { resolved: theme } = useTheme();
	const lang = language ?? "text";
	const style = theme === "dark" ? oneDark : oneLight;
	const lineNumbers = showLineNumbers ?? children.split("\n").length > LINE_NUMBER_THRESHOLD;

	return (
		<div className="relative my-3">
			{language ? (
				<div className="flex items-center justify-between bg-surface-code px-3 py-1.5 text-[0.75rem] text-foreground-subtle">
					<span>{language}</span>
				</div>
			) : null}
			<div className="overflow-x-auto">
				<SyntaxHighlighter language={lang} style={style} customStyle={CUSTOM_STYLE} showLineNumbers={lineNumbers}>
					{children.replace(TRAILING_NEWLINE_REGEX, "")}
				</SyntaxHighlighter>
			</div>
		</div>
	);
}
