/**
 * Stage a sanitized npm publish artifact for @cookielab.io/klovi.
 *
 * Reads the workspace apps/package/package.json, strips workspace-only fields,
 * copies runtime files (dist/, README.md, LICENSE.md) into apps/package/.stage/npm/,
 * and writes a clean package.json suitable for npm publish.
 *
 * Usage:
 *   bun apps/package/scripts/stage-npm.ts [--version X.Y.Z] [--commit SHA]
 */

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const packageDir = resolve(import.meta.dirname, "..");
const repoRoot = resolve(packageDir, "../..");
const stageDir = resolve(packageDir, ".stage/npm");
const distDir = resolve(packageDir, "dist");

// Parse CLI args
function parseArgs(): { version: string | undefined; commit: string | undefined } {
	const args = process.argv.slice(2);
	const result: { version: string | undefined; commit: string | undefined } = {
		version: undefined,
		commit: undefined,
	};
	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--version" && args[i + 1]) {
			result.version = args[i + 1];
			i += 1;
		}
		if (args[i] === "--commit" && args[i + 1]) {
			result.commit = args[i + 1];
			i += 1;
		}
	}
	return result;
}

const cliArgs = parseArgs();

// Validate that dist/ exists (build must run first)
if (!existsSync(distDir)) {
	console.error("Error: dist/ does not exist. Run the build first.");
	process.exit(1);
}

if (!existsSync(resolve(distDir, "cli.js"))) {
	console.error("Error: dist/cli.js does not exist. Run the build first.");
	process.exit(1);
}

if (!existsSync(resolve(distDir, "server.js"))) {
	console.error("Error: dist/server.js does not exist. Run the build first.");
	process.exit(1);
}

if (!existsSync(resolve(distDir, "web"))) {
	console.error("Error: dist/web/ does not exist. Run the build first.");
	process.exit(1);
}

// Clean and recreate stage directory
rmSync(stageDir, { recursive: true, force: true });
mkdirSync(stageDir, { recursive: true });

// Read source package.json
const srcPkg = JSON.parse(readFileSync(resolve(packageDir, "package.json"), "utf-8"));

// Build sanitized package.json
const version = cliArgs.version ?? srcPkg.version ?? "0.0.0";

const commit = cliArgs.commit ?? "";

const stagedPkg: Record<string, unknown> = {
	name: "@cookielab.io/klovi",
	version: version,
	description: srcPkg.description ?? "Browse and present AI coding session history",
	type: "module",
	license: srcPkg.license ?? "MIT",
	bin: {
		klovi: "./dist/cli.js",
	},
	exports: {
		"./server": "./dist/server.js",
	},
	files: ["dist", "package.json", "README.md", "LICENSE.md"],
	engines: srcPkg.engines ?? { node: ">=18" },
};

// Stamp commit metadata into the staged manifest so the runtime can read it
if (commit) {
	stagedPkg["commit"] = commit;
}

// Copy optional metadata fields if present in source
for (const field of ["author", "repository", "homepage", "bugs", "keywords"]) {
	if (srcPkg[field] !== undefined) {
		stagedPkg[field] = srcPkg[field];
	}
}

// Include only non-workspace external dependencies
const deps: Record<string, string> = {};
if (srcPkg.dependencies) {
	for (const [name, ver] of Object.entries(srcPkg.dependencies as Record<string, string>)) {
		// Skip workspace dependencies (internal packages)
		if (ver === "workspace:*" || ver.startsWith("workspace:")) {
			continue;
		}
		// Skip internal @cookielab.io packages
		if (name.startsWith("@cookielab.io/klovi-")) {
			continue;
		}
		deps[name] = ver;
	}
}
if (Object.keys(deps).length > 0) {
	stagedPkg["dependencies"] = deps;
}

// Write staged package.json
writeFileSync(resolve(stageDir, "package.json"), `${JSON.stringify(stagedPkg, null, 2)}\n`);

// Copy dist/
cpSync(distDir, resolve(stageDir, "dist"), { recursive: true });

// Copy README.md from repo root (single source of truth for npm package README)
const readmeSrc = existsSync(resolve(packageDir, "README.md"))
	? resolve(packageDir, "README.md")
	: resolve(repoRoot, "README.md");
if (existsSync(readmeSrc)) {
	cpSync(readmeSrc, resolve(stageDir, "README.md"));
}

// Copy LICENSE.md from repo root
const licenseSrc = resolve(repoRoot, "LICENSE.md");
if (existsSync(licenseSrc)) {
	cpSync(licenseSrc, resolve(stageDir, "LICENSE.md"));
}

// Verify no workspace imports remain in built files
const cliContent = readFileSync(resolve(stageDir, "dist/cli.js"), "utf-8");
const serverContent = readFileSync(resolve(stageDir, "dist/server.js"), "utf-8");

const workspaceImportPattern = /@cookielab\.io\/klovi-/u;
const hasWorkspaceImports = workspaceImportPattern.test(cliContent) || workspaceImportPattern.test(serverContent);

if (hasWorkspaceImports) {
	console.error("Error: Built files still contain references to internal workspace packages (@cookielab.io/klovi-*).");
	console.error("The bundle must be self-contained. Check build externals configuration.");
	process.exit(1);
}

console.log("Staged npm artifact at:", stageDir);
console.log("  package.json version:", version);
console.log("  package.json commit:", commit || "(none)");
console.log("  dist/cli.js:", existsSync(resolve(stageDir, "dist/cli.js")) ? "OK" : "MISSING");
console.log("  dist/server.js:", existsSync(resolve(stageDir, "dist/server.js")) ? "OK" : "MISSING");
console.log("  dist/web/:", existsSync(resolve(stageDir, "dist/web")) ? "OK" : "MISSING");
console.log("  README.md:", existsSync(resolve(stageDir, "README.md")) ? "OK" : "MISSING");
console.log("  LICENSE.md:", existsSync(resolve(stageDir, "LICENSE.md")) ? "OK" : "MISSING");
