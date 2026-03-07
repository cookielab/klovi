import type {
  Badge as CoreBadge,
  MergedProject as CoreMergedProject,
  PluginProject as CorePluginProject,
  ProjectSource as CoreProjectSource,
  ToolPlugin as CoreToolPlugin,
  ToolPluginSessionDetail as CoreToolPluginSessionDetail,
  ToolPluginSubAgentParams,
} from "@cookielab.io/klovi-plugin-core";
import {
  BUILTIN_KLOVI_PLUGIN_DISPLAY_NAMES,
  BUILTIN_KLOVI_PLUGIN_IDS,
  isBuiltinKloviPluginId,
  KLOVI_PLUGIN_PACKAGE_NAMES,
} from "@cookielab.io/klovi-plugin-core";
import type { Session, SessionSummary } from "./types.ts";

export {
  BUILTIN_KLOVI_PLUGIN_DISPLAY_NAMES,
  BUILTIN_KLOVI_PLUGIN_IDS,
  isBuiltinKloviPluginId,
  KLOVI_PLUGIN_PACKAGE_NAMES,
};

export type { BuiltinKloviPluginId, KloviPluginPackageName } from "@cookielab.io/klovi-plugin-core";

export type Badge = CoreBadge;

export type PluginProject = CorePluginProject<string>;

export type ProjectSource = CoreProjectSource<string>;

export type MergedProject = CoreMergedProject<string>;

export type ToolPlugin = CoreToolPlugin<string, SessionSummary, Session>;

export type ToolPluginSessionDetail = CoreToolPluginSessionDetail<Session>;

export type { ToolPluginSubAgentParams };
