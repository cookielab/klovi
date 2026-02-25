import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useTheme } from "../../hooks/useTheme.ts";

const TRAILING_NEWLINE_REGEX = /\n$/;

interface CodeBlockProps {
  language?: string | undefined;
  children: string;
}

export function CodeBlock({ language, children }: CodeBlockProps) {
  const { resolved: theme } = useTheme();
  const lang = language || "text";
  const style = theme === "dark" ? oneDark : oneLight;

  return (
    <div className="code-block-wrapper">
      {language && (
        <div className="code-block-header">
          <span>{language}</span>
        </div>
      )}
      <div className="code-block-content">
        <SyntaxHighlighter
          language={lang}
          style={style}
          customStyle={{
            margin: 0,
            fontSize: "0.85em",
            lineHeight: 1.5,
          }}
          showLineNumbers={children.split("\n").length > 3}
        >
          {children.replace(TRAILING_NEWLINE_REGEX, "")}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
