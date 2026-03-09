import type {
  MergedProject as CoreMergedProject,
  PluginProject as CorePluginProject,
  ToolPlugin as CoreToolPlugin,
  Session,
  SessionSummary,
} from "@cookielab.io/klovi-plugin-core";

export type PluginProject = CorePluginProject<string>;

export type MergedProject = CoreMergedProject<string>;

export type ToolPlugin = CoreToolPlugin<string, SessionSummary, Session>;
