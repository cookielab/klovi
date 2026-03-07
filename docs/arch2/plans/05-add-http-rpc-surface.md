# 05 Add HTTP RPC Surface

## Why this task exists

Browser mode needs a stable backend transport. This task exposes the extracted server application services over HTTP using the locked `POST /api/rpc/:method` contract.

## Depends on

- [04-extract-server-application-services.md](./04-extract-server-application-services.md)

## In scope

- Add the server runtime entry.
- Add `POST /api/rpc/:method`.
- Add an HTTP-backed implementation of `KloviClient`.

## Out of scope

- Serving the built web assets.
- Publishing the server package.
- Desktop embedding.

## Files/directories to create or change

- `apps/server/src/server.ts`
- `apps/server/src/index.ts`
- `apps/server/src/rpc.ts`
- `apps/server/src/http-client.ts` if the client lives on the server side for shared exports
- `apps/web/src/lib/http-client.ts`
- `apps/web/src/lib/client.ts`

## Implementation steps

1. Add `startKloviServer(options)` in `apps/server/src/server.ts`.
2. Implement `POST /api/rpc/:method`.
3. Route each RPC method name to the corresponding server service method.
4. Return JSON responses and stable error responses.
5. Implement an HTTP-backed `KloviClient` for browser mode in `apps/web`.
6. Keep desktop-native methods out of the HTTP surface.

## Acceptance criteria

- `startKloviServer(options)` exists.
- `POST /api/rpc/:method` serves the server-backed methods needed by `KloviClient`.
- The shared app shell can use an HTTP-backed client implementation.

## Verification

- `bun run check`
- `bun run typecheck`
- `bun test`
