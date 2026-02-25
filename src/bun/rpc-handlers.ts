import { existsSync, unlinkSync } from "node:fs";
import pkg from "../../package.json" with { type: "json" };
import { scanStats } from "../parser/stats.ts";
import { BUILTIN_PLUGIN_DESCRIPTORS, BUILTIN_PLUGIN_ID_SET } from "../plugins/catalog.ts";
import type { PluginRegistry } from "../plugins/registry.ts";
import { sortByIsoDesc } from "../shared/iso-time.ts";
import type { PluginSettingInfo, VersionInfo } from "../shared/rpc-types.ts";
import { encodeSessionId, parseSessionId } from "../shared/session-id.ts";
import type { GlobalSessionResult, SessionSummary } from "../shared/types.ts";
import { loadSettings, saveSettings } from "./settings.ts";

const version = pkg.version == null || pkg.version === "0.0.0" ? "dev" : pkg.version;

export function getVersion(): VersionInfo {
  return {
    version,
    commit: process.env["KLOVI_COMMIT"] ?? "",
  };
}

export async function getStats(registry: PluginRegistry) {
  const stats = await scanStats(registry);
  return { stats };
}

export async function getProjects(registry: PluginRegistry) {
  const projects = await registry.discoverAllProjects();
  return { projects };
}

export async function getSessions(registry: PluginRegistry, params: { encodedPath: string }) {
  const projects = await registry.discoverAllProjects();
  const project = projects.find((p) => p.encodedPath === params.encodedPath);
  if (!project) return { sessions: [] as SessionSummary[] };
  const sessions = await registry.listAllSessions(project);
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

  const projects = await registry.discoverAllProjects();
  const project = projects.find((p) => p.encodedPath === params.project);
  if (!project) throw new Error("Project not found");

  const source = project.sources.find((s) => s.pluginId === pluginId);
  if (!source) throw new Error("Plugin source not found");

  const plugin = registry.getPlugin(pluginId);
  const sessionDetail = plugin.loadSessionDetail
    ? await plugin.loadSessionDetail(source.nativeId, rawSessionId)
    : undefined;
  const session =
    sessionDetail?.session ?? (await plugin.loadSession(source.nativeId, rawSessionId));
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

  const session = await plugin.loadSubAgentSession({
    sessionId: parsed.rawSessionId,
    project: params.project,
    agentId: params.agentId,
  });
  return { session };
}

function projectNameFromPath(fullPath: string): string {
  const parts = fullPath.split("/").filter(Boolean);
  return parts.slice(-2).join("/");
}

export async function searchSessions(registry: PluginRegistry) {
  const projects = await registry.discoverAllProjects();
  const allSessions: GlobalSessionResult[] = [];

  for (const project of projects) {
    const sessions = await registry.listAllSessions(project);
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

function buildPluginSettingsResponse(settingsPath: string): { plugins: PluginSettingInfo[] } {
  const settings = loadSettings(settingsPath);
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

export function getPluginSettings(settingsPath: string): { plugins: PluginSettingInfo[] } {
  return buildPluginSettingsResponse(settingsPath);
}

export function getGeneralSettings(settingsPath: string): { showSecurityWarning: boolean } {
  const settings = loadSettings(settingsPath);
  return { showSecurityWarning: settings.general?.showSecurityWarning ?? true };
}

export function isFirstLaunch(settingsPath: string): { firstLaunch: boolean } {
  return { firstLaunch: !existsSync(settingsPath) };
}

export function resetSettings(settingsPath: string): { ok: boolean } {
  if (existsSync(settingsPath)) {
    unlinkSync(settingsPath);
  }
  return { ok: true };
}

export function updateGeneralSettings(
  settingsPath: string,
  params: { showSecurityWarning?: boolean },
): { showSecurityWarning: boolean } {
  const settings = loadSettings(settingsPath);
  if (!settings.general) {
    settings.general = {};
  }
  if (params.showSecurityWarning !== undefined) {
    settings.general.showSecurityWarning = params.showSecurityWarning;
  }
  saveSettings(settingsPath, settings);
  return { showSecurityWarning: settings.general.showSecurityWarning ?? true };
}

export function updatePluginSetting(
  settingsPath: string,
  params: { pluginId: string; enabled?: boolean; dataDir?: string | null },
): { plugins: PluginSettingInfo[] } {
  if (!BUILTIN_PLUGIN_ID_SET.has(params.pluginId)) {
    throw new Error(`Unknown plugin: ${params.pluginId}`);
  }
  const settings = loadSettings(settingsPath);
  const existing = settings.plugins[params.pluginId] ?? { enabled: true, dataDir: null };

  if (params.enabled !== undefined) {
    existing.enabled = params.enabled;
  }
  if (params.dataDir !== undefined) {
    existing.dataDir = params.dataDir;
  }

  settings.plugins[params.pluginId] = existing;
  saveSettings(settingsPath, settings);
  return buildPluginSettingsResponse(settingsPath);
}
