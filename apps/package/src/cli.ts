import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { resolveCliConfig } from "./cli-config.ts";
import { startKloviPackageServer } from "./server.ts";

const __dir = import.meta.dirname;

// Both src/ and dist/ are direct children of apps/package/
const pkgPath = resolve(__dir, "../package.json");
const pkg = JSON.parse(await readFile(pkgPath, "utf-8")) as Record<string, string>;
const version = pkg["version"] ?? "0.0.0";
const commit = pkg["commit"] ?? "";
const config = resolveCliConfig(__dir);

await startKloviPackageServer({
	host: config.host,
	port: config.port,
	staticDir: config.staticDir,
	version: version,
	commit: commit,
	openBrowser: config.openBrowser,
	...(config.settingsPath ? { settingsPath: config.settingsPath } : {}),
});
