import { PresentationShell as UIPresentationShell } from "@cookielab.io/klovi-ui/presentation";
import { useKloviHostBridge } from "../../../lib/context.ts";
import type { Turn } from "../../../shared/types.ts";
import { getFrontendPlugin } from "../../plugin-registry.ts";

interface PackagePresentationShellProps {
  turns: Turn[];
  onExit: () => void;
  sessionId: string;
  project: string;
  pluginId?: string | undefined;
  isSubAgent?: boolean | undefined;
}

export function PackagePresentationShell({
  turns,
  onExit,
  sessionId,
  project,
  pluginId,
  isSubAgent,
}: PackagePresentationShellProps) {
  const hostBridge = useKloviHostBridge();
  return (
    <UIPresentationShell
      turns={turns}
      onExit={onExit}
      sessionId={sessionId}
      project={project}
      pluginId={pluginId}
      isSubAgent={isSubAgent}
      onLinkClick={(url: string) => void hostBridge.openExternal({ url })}
      getFrontendPlugin={getFrontendPlugin}
    />
  );
}
