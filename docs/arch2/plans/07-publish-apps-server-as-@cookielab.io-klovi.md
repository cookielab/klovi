# 07 Publish `apps/server` As `@cookielab.io/klovi`

## Why this task exists

The browser-served variant must be distributable through `npx` and `bunx`. This task makes `apps/server` the publishable package and reserves `@cookielab.io/klovi` for the CLI/server artifact.

## Depends on

- [06-serve-built-web-assets-from-server.md](./06-serve-built-web-assets-from-server.md)

## In scope

- Make `apps/server` the publishable `@cookielab.io/klovi` package.
- Expose the `klovi` CLI.
- Ensure the published artifact includes server code and built web assets.

## Out of scope

- Desktop embedding.
- Root dev workflow orchestration.

## Files/directories to create or change

- `apps/server/package.json`
- `apps/server/src/cli.ts`
- `apps/server/src/server.ts`
- publish/build scripts under `apps/server/scripts/**` or root `scripts/**`
- `apps/desktop/package.json`

## Implementation steps

1. Rename the package metadata so `apps/server` owns `@cookielab.io/klovi`.
2. Add a `bin` entry exposing `klovi`.
3. Export `startKloviServer(options)` through a stable subpath such as `@cookielab.io/klovi/server`.
4. Ensure the publish artifact includes:
   - server runtime
   - CLI entry
   - built web assets
5. Update the desktop package metadata so it no longer conflicts with the published package name.
6. Verify the default CLI bind is localhost-only.

## Acceptance criteria

- `apps/server` is the publishable `@cookielab.io/klovi` package.
- The `klovi` bin exists.
- The package is structured so `npx @cookielab.io/klovi@latest` and `bunx @cookielab.io/klovi@latest` are viable.

## Verification

- `bun run check`
- `bun run typecheck`
- `bun test`
