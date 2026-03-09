# Arch2

## Purpose

This directory records the Arch2 workspace split and the sequence of work that
landed it.

Arch2 is implemented. The current source layout is:

- `apps/package` (`@cookielab.io/klovi`) for the npm/browser distribution
- `apps/desktop` (`@cookielab.io/klovi-desktop`) for the Electrobun desktop app
- `packages/server` (`@cookielab.io/klovi-server`) for the internal backend
- `packages/ui` (`@cookielab.io/klovi-ui`) for the shared React app shell

The local verification baseline for the completed state is:

- `bun run check`
- `bun run typecheck`
- `bun test`
- `bun run test:node-smoke`
- `bun run stage:npm`
- `bun run verify:packed-artifact`

## Authority Model

- [VISION.md](./VISION.md) is the canonical Arch2 architecture reference.
- [initiative.md](./initiative.md) is preserved as historical starting-state context.
- `plans/**` are historical execution records and follow-up remediation notes.

If a historical document disagrees with the current code, treat `VISION.md` and
the source tree as authoritative.

## Current State

- `packages/server` is a pure backend package with Effect-based services and
  `startKloviServer(options)`.
- `packages/ui` owns the shared application shell through `mountKloviApp(config)`.
- `apps/package` owns CLI startup, HTTP composition, static asset serving, staged
  npm artifact generation, and the public `@cookielab.io/klovi/server` export.
- `apps/desktop` owns the Electrobun window lifecycle, updater, menu integration,
  and desktop-native host bridge.
- Desktop depends directly on `packages/server` and `packages/ui`; it no longer
  carries a direct dependency on `@cookielab.io/klovi-ui-components`.
- Publish verification covers packed-artifact installation and runtime behavior
  under both Node and Bun.

## Historical Documents

- [initiative.md](./initiative.md)
  Pre-implementation initiative brief. Useful for original goals and constraints,
  but not for the current repository layout.
- [plans/](./plans/)
  Execution history for plans 01-38. These files intentionally preserve the
  order and context in which the work was carried out.

## Ground Rules

- Keep Electrobun as the desktop runtime.
- Keep Bun as the default toolchain.
- Do not add caching.
- Preserve the existing `packages/*` boundaries.
- After changes, run `bun run check`, `bun run typecheck`, and `bun test`.
