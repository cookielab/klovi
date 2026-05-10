import { useTheme } from "@cookielab.io/klovi-design-system";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import oneDark from "react-syntax-highlighter/dist/esm/styles/prism/one-dark";
import oneLight from "react-syntax-highlighter/dist/esm/styles/prism/one-light";


const N_1_5 = 1.5;

const LINE_NUMBER_THRESHOLD = 3;
const HEADER_CLASSES =
	"flex items-center px-3 py-[6px] bg-surface-code text-[0.75rem] text-foreground-subtle font-mono";

type DiffViewProps = {
	filePath: string;
	oldString: string;
	newString: string;
};

export function formatDiff(oldString: string, newString: string): string {
	const lines: string[] = [];

	if (oldString !== "") {
		for (const line of oldString.split("\n")) {
			lines.push(`-${line}`);
		}
	}
	if (newString !== "") {
		for (const line of newString.split("\n")) {
			lines.push(`+${line}`);
		}
	}

	return lines.join("\n");
}

export function DiffView({ filePath, oldString, newString }: DiffViewProps): React.ReactNode {
	const { resolved: theme } = useTheme();
	const diff = formatDiff(oldString, newString);
	const style = theme === "dark" ? oneDark : oneLight;

	return (
		<div className="relative">
			<div className={HEADER_CLASSES}>
				<span>{filePath}</span>
			</div>
			<div className="overflow-x-auto [&_pre]:m-0 [&_pre]:bg-surface-code">
				<SyntaxHighlighter
					language="diff"
					style={style}
					customStyle={{
						margin: 0,
						fontSize: "0.85em",
						lineHeight: N_1_5,
					}}
					showLineNumbers={diff.split("\n").length > LINE_NUMBER_THRESHOLD}
				>
					{diff}
				</SyntaxHighlighter>
			</div>
		</div>
	);
}
