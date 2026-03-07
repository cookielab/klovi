import { access, rm } from "node:fs/promises";
import type { GlobalSessionResult, SessionSummary } from "@cookielab.io/klovi-ui/types";
import { runPluginEffect, runRegistryEffect } from "../effect/plugin-runtime.ts";
import { BUILTIN_PLUGIN_DESCRIPTORS, BUILTIN_PLUGIN_ID_SET } from "./catalog.ts";
import { sortByIsoDesc } from "./iso-time.ts";
import type { PluginRegistry } from "./registry.ts";
import { encodeSessionId, parseSessionId } from "./session-id.ts";
import type { UpdateChannel } from "./settings.ts";
import { loadSettings, saveSettings } from "./settings.ts";
import { scanStats } from "./stats.ts";

export interface VersionInfo {
  version: string;
  commit: string;
}

export interface PluginSettingInfo {
  id: string;
  displayName: string;
  enabled: boolean;
  dataDir: string;
  defaultDataDir: string;
  isCustomDir: boolean;
}

export type UpdateSettingsInfo = {
  channel: UpdateChannel;
  checkIntervalHours: number;
  autoDownload: boolean;
};

let _version = "dev";
let _commit = "";

export function setVersion(version: string, commit: string): void {
  _version = version == null || version === "0.0.0" ? "dev" : version;
  _commit = commit ?? "";
}

export function getVersion(): VersionInfo {
  return {
    version: _version,
    commit: _commit,
  };
}

export async function getStats(registry: PluginRegistry) {
  const stats = await scanStats(registry);
  return { stats };
}

export async function getProjects(registry: PluginRegistry) {
  const projects = await runRegistryEffect(registry.discoverAllProjects());
  return { projects };
}

export async function getSessions(registry: PluginRegistry, params: { encodedPath: string }) {
  const projects = await runRegistryEffect(registry.discoverAllProjects());
  const project = projects.find((p) => p.encodedPath === params.encodedPath);
  if (!project) return { sessions: [] as SessionSummary[] };
  const sessions = await runRegistryEffect(registry.listAllSessions(project));
  return { sessions };
}

export async function getSession(
  registry: PluginRegistry,
  params: { sessionId: string; project: string },
) {
  const parsed = parseSessionId(params.sessionId);
  if (!parsed.pluginId || !parsed.rawSessionId) {
    throw new Error("Invalid sessionId format");
  }

  const pluginId = parsed.pluginId;
  const rawSessionId = parsed.rawSessionId;

  const projects = await runRegistryEffect(registry.discoverAllProjects());
  const project = projects.find((p) => p.encodedPath === params.project);
  if (!project) throw new Error("Project not found");

  const source = project.sources.find((s) => s.pluginId === pluginId);
  if (!source) throw new Error("Plugin source not found");

  const plugin = registry.getPlugin(pluginId);
  const pluginConfig = registry.getPluginConfig(pluginId);

  const sessionDetail = plugin.loadSessionDetail
    ? await runPluginEffect(plugin.loadSessionDetail(source.nativeId, rawSessionId), pluginConfig)
    : undefined;
  const session =
    sessionDetail?.session ??
    (await runPluginEffect(plugin.loadSession(source.nativeId, rawSessionId), pluginConfig));
  session.sessionId = encodeSessionId(pluginId, rawSessionId);
  session.pluginId = pluginId;
  session.planSessionId = sessionDetail?.planSessionId
    ? encodeSessionId(pluginId, sessionDetail.planSessionId)
    : undefined;
  session.implSessionId = sessionDetail?.implSessionId
    ? encodeSessionId(pluginId, sessionDetail.implSessionId)
    : undefined;
  return { session };
}

export async function getSubAgent(
  registry: PluginRegistry,
  params: { sessionId: string; project: string; agentId: string },
) {
  const parsed = parseSessionId(params.sessionId);
  if (!parsed.pluginId || !parsed.rawSessionId) {
    throw new Error("Invalid sessionId format");
  }

  const plugin = registry.getPlugin(parsed.pluginId);
  if (!plugin.loadSubAgentSession) {
    throw new Error(`Sub-agent sessions are not supported by plugin: ${parsed.pluginId}`);
  }

  const pluginConfig = registry.getPluginConfig(parsed.pluginId);
  const session = await runPluginEffect(
    plugin.loadSubAgentSession({
      sessionId: parsed.rawSessionId,
      project: params.project,
      agentId: params.agentId,
    }),
    pluginConfig,
  );
  return { session };
}

function projectNameFromPath(fullPath: string): string {
  const parts = fullPath.split("/").filter(Boolean);
  return parts.slice(-2).join("/");
}

