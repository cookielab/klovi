import { join } from "node:path";
import { HttpServer } from "@effect/platform";
import { Effect, Fiber, Layer } from "effect";
import { makeServeLayer } from "./effect/http-app.ts";
import { makeBunServerLayer } from "./effect/platform-bun.ts";
import { makeNodeServerLayer } from "./effect/platform-node.ts";
import { setPluginLayer } from "./effect/plugin-runtime.ts";
import { ServerConfig } from "./effect/server-config.ts";
import { KloviServicesLive } from "./effect/server-services.ts";

export interface StartKloviServerOptions {
  host?: string;
  port?: number;
  mode?: "standalone" | "embedded";
  version?: string;
  commit?: string;
  settingsPath?: string;
  runtime?: "auto" | "bun" | "node";
}

export interface KloviServer {
  url: string;
  stop(): void;
}

export { ServerConfig, type ServerConfigShape } from "./effect/server-config.ts";
export { KloviServicesLive, type KloviServicesShape } from "./effect/server-services.ts";

function getDefaultSettingsPath(): string {
  const home = process.env["HOME"] ?? "";
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
  const configHome = process.env["XDG_CONFIG_HOME"] ?? join(home, ".config");
  return join(configHome, "klovi", "settings.json");
}

function detectRuntime(requested: "auto" | "bun" | "node" = "auto"): "bun" | "node" {
  if (requested !== "auto") return requested;
  return typeof globalThis.Bun !== "undefined" ? "bun" : "node";
}

export async function startKloviServer(
  options: StartKloviServerOptions = {},
): Promise<KloviServer> {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 0;
  const settingsPath = options.settingsPath ?? getDefaultSettingsPath();
  const version = options.version ?? "dev";
  const commit = options.commit ?? "";
  const rt = detectRuntime(options.runtime);

  // Configure plugin layer for the selected runtime
  if (rt === "node") {
    const { NodePluginLayer } = await import("./effect/platform-node.ts");
    setPluginLayer(NodePluginLayer);
  }

  const configLayer = Layer.succeed(ServerConfig, {
    host,
    port,
    settingsPath,
    version,
    commit,
  });

  const servicesLayer = KloviServicesLive.pipe(Layer.provide(configLayer));

  const platformLayer =
    rt === "bun"
      ? makeBunServerLayer({ hostname: host, port })
      : makeNodeServerLayer({ host, port });

  let resolveAddress!: (url: string) => void;
  const addressPromise = new Promise<string>((resolve) => {
    resolveAddress = resolve;
  });

  const addressCapture = Layer.effectDiscard(
    HttpServer.addressWith((address) =>
      Effect.sync(() => {
        const addr = address as HttpServer.TcpAddress;
        resolveAddress(`http://${addr.hostname}:${addr.port}`);
      }),
    ),
  );

  const fullLayer = Layer.merge(makeServeLayer(), addressCapture).pipe(
    Layer.provide(servicesLayer),
    Layer.provide(configLayer),
    Layer.provide(platformLayer),
  );

  const fiber = Effect.runFork(Layer.launch(fullLayer));
  const url = await addressPromise;

  return {
    url,
    stop() {
      Effect.runFork(Fiber.interrupt(fiber));
    },
  };
}
