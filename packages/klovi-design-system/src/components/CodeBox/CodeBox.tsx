import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useTheme } from "../../hooks/useTheme.ts";
import styles from "./CodeBox.module.css";

const TRAILING_NEWLINE_REGEX = /\n$/;

interface CodeBoxProps {
  language?: string;
  children: string;
  showLineNumbers?: boolean;
}

function s(name: string | undefined): string {
  return name ?? "";
}

export function CodeBox({ language, children, showLineNumbers }: CodeBoxProps) {
  const { resolved: theme } = useTheme();
  const lang = language || "text";
  const style = theme === "dark" ? oneDark : oneLight;
  const lineNumbers = showLineNumbers ?? children.split("\n").length > 3;

  return (
    <div className={s(styles["wrapper"])}>
      {language && (
        <div className={s(styles["header"])}>
          <span>{language}</span>
        </div>
      )}
      <div className={s(styles["content"])}>
        <SyntaxHighlighter
          language={lang}
          style={style}
          customStyle={{
            margin: 0,
            fontSize: "0.85em",
            lineHeight: 1.5,
          }}
          showLineNumbers={lineNumbers}
        >
          {children.replace(TRAILING_NEWLINE_REGEX, "")}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
