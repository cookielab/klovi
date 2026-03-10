#!/usr/bin/env bun

/**
 * Vendored Electrobun CLI shim for Klovi desktop builds.
 *
 * The published Electrobun npm package ships `src/cli/index.ts` but omits
 * the `src/shared/` and `src/cli/templates/` directories it imports from.
 * This shim bridges the gap by creating symlinks and stubs for the missing
 * modules, then delegates to the real (patched) CLI.
 *
 * All patched behavior (arbitrary --env values, includeReleaseChannelInName,
 * process.execPath fixes) is preserved because the actual CLI source is the
 * patched version from the bun patch system.
 */

import { existsSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const electrobunRoot = resolve(import.meta.dir, "../../node_modules/electrobun");
const srcDir = join(electrobunRoot, "src");
const srcShared = join(srcDir, "shared");
const distShared = join(electrobunRoot, "dist", "api", "shared");

// Bridge src/shared/ → dist/api/shared/ so the CLI can resolve its imports.
// The published package ships these modules at dist/api/shared/ but the CLI
// expects them at ../shared/ relative to src/cli/.
if (!existsSync(srcShared)) {
  symlinkSync(distShared, srcShared);
}

// Stub the templates module (only used by the `init` command, not by build/dev).
const templatesDir = join(srcDir, "cli", "templates");
const embeddedPath = join(templatesDir, "embedded.ts");
if (!existsSync(embeddedPath)) {
  mkdirSync(templatesDir, { recursive: true });
  writeFileSync(
    embeddedPath,
    [
      "// Stub — templates are only needed by `electrobun init`, not by build/dev.",
      "export function getTemplate(): null { return null; }",
      "export function getTemplateNames(): string[] { return []; }",
      "",
    ].join("\n"),
  );
}

// Delegate to the patched CLI. The dynamic import preserves process.argv so
// the CLI's own argument parsing (which looks for "electrobun" in argv) works
// because this file's path contains "electrobun-cli".
await import(join(electrobunRoot, "src", "cli", "index.ts"));
