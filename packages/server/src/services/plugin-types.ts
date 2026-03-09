import type {
  MergedProject as CoreMergedProject,
  PluginProject as CorePluginProject,
  ToolPlugin as CoreToolPlugin,
} from "@cookielab.io/klovi-plugin-core";
import type { Session, SessionSummary } from "@cookielab.io/klovi-ui-components/types";

export type PluginProject = CorePluginProject<string>;

export type MergedProject = CoreMergedProject<string>;

export type ToolPlugin = CoreToolPlugin<string, SessionSummary, Session>;
