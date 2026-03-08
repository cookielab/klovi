import { useTheme } from "@cookielab.io/klovi-design-system";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import styles from "./DiffView.module.css";

function s(name: string | undefined): string {
  return name ?? "";
}

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
    <div className={s(styles["diffViewWrapper"])}>
      <div className={s(styles["diffViewHeader"])}>
        <span>{filePath}</span>
      </div>
      <div className={s(styles["diffViewContent"])}>
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
