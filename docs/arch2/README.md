# Arch2

## Purpose

This directory contains the implementation-ready documentation for the Klovi architecture split into four apps:

- `apps/server` (`@cookielab.io/klovi-server`) — pure internal backend API
- `apps/web` — shared application UI
- `apps/package` (`@cookielab.io/klovi`) — published NPM package (CLI + HTTP composition)
- `apps/desktop` — Electrobun desktop shell

All plans (01-30) are complete. The documents here are written for AI implementers and serve as historical reference for the architecture decisions and execution sequence.

## Ground Rules

- Keep Electrobun for the desktop app.
- Keep Bun as the runtime and toolchain.
- Do not add caching.
- Do not consolidate or replace the existing packages under `packages/`.
- Do not introduce new packages under `packages/` for this initiative.
- Run `bun run check`, `bun run typecheck`, and `bun test` after every task.

## Primary Documents

- [VISION.md](./VISION.md): architecture vision and target state (canonical reference for plan generation)
- [initiative.md](./initiative.md): comprehensive initiative spec and architecture source of truth
- [plans/01-create-apps-web-scaffold.md](./plans/01-create-apps-web-scaffold.md)
- [plans/02-move-shared-app-shell-into-apps-web.md](./plans/02-move-shared-app-shell-into-apps-web.md)
- [plans/03-introduce-client-and-host-bridge-abstractions.md](./plans/03-introduce-client-and-host-bridge-abstractions.md)
- [plans/04-extract-server-application-services.md](./plans/04-extract-server-application-services.md)
- [plans/05-add-http-rpc-surface.md](./plans/05-add-http-rpc-surface.md)
- [plans/06-serve-built-web-assets-from-server.md](./plans/06-serve-built-web-assets-from-server.md)
- [plans/07-publish-apps-server-as-@cookielab.io-klovi.md](./plans/07-publish-apps-server-as-@cookielab.io-klovi.md)
- [plans/08-reduce-desktop-rpc-to-native-host-bridge.md](./plans/08-reduce-desktop-rpc-to-native-host-bridge.md)
- [plans/09-start-embedded-server-from-electrobun.md](./plans/09-start-embedded-server-from-electrobun.md)
- [plans/10-add-web-mode-capability-gating.md](./plans/10-add-web-mode-capability-gating.md)
- [plans/11-add-three-app-dev-build-workflows.md](./plans/11-add-three-app-dev-build-workflows.md)
- [plans/12-expand-test-and-smoke-coverage.md](./plans/12-expand-test-and-smoke-coverage.md)

## Package Restructuring Plans

- [plans/20-extract-rpc-router-from-http-app.md](./plans/20-extract-rpc-router-from-http-app.md)
  Purpose: split `makeHttpApp()` so the RPC router is independently importable by `apps/package`.
- [plans/21-create-apps-package.md](./plans/21-create-apps-package.md)
  Purpose: create `apps/package` as the published `@cookielab.io/klovi` NPM package that wires server + web together.
- [plans/22-transfer-package-identity.md](./plans/22-transfer-package-identity.md)
  Purpose: transfer the `@cookielab.io/klovi` name from `apps/server` to `apps/package`, rename server to `@cookielab.io/klovi-server`.
- [plans/23-strip-server-to-pure-backend.md](./plans/23-strip-server-to-pure-backend.md)
  Purpose: remove static serving, CLI, and web dependency from `apps/server` to make it a pure internal backend.

## Follow-up Remediation Plans

- [plans/13-refresh-server-registry-after-plugin-setting-changes.md](./plans/13-refresh-server-registry-after-plugin-setting-changes.md)
  Purpose: fix the post-Arch2 regression where browser/server mode keeps using a stale plugin registry after `updatePluginSetting(...)` writes new settings.
- [plans/14-introduce-effect-based-plugin-contracts.md](./plans/14-introduce-effect-based-plugin-contracts.md)
  Purpose: move the shared plugin contract onto Effect and make runtime dependencies explicit instead of relying on Bun globals and mutable module config.
- [plans/15-replace-mutable-plugin-singletons-with-effect-layers.md](./plans/15-replace-mutable-plugin-singletons-with-effect-layers.md)
  Purpose: rebuild the built-in plugin catalog and registry flow around fresh plugin factories/layers so registry refresh and runtime selection are explicit.
- [plans/16-migrate-claude-code-and-codex-plugins-to-effect-platform.md](./plans/16-migrate-claude-code-and-codex-plugins-to-effect-platform.md)
  Purpose: migrate the file-backed Claude Code and Codex plugins to `@effect/platform` services.
