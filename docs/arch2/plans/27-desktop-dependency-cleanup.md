# Desktop Dependency Cleanup

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Audit and reduce `apps/desktop`'s direct dependencies on `packages/*`, re-exporting through `apps/web` where possible, so the desktop dependency graph aligns with VISION.md's intent.

**Architecture:** VISION.md says `apps/desktop` depends on `apps/server` and `apps/web`. Currently `apps/desktop/package.json` also lists direct deps on `klovi-design-system`, `klovi-ui`, `klovi-plugin-core`, and all three plugin packages. The webview entry (`src/views/main/index.ts`) directly imports `@cookielab.io/klovi-design-system/globals`. These should flow through `apps/web` where possible.

**Tech Stack:** TypeScript, Electrobun

**Depends on:** None (can run in parallel with other plans)

---

## In scope

- Audit which `packages/*` dependencies in `apps/desktop` are directly imported vs transitively needed
- Re-export from `apps/web` where appropriate (e.g., design system globals)
- Remove direct `packages/*` deps from `apps/desktop/package.json` when they are no longer directly imported
- Document any exceptions that genuinely need to stay (e.g., Electrobun bundler requirements)

## Out of scope

- Changing Electrobun's build system
- Moving code between packages
- Changing the desktop's RPC type schema

## Implementation steps

1. **Audit direct imports.** Search `apps/desktop/src/` for all imports from `@cookielab.io/klovi-*` packages (excluding `klovi-server` and `klovi-web`). Categorize each as:
   - Directly imported in source code
   - Only needed as transitive dependency for bundler resolution

2. **Re-export design system globals from `apps/web`.** The webview entry imports `@cookielab.io/klovi-design-system/globals` and `@cookielab.io/klovi-web/app/App.css`. Add an export from `apps/web` that includes the design system globals so the desktop only needs to import from `@cookielab.io/klovi-web`.

3. **Remove unnecessary direct deps.** For any `packages/*` dep that is not directly imported after step 2, remove it from `apps/desktop/package.json`.

4. **Test Electrobun build.** Run `bun run build` in `apps/desktop` to verify the bundler can still resolve all imports through the remaining dependency chain.

5. **Document exceptions.** If any direct `packages/*` dep must remain (e.g., because Electrobun's bundler cannot resolve transitive workspace deps), add a comment in `apps/desktop/package.json` explaining why.

## Acceptance criteria

- `apps/desktop` imports from `packages/*` are minimized — ideally only through `apps/server` and `apps/web`
- Any remaining direct `packages/*` deps are documented with rationale
- Electrobun build succeeds
- `bun run check`, `bun run typecheck`, `bun test` all pass

## Verification

- `bun run check`
- `bun run typecheck`
- `bun test`
- `bun run build` in `apps/desktop`
