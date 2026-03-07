# 06 Serve Built Web Assets From Server

## Why this task exists

The browser-served variant must ship a full UI, not just an API. This task makes `apps/server` serve the built `apps/web` bundle and support development wiring for the web app.

## Depends on

- [01-create-apps-web-scaffold.md](./01-create-apps-web-scaffold.md)
- [05-add-http-rpc-surface.md](./05-add-http-rpc-surface.md)

## In scope

- Build `apps/web` into a browser bundle.
- Serve that bundle from `apps/server`.
- Support a development asset path or development URL for local work.

## Out of scope

- Publishing the server package.
- Desktop embedding.

## Files/directories to create or change

- `apps/web/package.json`
- `apps/web/src/index.html`
- `apps/server/src/server.ts`
- `apps/server/src/static.ts`
- build/copy scripts under `apps/server/scripts/**` or root `scripts/**`

## Implementation steps

1. Finalize the `apps/web` build output directory, expected as `apps/web/dist`.
2. Add static asset serving to `apps/server`.
3. Serve `index.html` for the browser app and fall back to it for app routes if needed.
4. Add a development path that either:
   - serves a watched local build directory, or
   - serves from an explicitly provided development URL.
5. Keep the API and static serving paths compatible in one process.

## Acceptance criteria

- `apps/server` serves the built `apps/web` bundle.
- Browser mode can load the shared app through the server.
- Development mode has a defined strategy for serving the shared app during local work.

## Verification

- `bun run check`
- `bun run typecheck`
- `bun test`
