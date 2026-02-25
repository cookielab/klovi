import React from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getRPC } from "../../rpc.ts";
import { CodeBlock } from "./CodeBlock.tsx";

const FILE_REF_RE = /@([\w./-]+\.\w+)/g;
const LANGUAGE_CLASS_REGEX = /language-(\w+)/;
const TRAILING_NEWLINE_REGEX = /\n$/;

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
      <code key={match.index} className="file-ref">
        @{match[1]}
      </code>,
    );
    last = FILE_REF_RE.lastIndex;
    match = FILE_REF_RE.exec(text);
  }

  if (parts.length === 0) return text;
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="markdown-content">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          p({ children }) {
            return (
              <p>
                {React.Children.map(children, (child) =>
                  typeof child === "string" ? renderTextWithFileRefs(child) : child,
                )}
              </p>
            );
          },
          code({ className, children, ...props }) {
            const match = LANGUAGE_CLASS_REGEX.exec(className || "");
            const text = String(children).replace(TRAILING_NEWLINE_REGEX, "");

            // Inline code (no language class, single line)
            if (!match && !text.includes("\n")) {
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            }

            return <CodeBlock language={match?.[1]}>{text}</CodeBlock>;
          },
          // Open external links via Electrobun
          a({ href, children, ...props }) {
            const isExternal = href?.startsWith("http://") || href?.startsWith("https://");
            return (
              <a
                href={href}
                {...(isExternal
                  ? {
                      onClick: (e: React.MouseEvent) => {
                        e.preventDefault();
                        if (href) void getRPC().request.openExternal({ url: href });
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
