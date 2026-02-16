import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useTheme } from "../../hooks/useTheme.ts";

interface DiffViewProps {
  filePath: string;
  oldString: string;
  newString: string;
}

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

export function DiffView({ filePath, oldString, newString }: DiffViewProps) {
  const { resolved: theme } = useTheme();
  const diff = formatDiff(oldString, newString);
  const style = theme === "dark" ? oneDark : oneLight;

  return (
    <div className="diff-view-wrapper">
      <div className="diff-view-header">
        <span>{filePath}</span>
      </div>
      <div className="diff-view-content">
        <SyntaxHighlighter
          language="diff"
          style={style}
          customStyle={{
            margin: 0,
            fontSize: "0.85em",
            lineHeight: 1.5,
          }}
          showLineNumbers={diff.split("\n").length > 3}
        >
          {diff}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
