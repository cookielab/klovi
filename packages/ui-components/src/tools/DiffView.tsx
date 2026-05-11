import { useTheme } from "@cookielab.io/klovi-design-system";
import SyntaxHighlighter from "react-syntax-highlighter/dist/esm/prism";
import oneDark from "react-syntax-highlighter/dist/esm/styles/prism/one-dark";
import oneLight from "react-syntax-highlighter/dist/esm/styles/prism/one-light";
import { formatDiff } from "./DiffView.helpers";

const N_1_5 = 1.5;

const LINE_NUMBER_THRESHOLD = 3;
const HEADER_CLASSES =
	"flex items-center px-3 py-[6px] bg-surface-code text-[0.75rem] text-foreground-subtle font-mono";

type DiffViewProps = {
	filePath: string;
	oldString: string;
	newString: string;
};

function DiffView({ filePath, oldString, newString }: DiffViewProps): React.ReactNode {
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

export { formatDiff } from "./DiffView.helpers";
export { DiffView };