- [plans/17-migrate-opencode-plugin-to-effect-sqlite-adapter.md](./plans/17-migrate-opencode-plugin-to-effect-sqlite-adapter.md)
  Purpose: isolate OpenCode SQLite access behind Effect services so the plugin can run under Bun and Node.
- [plans/18-add-node-and-bun-plugin-runtime-coverage.md](./plans/18-add-node-and-bun-plugin-runtime-coverage.md)
  Purpose: add targeted dual-runtime coverage so the plugin migration is verified under Bun and Node.
- [plans/19-migrate-server-to-effect-platform.md](./plans/19-migrate-server-to-effect-platform.md)
  Purpose: move `apps/server` onto `@effect/platform` so the shared server can run on Bun and Node with thin runtime-specific adapters.

## Recommended Follow-up Order

1. [13-refresh-server-registry-after-plugin-setting-changes.md](./plans/13-refresh-server-registry-after-plugin-setting-changes.md)
2. [14-introduce-effect-based-plugin-contracts.md](./plans/14-introduce-effect-based-plugin-contracts.md)
3. [15-replace-mutable-plugin-singletons-with-effect-layers.md](./plans/15-replace-mutable-plugin-singletons-with-effect-layers.md)
4. [16-migrate-claude-code-and-codex-plugins-to-effect-platform.md](./plans/16-migrate-claude-code-and-codex-plugins-to-effect-platform.md)
5. [17-migrate-opencode-plugin-to-effect-sqlite-adapter.md](./plans/17-migrate-opencode-plugin-to-effect-sqlite-adapter.md)
6. [18-add-node-and-bun-plugin-runtime-coverage.md](./plans/18-add-node-and-bun-plugin-runtime-coverage.md)
7. [19-migrate-server-to-effect-platform.md](./plans/19-migrate-server-to-effect-platform.md)

## Recommended Execution Order

1. [01-create-apps-web-scaffold.md](./plans/01-create-apps-web-scaffold.md)
2. [02-move-shared-app-shell-into-apps-web.md](./plans/02-move-shared-app-shell-into-apps-web.md)
3. [03-introduce-client-and-host-bridge-abstractions.md](./plans/03-introduce-client-and-host-bridge-abstractions.md)
4. [04-extract-server-application-services.md](./plans/04-extract-server-application-services.md)
5. [05-add-http-rpc-surface.md](./plans/05-add-http-rpc-surface.md)
6. [06-serve-built-web-assets-from-server.md](./plans/06-serve-built-web-assets-from-server.md)
7. [07-publish-apps-server-as-@cookielab.io-klovi.md](./plans/07-publish-apps-server-as-@cookielab.io-klovi.md)
8. [08-reduce-desktop-rpc-to-native-host-bridge.md](./plans/08-reduce-desktop-rpc-to-native-host-bridge.md)
9. [09-start-embedded-server-from-electrobun.md](./plans/09-start-embedded-server-from-electrobun.md)
10. [10-add-web-mode-capability-gating.md](./plans/10-add-web-mode-capability-gating.md)
11. [11-add-three-app-dev-build-workflows.md](./plans/11-add-three-app-dev-build-workflows.md)
12. [12-expand-test-and-smoke-coverage.md](./plans/12-expand-test-and-smoke-coverage.md)

## Dependency Graph

- Task 01 has no prerequisites.
- Task 02 depends on Task 01.
- Task 03 depends on Task 02.
- Task 04 depends on Task 01.
- Task 05 depends on Task 04.
- Task 06 depends on Tasks 01 and 05.
- Task 07 depends on Task 06.
- Task 08 depends on Tasks 03 and 05.
- Task 09 depends on Tasks 07 and 08.
- Task 10 depends on Tasks 03 and 08.
- Task 11 depends on Tasks 07 and 09.
- Task 12 depends on Tasks 05, 09, 10, and 11.

## Package Restructuring Execution Order

1. [20-extract-rpc-router-from-http-app.md](./plans/20-extract-rpc-router-from-http-app.md)
2. [21-create-apps-package.md](./plans/21-create-apps-package.md)
3. [22-transfer-package-identity.md](./plans/22-transfer-package-identity.md)
4. [23-strip-server-to-pure-backend.md](./plans/23-strip-server-to-pure-backend.md)

### Package Restructuring Dependency Graph

