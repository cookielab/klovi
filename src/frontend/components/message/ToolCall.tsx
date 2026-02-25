import {
  formatToolInput as formatToolInputBase,
  getToolSummary as getToolSummaryBase,
  ToolCall as ToolCallBase,
} from "@cookielab.io/klovi-ui/tools";
import type { ToolCallWithResult } from "../../../shared/types.ts";
import { getFrontendPlugin } from "../../plugin-registry.ts";

export {
  hasInputFormatter,
  MAX_OUTPUT_LENGTH,
  MAX_THINKING_PREVIEW,
  truncateOutput,
} from "@cookielab.io/klovi-ui/tools";

interface ToolCallProps {
  call: ToolCallWithResult;
  sessionId?: string | undefined;
  project?: string | undefined;
  pluginId?: string | undefined;
}

export function getToolSummary(call: ToolCallWithResult, pluginId?: string): string {
  return getToolSummaryBase(call, getFrontendPlugin, pluginId);
}

export function formatToolInput(call: ToolCallWithResult, pluginId?: string): string {
  return formatToolInputBase(call, getFrontendPlugin, pluginId);
}

export function ToolCall({ call, sessionId, project, pluginId }: ToolCallProps) {
  return (
    <ToolCallBase
      call={call}
      sessionId={sessionId}
      project={project}
      pluginId={pluginId}
      getFrontendPlugin={getFrontendPlugin}
    />
  );
}
