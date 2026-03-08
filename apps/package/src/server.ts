import { execFile } from "node:child_process";
import { join } from "node:path";
import { makeRpcRouter } from "@cookielab.io/klovi-server/effect/http-app";
import { makeBunServerLayer } from "@cookielab.io/klovi-server/effect/platform-bun";
import { makeNodeServerLayer } from "@cookielab.io/klovi-server/effect/platform-node";
import { setPluginLayer } from "@cookielab.io/klovi-server/effect/plugin-runtime";
import { ServerConfig } from "@cookielab.io/klovi-server/effect/server-config";
import { KloviServicesLive } from "@cookielab.io/klovi-server/effect/server-services";
import { HttpServer } from "@effect/platform";
import { BunContext } from "@effect/platform-bun";
import { NodeContext } from "@effect/platform-node";
import { Effect, Fiber, Layer } from "effect";
import { makePackageServeLayer } from "./http-app.ts";

export interface StartKloviPackageServerOptions {
  host?: string;
  port?: number;
  staticDir?: string | undefined;
  openBrowser?: boolean;
  version?: string;
  commit?: string;
  settingsPath?: string;
  runtime?: "auto" | "bun" | "node";
}

export interface KloviPackageServer {
  url: string;
  stop(): void;
}

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

function openInBrowser(url: string): void {
  const cmd =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", url] : [url];
  execFile(cmd, args, () => {});
}

export async function startKloviPackageServer(
  options: StartKloviPackageServerOptions = {},
): Promise<KloviPackageServer> {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 0;
  const settingsPath = options.settingsPath ?? getDefaultSettingsPath();
  const version = options.version ?? "dev";
  const commit = options.commit ?? "";
  const rt = detectRuntime(options.runtime);

  if (rt === "node") {
    const { NodePluginLayer } = await import("@cookielab.io/klovi-server/effect/platform-node");
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

  const httpLayer =
    rt === "bun"
      ? makeBunServerLayer({ hostname: host, port })
      : makeNodeServerLayer({ host, port });

  const contextLayer = rt === "bun" ? BunContext.layer : NodeContext.layer;

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

  const serveLayer = options.staticDir
    ? makePackageServeLayer(options.staticDir)
    : makeRpcRouter().pipe(HttpServer.serve());

  const fullLayer = Layer.merge(serveLayer, addressCapture).pipe(
    Layer.provide(servicesLayer),
    Layer.provide(configLayer),
    Layer.provide(contextLayer),
    Layer.provide(httpLayer),
  );

  const fiber = Effect.runFork(Layer.launch(fullLayer));
  const url = await addressPromise;

  if (options.openBrowser) {
    openInBrowser(url);
  }

  return {
    url,
    stop() {
      Effect.runFork(Fiber.interrupt(fiber));
    },
  };
}
