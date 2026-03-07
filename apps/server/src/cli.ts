#!/usr/bin/env bun
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { startKloviServer } from "./server.ts";

const pkgPath = resolve(import.meta.dir, "../package.json");
const pkg = JSON.parse(await readFile(pkgPath, "utf-8")) as Record<string, string>;
const version = pkg["version"] ?? "0.0.0";
const commit = pkg["commit"] ?? "";

const host = process.env["KLOVI_HOST"] ?? "127.0.0.1";
const port = Number(process.env["KLOVI_PORT"] ?? "3131");
const staticDir =
  process.env["KLOVI_STATIC_DIR"] ??
  resolve(import.meta.dir, "../node_modules/@cookielab.io/klovi-web/dist");

const server = await startKloviServer({
  host,
  port,
  mode: "standalone",
  staticDir,
  version,
  commit,
});

// biome-ignore lint/suspicious/noConsole: CLI output
console.log(`Klovi server listening on ${server.url}`);
