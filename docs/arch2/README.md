# Arch2

## Purpose

This directory contains the implementation-ready documentation for splitting Klovi into:

- `apps/server` for the published CLI and browser-served application
- `apps/web` for the shared application UI
- `apps/desktop` for the Electrobun desktop shell

The documents here are written for AI implementers. They are intentionally specific about boundaries, file ownership, naming, sequencing, and verification.

## Ground Rules

- Keep Electrobun for the desktop app.
- Keep Bun as the runtime and toolchain.
- Do not add caching.
- Do not consolidate or replace the existing packages under `packages/`.
- Do not introduce new packages under `packages/` for this initiative.
- Run `bun run check`, `bun run typecheck`, and `bun test` after every task.

## Primary Documents

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

## Expected End State

When all tasks are complete:

- `apps/server` is the published `@cookielab.io/klovi` package with a `klovi` CLI
- `apps/web` owns the shared application shell through `mountKloviApp(config)`
- `apps/desktop` remains the Electrobun wrapper and native host bridge
- existing `packages/*` continue to provide plugin, design system, and reusable UI responsibilities
- `bunx @cookielab.io/klovi@latest` starts a localhost-only browser variant by default
- browser mode and desktop mode share the same core UI while desktop-only features are gated off in browser mode
