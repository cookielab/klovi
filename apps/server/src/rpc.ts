import {
  getGeneralSettings,
  getPluginSettings,
  getProjects,
  getSession,
  getSessions,
  getStats,
  getSubAgent,
  getVersion,
  isFirstLaunch,
  resetSettings,
  searchSessions,
  updateGeneralSettings,
  updatePluginSetting,
} from "./services/app-services.ts";
import type { PluginRegistry } from "./services/registry.ts";

export interface RPCContext {
  registry: PluginRegistry;
  settingsPath: string;
}

type RPCHandler = (ctx: RPCContext, params: Record<string, unknown>) => Promise<unknown> | unknown;

const handlers: Record<string, RPCHandler> = {
  acceptRisks: () => ({ ok: true }),
  isFirstLaunch: (ctx) => isFirstLaunch(ctx.settingsPath),
  getVersion: () => getVersion(),
  getStats: (ctx) => getStats(ctx.registry),
  getProjects: (ctx) => getProjects(ctx.registry),
  getSessions: (ctx, params) => getSessions(ctx.registry, params as { encodedPath: string }),
  getSession: (ctx, params) =>
    getSession(ctx.registry, params as { sessionId: string; project: string }),
  getSubAgent: (ctx, params) =>
    getSubAgent(ctx.registry, params as { sessionId: string; project: string; agentId: string }),
  searchSessions: (ctx) => searchSessions(ctx.registry),
  getPluginSettings: (ctx) => getPluginSettings(ctx.settingsPath),
  updatePluginSetting: (ctx, params) =>
    updatePluginSetting(
      ctx.settingsPath,
      params as { pluginId: string; enabled?: boolean; dataDir?: string | null },
    ),
  getGeneralSettings: (ctx) => getGeneralSettings(ctx.settingsPath),
  updateGeneralSettings: (ctx, params) =>
    updateGeneralSettings(ctx.settingsPath, params as { showSecurityWarning?: boolean }),
  resetSettings: (ctx) => resetSettings(ctx.settingsPath),
};

export function handleRPC(
  method: string,
  ctx: RPCContext,
  params: Record<string, unknown>,
): Promise<unknown> | unknown {
  const handler = handlers[method];
  if (!handler) {
    throw new RPCError(404, `Unknown method: ${method}`);
  }
  return handler(ctx, params);
}

export class RPCError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
