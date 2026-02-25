import { MarkdownRenderer as UIMarkdownRenderer } from "@cookielab.io/klovi-ui/messages";
import { getRPC } from "../../rpc.ts";

interface MarkdownRendererProps {
  content: string;
}

function handleLinkClick(url: string): void {
  void getRPC().request.openExternal({ url });
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return <UIMarkdownRenderer content={content} onLinkClick={handleLinkClick} />;
}
