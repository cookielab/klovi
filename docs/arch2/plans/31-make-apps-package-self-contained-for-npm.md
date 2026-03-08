# 31 Make apps/package Self-Contained For npm

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make `apps/package` the sole publishable npm artifact by bundling internal workspace runtime code and including the web assets required to run `@cookielab.io/klovi` outside the monorepo.

**Architecture:** The source architecture remains split across `apps/package`, `packages/server`, `packages/ui`, and the internal plugin/UI packages. That split is preserved in the monorepo. The npm consumer, however, installs only `@cookielab.io/klovi`, so the publish artifact must be self-contained for internal workspace code. Runtime entrypoints in the staged package must not depend on unpublished workspace package names.

**Depends on:** None

---

## In scope

- Bundle internal workspace runtime code required by `apps/package`
- Bundle or copy web assets required by the browser-served variant
- Preserve the public CLI entrypoint `klovi`
- Preserve the public programmatic export `@cookielab.io/klovi/server`
- Keep internal package boundaries intact in source while removing them from the runtime publish dependency graph

## Out of scope

- Publishing any package other than `@cookielab.io/klovi`
- Refactoring internal package ownership or collapsing packages into `apps/package`
- Changing desktop release packaging
- Adding caches or cache-like staging shortcuts

## Files/directories to create or change

- `apps/package/package.json`
- `apps/package/src/cli.ts`
- `apps/package/src/server.ts`
- `apps/package/` build scripts and any helper scripts needed for bundling
- `packages/ui/` build integration only where necessary to produce publishable web assets
- Root `package.json` build orchestration if required

## Implementation steps

1. **Treat `apps/package` as the only npm-distributed module.**
   - Preserve `@cookielab.io/klovi` as the sole npm package.
   - Keep `packages/server`, `packages/ui`, `packages/plugin-*`, `packages/design-system`, and `packages/ui-components` internal-only.

2. **Define the runtime artifact shape.**
   - The publishable runtime must contain:
     - `dist/cli.js`
     - `dist/server.js`
     - `dist/web/**`
   - `dist/cli.js` and `dist/server.js` must be executable JavaScript for npm consumers.

3. **Bundle internal workspace runtime code into the published entrypoints.**
   - Bundle all internal workspace dependencies used by `apps/package` into the built runtime output.
   - Do not leave runtime imports such as `@cookielab.io/klovi-server`, `@cookielab.io/klovi-ui`, or any internal `@cookielab.io/klovi-*` workspace package name in the staged npm artifact.
   - Public external npm dependencies may remain external only if they are valid npm dependencies of `@cookielab.io/klovi` and are declared in the staged manifest.

4. **Include the web assets.**
   - Build `packages/ui` first.
   - Copy or embed the resulting web assets into `apps/package` runtime output under `dist/web/`.
   - Preserve SPA fallback behavior to `index.html`.

5. **Preserve public contracts.**
   - `klovi` remains the CLI entrypoint.
   - `@cookielab.io/klovi/server` remains a public export.
   - `startKloviServer(options)` remains the programmatic server contract surfaced by that export.

6. **Avoid architecture regression.**
   - Do not move server/ui/plugin source into `apps/package`.
   - Build-time bundling is the only allowed packaging convergence.

## Acceptance criteria

- Built publish artifact contains runnable CLI/server entrypoints and UI assets
- Runtime output does not depend on unpublished workspace package names
- No internal workspace package install is required at consumer runtime
- Only `@cookielab.io/klovi` is published to npm
- Source package boundaries remain intact in the monorepo

## Verification

- `bun run check`
- `bun run typecheck`
- `bun test`
- Build the npm runtime artifact and inspect it for remaining internal workspace imports
- Verify `dist/web/` exists in the runtime artifact
