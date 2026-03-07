import { join } from "node:path";
import { handleRPC, type RPCContext, RPCError } from "./rpc.ts";
import { createRegistry } from "./services/auto-discover.ts";
import type { PluginRegistry } from "./services/registry.ts";
import { loadSettings } from "./services/settings.ts";

export interface StartKloviServerOptions {
  host?: string;
  port?: number;
  mode?: "standalone" | "embedded";
  staticDir?: string | undefined;
  openBrowser?: boolean;
}

export interface KloviServer {
  url: string;
  stop(): void;
}

function getDefaultSettingsPath(): string {
  const home = Bun.env["HOME"] ?? "";
  if (process.platform === "darwin") {
    return join(
      home,
      "Library",
      "Application Support",
      "io.cookielab.klovi",
      "stable",
      "settings.json",
    );
  }
  const configHome = Bun.env["XDG_CONFIG_HOME"] ?? join(home, ".config");
  return join(configHome, "klovi", "settings.json");
}

async function handleRPCRequest(ctx: RPCContext, url: URL, req: Request): Promise<Response> {
  const method = url.pathname.slice("/api/rpc/".length);
  if (!method) {
    return Response.json({ error: "Method name required" }, { status: 400 });
  }

  let params: Record<string, unknown> = {};
  try {
    const body = await req.text();
    if (body) {
      params = JSON.parse(body) as Record<string, unknown>;
    }
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const result = await handleRPC(method, ctx, params);
    return Response.json(result);
  } catch (err) {
    if (err instanceof RPCError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}

async function serveStaticFile(staticDir: string, url: URL): Promise<Response | null> {
  const filePath = url.pathname === "/" ? "/index.html" : url.pathname;
  const file = Bun.file(join(staticDir, filePath));
  if (await file.exists()) {
    return new Response(file);
  }
  // SPA fallback
  const indexFile = Bun.file(join(staticDir, "index.html"));
  if (await indexFile.exists()) {
    return new Response(indexFile);
  }
  return null;
}

export async function startKloviServer(
  options: StartKloviServerOptions = {},
): Promise<KloviServer> {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 0;

  const settingsPath = getDefaultSettingsPath();
  const settings = await loadSettings(settingsPath);
  const registry: PluginRegistry = await createRegistry(settings);

  const ctx: RPCContext = { registry, settingsPath };

  const server = Bun.serve({
    hostname: host,
    port,
    async fetch(req) {
      const url = new URL(req.url);

      if (req.method === "POST" && url.pathname.startsWith("/api/rpc/")) {
        return handleRPCRequest(ctx, url, req);
      }

      if (options.staticDir && req.method === "GET") {
        const staticResponse = await serveStaticFile(options.staticDir, url);
        if (staticResponse) return staticResponse;
      }

      return Response.json({ error: "Not found" }, { status: 404 });
    },
  });

  const serverUrl = `http://${host}:${server.port}`;

  return {
    url: serverUrl,
    stop() {
      server.stop();
    },
  };
}
