#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { startKloviServer } from "./server.ts";

const __dir = import.meta.dirname;
const pkgPath = resolve(__dir, "../package.json");
const pkg = JSON.parse(await readFile(pkgPath, "utf-8")) as Record<string, string>;
const version = pkg["version"] ?? "0.0.0";
const commit = pkg["commit"] ?? "";

const host = process.env["KLOVI_HOST"] ?? "127.0.0.1";
const port = Number(process.env["KLOVI_PORT"] ?? "3131");
const staticDir =
  process.env["KLOVI_STATIC_DIR"] ?? resolve(__dir, "../node_modules/@cookielab.io/klovi-web/dist");

const openBrowser = !process.argv.includes("--no-browser");

const server = await startKloviServer({
  host,
  port,
  mode: "standalone",
  staticDir,
  version,
  commit,
  openBrowser,
});

// biome-ignore lint/suspicious/noConsole: CLI output
console.log(`Klovi server listening on ${server.url}`);