- Task 20 has no prerequisites.
- Task 21 depends on Task 20.
- Task 22 depends on Task 21.
- Task 23 depends on Task 22.

## Finishing Plans

- [plans/24-build-and-publish-pipeline.md](./plans/24-build-and-publish-pipeline.md)
  Purpose: compile server + package to JS, set up proper exports/bin, prepublish scripts for npm distribution.
- [plans/25-consolidate-rpc-dispatch-into-effect-layer.md](./plans/25-consolidate-rpc-dispatch-into-effect-layer.md)
  Purpose: remove legacy `rpc.ts` dispatch table, dispatch directly from Effect layer to `KloviServices`.
- [plans/26-clean-up-dead-contract-fields.md](./plans/26-clean-up-dead-contract-fields.md)
  Purpose: wire or remove inert `mode` in `startKloviServer()` and `initialUrl` in `mountKloviApp()`.
- [plans/27-desktop-dependency-cleanup.md](./plans/27-desktop-dependency-cleanup.md)
  Purpose: audit and reduce direct `packages/*` deps in `apps/desktop`, re-export through `apps/web`.
- [plans/28-desktop-integration-verification.md](./plans/28-desktop-integration-verification.md)
  Purpose: verify desktop app works after restructuring, fix issues found.
- [plans/29-npm-end-to-end-verification.md](./plans/29-npm-end-to-end-verification.md)
  Purpose: verify `npx` and `bunx` flows work end-to-end, fix issues found.
- [plans/30-update-vision-document.md](./plans/30-update-vision-document.md)
  Purpose: update VISION.md to reflect completed state.

### Finishing Plans Execution Order

1. Plans 13, 24, 25, 26, 27 can run in parallel (no inter-dependencies)
2. [28-desktop-integration-verification.md](./plans/28-desktop-integration-verification.md) — depends on 13, 24, 25, 26, 27
3. [29-npm-end-to-end-verification.md](./plans/29-npm-end-to-end-verification.md) — depends on 13, 24, 25, 26
4. [30-update-vision-document.md](./plans/30-update-vision-document.md) — depends on 28, 29

### Finishing Plans Dependency Graph

- Task 13 has no prerequisites (already written, not executed).
- Task 24 has no prerequisites.
- Task 25 has no prerequisites.
- Task 26 has no prerequisites.
- Task 27 has no prerequisites.
- Task 28 depends on Tasks 13, 24, 25, 26, 27.
- Task 29 depends on Tasks 13, 24, 25, 26.
- Task 30 depends on Tasks 28, 29.

## Expected End State

When all tasks (01-12) are complete (achieved):

- `apps/web` owns the shared application shell through `mountKloviApp(config)`
- `apps/desktop` remains the Electrobun wrapper and native host bridge
- existing `packages/*` continue to provide plugin, design system, and reusable UI responsibilities
- browser mode and desktop mode share the same core UI while desktop-only features are gated off in browser mode

After applying package restructuring plans (20-23):

- `apps/package` is the published `@cookielab.io/klovi` package with the `klovi` CLI
- `apps/server` is `@cookielab.io/klovi-server`, a pure internal backend with no static serving or web dependency
- `apps/package` owns HTTP composition (`/api/*` → server, `/*` → web assets)
- `apps/desktop` depends on `apps/server` + `apps/web` directly
- `bunx @cookielab.io/klovi@latest` starts a localhost-only browser variant by default

After applying follow-up remediation plans:

- plugin enable/disable and data-dir changes take effect immediately in server/browser mode without requiring restart
- the plugin layer can express runtime dependencies through Effect instead of Bun globals
- built-in plugin registry rebuilds use fresh plugin instances rather than mutating shared singletons
- Claude Code, Codex, and OpenCode plugin execution paths are structured to support both Bun and Node runtimes
- the repository has explicit Bun-plus-Node coverage for the migrated plugin layer
- `apps/server` runs through `@effect/platform` and is startable from Bun and Node without changing its public embedding contract

After applying finishing plans (13, 24-30):

- `npx @cookielab.io/klovi` and `bunx @cookielab.io/klovi` both work end-to-end
- all packages have proper build pipelines producing JS from TypeScript source
- the legacy `rpc.ts` dispatch table is removed; RPC dispatches directly through the Effect layer
- all public contract fields are either wired or removed (no dead fields)
- `apps/desktop` depends only on `apps/server` and `apps/web` (with documented exceptions)
- desktop app builds, launches, and functions correctly after restructuring
- VISION.md reflects the completed architecture