export async function searchSessions(registry: PluginRegistry) {
  const projects = await runRegistryEffect(registry.discoverAllProjects());
  const allSessions: GlobalSessionResult[] = [];

  for (const project of projects) {
    const sessions = await runRegistryEffect(registry.listAllSessions(project));
    const projectName = projectNameFromPath(project.name);
    for (const session of sessions) {
      allSessions.push({
        ...session,
        encodedPath: project.encodedPath,
        projectName,
      });
    }
  }

  sortByIsoDesc(allSessions, (session) => session.timestamp);
  return { sessions: allSessions };
}

async function buildPluginSettingsResponse(
  settingsPath: string,
): Promise<{ plugins: PluginSettingInfo[] }> {
  const settings = await loadSettings(settingsPath);
  const plugins: PluginSettingInfo[] = BUILTIN_PLUGIN_DESCRIPTORS.map(({ plugin, defaultDir }) => {
    const id = plugin.id;
    const displayName = plugin.displayName;
    const pluginConf = settings.plugins[id] ?? { enabled: true, dataDir: null };
    const defaultDataDir = defaultDir;
    const isCustomDir = pluginConf.dataDir !== null;
    return {
      id,
      displayName,
      enabled: pluginConf.enabled,
      dataDir: pluginConf.dataDir ?? defaultDataDir,
      defaultDataDir,
      isCustomDir,
    };
  });
  return { plugins };
}

export function getPluginSettings(settingsPath: string): Promise<{ plugins: PluginSettingInfo[] }> {
  return buildPluginSettingsResponse(settingsPath);
}

export async function getGeneralSettings(
  settingsPath: string,
): Promise<{ showSecurityWarning: boolean }> {
  const settings = await loadSettings(settingsPath);
  return { showSecurityWarning: settings.general?.showSecurityWarning ?? true };
}

export async function isFirstLaunch(settingsPath: string): Promise<{ firstLaunch: boolean }> {
  try {
    await access(settingsPath);
    return { firstLaunch: false };
  } catch {
    return { firstLaunch: true };
  }
}

export async function resetSettings(settingsPath: string): Promise<{ ok: boolean }> {
  try {
    await rm(settingsPath);
  } catch {
    // File may not exist — that's fine
  }
  return { ok: true };
}

export async function updateGeneralSettings(
  settingsPath: string,
  params: { showSecurityWarning?: boolean },
): Promise<{ showSecurityWarning: boolean }> {
  const settings = await loadSettings(settingsPath);
  if (!settings.general) {
    settings.general = {};
  }
  if (params.showSecurityWarning !== undefined) {
    settings.general.showSecurityWarning = params.showSecurityWarning;
  }
  await saveSettings(settingsPath, settings);
  return { showSecurityWarning: settings.general.showSecurityWarning ?? true };
}

export async function updatePluginSetting(
  settingsPath: string,
  params: { pluginId: string; enabled?: boolean; dataDir?: string | null },
): Promise<{ plugins: PluginSettingInfo[] }> {
  if (!BUILTIN_PLUGIN_ID_SET.has(params.pluginId)) {
    throw new Error(`Unknown plugin: ${params.pluginId}`);
  }
  const settings = await loadSettings(settingsPath);
  const existing = settings.plugins[params.pluginId] ?? { enabled: true, dataDir: null };

  if (params.enabled !== undefined) {
    existing.enabled = params.enabled;
  }
  if (params.dataDir !== undefined) {
    existing.dataDir = params.dataDir;
  }

  settings.plugins[params.pluginId] = existing;
  await saveSettings(settingsPath, settings);
  return buildPluginSettingsResponse(settingsPath);
}

export async function getUpdateSettings(settingsPath: string): Promise<UpdateSettingsInfo> {
  const settings = await loadSettings(settingsPath);
  return {
    channel: settings.updates?.channel ?? "stable",
    checkIntervalHours: settings.updates?.checkIntervalHours ?? 6,
    autoDownload: settings.updates?.autoDownload ?? true,
  };
}

export async function updateUpdateSettings(
  settingsPath: string,
  params: { channel?: UpdateChannel; checkIntervalHours?: number; autoDownload?: boolean },
): Promise<UpdateSettingsInfo> {
  const settings = await loadSettings(settingsPath);
  if (!settings.updates) {
    settings.updates = { channel: "stable", checkIntervalHours: 6, autoDownload: true };
  }
  if (params.channel !== undefined) {
    settings.updates.channel = params.channel;
  }
  if (params.checkIntervalHours !== undefined) {
    const clamped = Math.max(1, Math.min(24, Math.round(params.checkIntervalHours)));
    settings.updates.checkIntervalHours = clamped;
  }
  if (params.autoDownload !== undefined) {
    settings.updates.autoDownload = params.autoDownload;
  }
  await saveSettings(settingsPath, settings);
  return {
    channel: settings.updates.channel,
    checkIntervalHours: settings.updates.checkIntervalHours,
    autoDownload: settings.updates.autoDownload,
  };
}
