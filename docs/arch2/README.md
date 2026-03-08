# Arch2

## Purpose

This directory contains the implementation-ready documentation for the Klovi architecture split into four apps:

- `packages/server` (`@cookielab.io/klovi-server`) — pure internal backend API
- `packages/ui` — shared application UI
- `apps/package` (`@cookielab.io/klovi`) — npm distribution entrypoint (CLI + HTTP composition)
- `apps/desktop` — Electrobun desktop shell

Core Arch2 source architecture is implemented. The remaining open work is the single-package npm publish remediation for `@cookielab.io/klovi`.

Plans `01-30` remain in this directory as the historical record of the original Arch2 execution sequence and follow-up remediation. They are not the final source of truth for the remaining npm publish work.

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
  Purpose: create `apps/package` as the `@cookielab.io/klovi` npm distribution entrypoint that wires server + web together.
- [plans/22-transfer-package-identity.md](./plans/22-transfer-package-identity.md)
  Purpose: transfer the `@cookielab.io/klovi` name from `packages/server` to `apps/package`, rename server to `@cookielab.io/klovi-server`.
- [plans/23-strip-server-to-pure-backend.md](./plans/23-strip-server-to-pure-backend.md)
  Purpose: remove static serving, CLI, and web dependency from `packages/server` to make it a pure internal backend.

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
  Purpose: move `packages/server` onto `@effect/platform` so the shared server can run on Bun and Node with thin runtime-specific adapters.

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

## Historical Finishing Plans

These plans remain useful historical context, but they should not be treated as the final source of truth for the remaining npm publish work:

- [plans/24-build-and-publish-pipeline.md](./plans/24-build-and-publish-pipeline.md)
  Purpose: first attempt to compile server + package to JS and set up npm-oriented build output.
- [plans/25-consolidate-rpc-dispatch-into-effect-layer.md](./plans/25-consolidate-rpc-dispatch-into-effect-layer.md)
  Purpose: remove legacy `rpc.ts` dispatch table, dispatch directly from Effect layer to `KloviServices`.
- [plans/26-clean-up-dead-contract-fields.md](./plans/26-clean-up-dead-contract-fields.md)
  Purpose: wire or remove inert `mode` in `startKloviServer()` and `initialUrl` in `mountKloviApp()`.
- [plans/27-desktop-dependency-cleanup.md](./plans/27-desktop-dependency-cleanup.md)
  Purpose: audit and reduce direct `packages/*` deps in `apps/desktop`, re-export through `packages/ui`.
- [plans/28-desktop-integration-verification.md](./plans/28-desktop-integration-verification.md)
  Purpose: verify desktop app works after restructuring, fix issues found.
- [plans/29-npm-end-to-end-verification.md](./plans/29-npm-end-to-end-verification.md)
  Purpose: prior attempt to verify `npx` and `bunx` flows from workspace builds rather than the final staged publish artifact.
- [plans/30-update-vision-document.md](./plans/30-update-vision-document.md)
  Purpose: prior attempt to declare the architecture complete before the single-package npm publish path was fully specified.

## Remaining Publish Remediation Plans

- [plans/31-make-apps-package-self-contained-for-npm.md](./plans/31-make-apps-package-self-contained-for-npm.md)
  Purpose: make `apps/package` the sole publishable npm artifact by bundling internal workspace runtime code and including web assets.
- [plans/32-generate-a-sanitized-publish-artifact.md](./plans/32-generate-a-sanitized-publish-artifact.md)
  Purpose: define the staged publish directory and sanitized npm manifest generation flow.
- [plans/33-verify-packed-artifact-under-node-and-bun.md](./plans/33-verify-packed-artifact-under-node-and-bun.md)
  Purpose: verify the real packed artifact under Node and Bun instead of only the workspace build.
- [plans/34-restore-single-package-npm-publish-workflow.md](./plans/34-restore-single-package-npm-publish-workflow.md)
  Purpose: restore npm publishing for `@cookielab.io/klovi` only.

### Remaining Publish Remediation Order

1. [31-make-apps-package-self-contained-for-npm.md](./plans/31-make-apps-package-self-contained-for-npm.md)
2. [32-generate-a-sanitized-publish-artifact.md](./plans/32-generate-a-sanitized-publish-artifact.md)
3. [33-verify-packed-artifact-under-node-and-bun.md](./plans/33-verify-packed-artifact-under-node-and-bun.md)
4. [34-restore-single-package-npm-publish-workflow.md](./plans/34-restore-single-package-npm-publish-workflow.md)

