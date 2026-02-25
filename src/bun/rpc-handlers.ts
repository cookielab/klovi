import { existsSync, unlinkSync } from "node:fs";
import pkg from "../../package.json" with { type: "json" };
import { scanStats } from "../parser/stats.ts";
import {
  findImplSessionId,
  findPlanSessionId,
  loadClaudeSession,
  parseSubAgentSession,
} from "../plugins/claude-code/parser.ts";
import { getClaudeCodeDir, getCodexCliDir, getOpenCodeDir } from "../plugins/config.ts";
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

  if (pluginId === "claude-code") {
    const [{ session, slug }, sessions] = await Promise.all([
      loadClaudeSession(source.nativeId, rawSessionId),
      plugin.listSessions(source.nativeId),
    ]);

    const planRawId = findPlanSessionId(session.turns, slug, sessions, rawSessionId);
    const implRawId = findImplSessionId(slug, sessions, rawSessionId);

    session.sessionId = encodeSessionId(pluginId, rawSessionId);
    session.planSessionId = planRawId ? encodeSessionId(pluginId, planRawId) : undefined;
    session.implSessionId = implRawId ? encodeSessionId(pluginId, implRawId) : undefined;

    return { session };
  }

  const session = await plugin.loadSession(source.nativeId, rawSessionId);
  session.sessionId = encodeSessionId(pluginId, rawSessionId);
  session.pluginId = pluginId;
  return { session };
}

export async function getSubAgent(
  _registry: PluginRegistry,
  params: { sessionId: string; project: string; agentId: string },
) {
  const parsed = parseSessionId(params.sessionId);
  if (parsed.pluginId !== "claude-code" || !parsed.rawSessionId) {
    throw new Error("Invalid sessionId format for sub-agent");
  }
  const session = await parseSubAgentSession(parsed.rawSessionId, params.project, params.agentId);
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

const PLUGIN_META: Array<{ id: string; displayName: string; getDefaultDir: () => string }> = [
  { id: "claude-code", displayName: "Claude Code", getDefaultDir: getClaudeCodeDir },
  { id: "codex-cli", displayName: "Codex CLI", getDefaultDir: getCodexCliDir },
  { id: "opencode", displayName: "OpenCode", getDefaultDir: getOpenCodeDir },
];

function buildPluginSettingsResponse(settingsPath: string): { plugins: PluginSettingInfo[] } {
  const settings = loadSettings(settingsPath);
  const plugins: PluginSettingInfo[] = PLUGIN_META.map(({ id, displayName, getDefaultDir }) => {
    const pluginConf = settings.plugins[id] ?? { enabled: true, dataDir: null };
    const defaultDataDir = getDefaultDir();
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

const VALID_PLUGIN_IDS = new Set(PLUGIN_META.map((p) => p.id));

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
  if (!VALID_PLUGIN_IDS.has(params.pluginId)) {
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
