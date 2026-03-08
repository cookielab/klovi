# Build And Publish Pipeline

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a build pipeline that compiles `apps/server`, `apps/web`, and `apps/package` from TypeScript source to distributable JavaScript, so `npx @cookielab.io/klovi` and `bunx @cookielab.io/klovi` both work when the package is published to npm.

**Architecture:** Currently all `exports` and `bin` entries in `apps/server` and `apps/package` point to raw `.ts` source files. Node cannot execute TypeScript, and the CLI shebang is `#!/usr/bin/env node`. The build pipeline must:

- Compile `apps/server` to JS with proper `exports` pointing to built output
- Compile `apps/package` to JS with proper `exports` and `bin` pointing to built output
- Handle dual-runtime CLI shebang (the CLI must work under both `npx` and `bunx`)
- Ensure `apps/web` dist is available as a dependency of `apps/package`
- Add prepublish/prepare scripts so publishing produces correct artifacts

**Tech Stack:** Bun bundler or tsc, depending on complexity

**Depends on:** Plans 20-23 (package restructuring, all complete)

---

## In scope

- Build scripts for `apps/server` and `apps/package` that produce JS output
- Proper `exports` maps pointing to built `.js` files for npm consumers
- CLI bin entry that works under both Node (`npx`) and Bun (`bunx`)
- `files` or `.npmignore` to control what gets published
- `prepare` or `prepublish` scripts
- Workspace-level `build` script that builds all three in the right order (web → server → package)
- Verify the built output can be imported/executed

## Out of scope

- CI/CD pipeline or GitHub Actions for automated publishing
- npm registry authentication or publish commands
- Versioning strategy (semver, changesets, etc.)
- Minification or tree-shaking optimization

## Files/directories to create or change

- `apps/server/package.json` — add build script, update exports to point to dist
- `apps/server/tsconfig.build.json` — build-specific tsconfig if needed
- `apps/package/package.json` — add build script, update exports/bin to point to dist
- `apps/package/tsconfig.build.json` — build-specific tsconfig if needed
- `apps/package/src/cli.ts` — fix shebang for dual-runtime support
- `apps/web/package.json` — ensure build script produces dist correctly
- `package.json` (root) — add workspace-level build script

## Implementation steps

1. **Decide build tool.** Options:
   - `tsc` with `--outDir dist` — simplest, preserves module structure, no bundling
   - `bun build --target=node` — single-file bundles, handles TypeScript natively
   Recommendation: `tsc` for server and package (library output, multiple entry points), Bun bundler for web (already in place).

2. **Add build config for `apps/server`.**
   - Create `tsconfig.build.json` extending the project tsconfig, with `outDir: "dist"`, `declaration: true`
   - Add `"build": "tsc -p tsconfig.build.json"` to scripts
   - Update `exports` to point to `"./dist/..."` paths
   - Add `"files": ["dist", "package.json"]` to control npm publish content

3. **Add build config for `apps/package`.**
   - Create `tsconfig.build.json` extending the project tsconfig, with `outDir: "dist"`
   - Add `"build": "tsc -p tsconfig.build.json"` to scripts
   - Update `bin` to point to `"./dist/cli.js"`
   - Update `exports` to point to `"./dist/..."` paths
   - Add `"files": ["dist", "package.json"]` to control npm publish content

4. **Fix CLI shebang for dual-runtime support.**
   The current `#!/usr/bin/env node` shebang means `bunx` will invoke Node. Options:
   - Use `#!/usr/bin/env node` and ensure the compiled JS works under Node (standard approach)
   - Bun's `bunx` will still use `node` as the interpreter due to the shebang — this is acceptable because the whole point of dual-runtime is that the code works under both
   - The `startKloviPackageServer` already auto-detects runtime via `globalThis.Bun`
   Verify: `bunx` with a `#!/usr/bin/env node` shebang — does it respect the shebang or use Bun? If it respects the shebang, the code must work under Node. If it uses Bun, the shebang is irrelevant for `bunx`.

5. **Update `apps/web` build integration.**
   - Ensure `apps/web` has `"build"` script that outputs to `dist/`
   - Update `apps/package` default `staticDir` resolution to work with both workspace and npm install layouts

6. **Add workspace-level build script.**
   - In root `package.json`, add `"build": "bun run --filter 'apps/web' build && bun run --filter 'apps/server' build && bun run --filter 'apps/package' build"`
   - Ordering: web first (package depends on its dist), then server (package depends on its types), then package

7. **Add `prepare` script for npm publish.**
   - In `apps/package/package.json`, add `"prepare": "bun run build"` or equivalent
   - Ensure workspace dependencies are resolved correctly during publish

8. **Verify built output.**
   - Run the workspace build
   - Verify `apps/package/dist/cli.js` exists and has correct shebang
   - Verify `node apps/package/dist/cli.js` starts the server
   - Verify imports from `@cookielab.io/klovi-server/server` resolve to `.js` files

## Acceptance criteria

- `bun run build` at workspace root compiles web, server, and package in order
- `apps/server/dist/` contains compiled JS with type declarations
- `apps/package/dist/` contains compiled JS with correct CLI shebang
- `node apps/package/dist/cli.js` starts the server and serves web assets
- `exports` in both `apps/server` and `apps/package` package.json point to dist files
- `apps/package/package.json` has `"files"` limiting published content to dist
- `bun run check`, `bun run typecheck`, `bun test` all pass

## Verification

- `bun run check`
- `bun run typecheck`
- `bun test`
- `bun run build` (workspace-level)
- `node apps/package/dist/cli.js --no-browser` starts successfully
