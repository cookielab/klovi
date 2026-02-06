import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

interface CodeBlockProps {
  language?: string;
  children: string;
}

export function CodeBlock({ language, children }: CodeBlockProps) {
  const lang = language || "text";

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
          style={oneDark}
          customStyle={{
            margin: 0,
            fontSize: "0.85em",
            lineHeight: 1.5,
          }}
          showLineNumbers={children.split("\n").length > 3}
        >
          {children.replace(/\n$/, "")}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
