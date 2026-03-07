import type { FrontendPlugin } from "@cookielab.io/klovi-plugin-core";
import { MessageList as UIMessageList } from "@cookielab.io/klovi-ui/messages";
import type { Turn } from "../../../shared/types.ts";
import { getFrontendPlugin } from "../../plugin-registry.ts";
import { getRPC } from "../../rpc.ts";

interface PackageMessageListProps {
  turns: Turn[];
  visibleSubSteps?: Map<number, number> | undefined;
  sessionId?: string | undefined;
  project?: string | undefined;
  pluginId?: string | undefined;
  isSubAgent?: boolean | undefined;
  planSessionId?: string | undefined;
  implSessionId?: string | undefined;
}

function handleLinkClick(url: string): void {
  void getRPC().request.openExternal({ url });
}

function resolveFrontendPlugin(id: string): FrontendPlugin | undefined {
  return getFrontendPlugin(id);
}

export function PackageMessageList({
  turns,
  visibleSubSteps,
  sessionId,
  project,
  pluginId,
  isSubAgent,
  planSessionId,
  implSessionId,
}: PackageMessageListProps) {
  return (
    <UIMessageList
      turns={turns}
      visibleSubSteps={visibleSubSteps}
      sessionId={sessionId}
      project={project}
      pluginId={pluginId}
      isSubAgent={isSubAgent}
      planSessionId={planSessionId}
      implSessionId={implSessionId}
      onLinkClick={handleLinkClick}
      getFrontendPlugin={resolveFrontendPlugin}
    />
  );
}