### Remaining Publish Remediation Dependency Graph

- Task 31 has no prerequisites.
- Task 32 depends on Task 31.
- Task 33 depends on Tasks 31 and 32.
- Task 34 depends on Tasks 32 and 33.

## Follow-up Alignment Plans

These follow-up plans refine the public npm contract, staging metadata, release wiring, and documentation after the core publish remediation plans:

- [plans/35-align-public-server-export-with-vision.md](./plans/35-align-public-server-export-with-vision.md)
  Purpose: align `@cookielab.io/klovi/server` with the documented `startKloviServer(options)` contract and remove duplicated server bootstrap logic.
- [plans/36-finish-package-artifact-metadata-and-publish-guardrails.md](./plans/36-finish-package-artifact-metadata-and-publish-guardrails.md)
  Purpose: finish staged artifact version/commit metadata flow and block accidental publishing from `apps/package` source.
- [plans/37-wire-release-flow-to-single-package-npm-publish.md](./plans/37-wire-release-flow-to-single-package-npm-publish.md)
  Purpose: connect the release flow to the dedicated npm publish workflow without manual version re-entry.
- [plans/38-document-npm-package-contract-and-refresh-arch2-status.md](./plans/38-document-npm-package-contract-and-refresh-arch2-status.md)
  Purpose: add npm-facing package docs and refresh Arch2 status documents after the contract/publish alignment work lands.

### Follow-up Alignment Order

1. [35-align-public-server-export-with-vision.md](./plans/35-align-public-server-export-with-vision.md)
2. [36-finish-package-artifact-metadata-and-publish-guardrails.md](./plans/36-finish-package-artifact-metadata-and-publish-guardrails.md)
3. [37-wire-release-flow-to-single-package-npm-publish.md](./plans/37-wire-release-flow-to-single-package-npm-publish.md)
4. [38-document-npm-package-contract-and-refresh-arch2-status.md](./plans/38-document-npm-package-contract-and-refresh-arch2-status.md)

### Follow-up Alignment Dependency Graph

- Task 35 has no prerequisites.
- Task 36 depends on Task 35.
- Task 37 depends on Tasks 35 and 36.
- Task 38 depends on Tasks 35, 36, and 37.

## Expected End State

When all tasks (01-12) are complete (achieved):

- `packages/ui` owns the shared application shell through `mountKloviApp(config)`
- `apps/desktop` remains the Electrobun wrapper and native host bridge
- existing `packages/*` continue to provide plugin, design system, and reusable UI responsibilities
- browser mode and desktop mode share the same core UI while desktop-only features are gated off in browser mode

After applying package restructuring plans (20-23):

- `apps/package` is the `@cookielab.io/klovi` npm entrypoint with the `klovi` CLI
- `packages/server` is `@cookielab.io/klovi-server`, a pure internal backend with no static serving or web dependency
- `apps/package` owns HTTP composition (`/api/*` → server, `/*` → web assets)
- `apps/desktop` depends on `packages/server` + `packages/ui` directly

After applying follow-up remediation plans (13-19):

- plugin enable/disable and data-dir changes take effect immediately in server/browser mode without requiring restart
- the plugin layer can express runtime dependencies through Effect instead of Bun globals
- built-in plugin registry rebuilds use fresh plugin instances rather than mutating shared singletons
- Claude Code, Codex, and OpenCode plugin execution paths are structured to support both Bun and Node runtimes
- the repository has explicit Bun-plus-Node coverage for the migrated plugin layer
- `packages/server` runs through `@effect/platform` and is startable from Bun and Node without changing its public embedding contract

After applying the remaining publish remediation plans (31-34):

- only `@cookielab.io/klovi` is published to npm
- internal workspace packages are bundled into the staged publish artifact rather than published separately
- the staged artifact contains a sanitized npm manifest with no `workspace:*` dependencies
- packed-artifact verification proves `npx @cookielab.io/klovi` and `bunx @cookielab.io/klovi`
- `@cookielab.io/klovi/server` remains a working public programmatic export
- release automation publishes the same staged tarball that was verified in CI
