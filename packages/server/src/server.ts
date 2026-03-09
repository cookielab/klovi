import { bootstrapServer } from "./effect/bootstrap.ts";
import { makeServeLayer } from "./effect/http-app.ts";

export interface StartKloviServerOptions {
  host?: string;
  port?: number;
  version?: string;
  commit?: string;
  settingsPath?: string;
  runtime?: "auto" | "bun" | "node";
}

export interface KloviServer {
  url: string;
  stop(): void;
}

export function startKloviServer(options: StartKloviServerOptions = {}): Promise<KloviServer> {
  return bootstrapServer(options, makeServeLayer);
}
