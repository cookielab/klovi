import { PresentationShell as UIPresentationShell } from "@cookielab.io/klovi-ui/presentation";
import type { Turn } from "../../../shared/types.ts";
import { getFrontendPlugin } from "../../plugin-registry.ts";
import { getRPC } from "../../rpc.ts";

interface PackagePresentationShellProps {
  turns: Turn[];
  onExit: () => void;
  sessionId: string;
  project: string;
  pluginId?: string | undefined;
  isSubAgent?: boolean | undefined;
}

function handleLinkClick(url: string): void {
  void getRPC().request.openExternal({ url });
}

export function PackagePresentationShell({
  turns,
  onExit,
  sessionId,
  project,
  pluginId,
  isSubAgent,
}: PackagePresentationShellProps) {
  return (
    <UIPresentationShell
      turns={turns}
      onExit={onExit}
      sessionId={sessionId}
      project={project}
      pluginId={pluginId}
      isSubAgent={isSubAgent}
      onLinkClick={handleLinkClick}
      getFrontendPlugin={getFrontendPlugin}
    />
  );
}
