import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { startKloviPackageServer } from "./server.ts";

const __dir = import.meta.dirname;

function resolveStaticDir(): string {
  // Built artifact: __dir = dist/ → dist/web
  // Source dev mode: __dir = src/ → ../packages/ui/dist (resolved via workspace)
  const builtPath = resolve(__dir, "web");
  if (existsSync(builtPath)) return builtPath;
  return resolve(__dir, "../../../packages/ui/dist");
}

// Both src/ and dist/ are direct children of apps/package/
const pkgPath = resolve(__dir, "../package.json");
const pkg = JSON.parse(await readFile(pkgPath, "utf-8")) as Record<string, string>;
const version = pkg["version"] ?? "0.0.0";
const commit = pkg["commit"] ?? "";

function parsePort(): number {
  const portArgIndex = process.argv.indexOf("--port");
  if (portArgIndex !== -1) {
    const value = process.argv[portArgIndex + 1];
    if (value !== undefined) return Number(value);
  }
  return Number(process.env["KLOVI_PORT"] ?? "3583");
}

const host = process.env["KLOVI_HOST"] ?? "127.0.0.1";
const port = parsePort();
const staticDir = process.env["KLOVI_STATIC_DIR"] ?? resolveStaticDir();

const openBrowser = !process.argv.includes("--no-browser");

const server = await startKloviPackageServer({
  host,
  port,
  staticDir,
  version,
  commit,
  openBrowser,
});

// biome-ignore lint/suspicious/noConsole: CLI output
console.log(`Klovi server listening on ${server.url}`);
