# Extract RPC Router From HTTP App

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split `makeHttpApp()` in `apps/server` so the RPC router is independently importable, enabling `apps/package` to compose its own HTTP layer.

**Architecture:** Currently `makeHttpApp()` combines RPC routing and static file serving into one Effect HttpApp. Extract the RPC-only router into `makeRpcRouter()` so it can be imported and composed by `apps/package`. Refactor `makeHttpApp()` to call `makeRpcRouter()` internally so existing behavior is preserved.

**Tech Stack:** Effect, @effect/platform HttpRouter

---

### Task 1: Extract makeRpcRouter from http-app.ts

**Files:**
- Modify: `apps/server/src/effect/http-app.ts`

**Step 1: Add makeRpcRouter function**

Add a new exported function that returns just the RPC routes. Refactor `makeHttpApp()` to use it.

```ts
// apps/server/src/effect/http-app.ts
import { HttpRouter, HttpServer, HttpServerRequest, HttpServerResponse } from "@effect/platform";
import { Effect } from "effect";
import { handleRPC, RPCError } from "../rpc.ts";
import { ServerConfig } from "./server-config.ts";
import { KloviServices } from "./server-services.ts";

const rpcHandler = Effect.gen(function* () {
  const services = yield* KloviServices;
  const routeParams = yield* HttpRouter.params;
  const req = yield* HttpServerRequest.HttpServerRequest;

  const method = routeParams["method"];
  if (!method) {
    return HttpServerResponse.unsafeJson({ error: "Method name required" }, { status: 400 });
  }

  let params: Record<string, unknown> = {};
  const bodyText = yield* req.text;
  if (bodyText) {
    try {
      params = JSON.parse(bodyText) as Record<string, unknown>;
    } catch {
      return HttpServerResponse.unsafeJson({ error: "Invalid JSON body" }, { status: 400 });
    }
  }

  const versionInfo = services.getVersion();
  const ctx = {
    registry: services.registry,
    settingsPath: services.settingsPath,
    version: versionInfo,
  };
  return yield* Effect.tryPromise({
    try: async () => {
      const result = await Promise.resolve(handleRPC(method, ctx, params));
      return HttpServerResponse.unsafeJson(result);
    },
    catch: (err) => err,
  });
}).pipe(
  Effect.catchAll((err) => {
    if (err instanceof RPCError) {
      return Effect.succeed(
        HttpServerResponse.unsafeJson({ error: err.message }, { status: err.status }),
      );
    }
    const message = err instanceof Error ? err.message : "Internal server error";
    return Effect.succeed(HttpServerResponse.unsafeJson({ error: message }, { status: 500 }));
  }),
);

const emptyMethodHandler = Effect.succeed(
  HttpServerResponse.unsafeJson({ error: "Method name required" }, { status: 400 }),
);

export const makeRpcRouter = () =>
  HttpRouter.empty.pipe(
    HttpRouter.post("/api/rpc/", emptyMethodHandler),
    HttpRouter.post("/api/rpc/:method", rpcHandler),
  );

const staticHandler = Effect.gen(function* () {
  const config = yield* ServerConfig;
  if (!config.staticDir) {
    return HttpServerResponse.unsafeJson({ error: "Not found" }, { status: 404 });
  }
  const req = yield* HttpServerRequest.HttpServerRequest;
  const url = new URL(req.url);
  const filePath = url.pathname === "/" ? "/index.html" : url.pathname;
  const staticDir = config.staticDir;

  return yield* HttpServerResponse.file(`${staticDir}${filePath}`).pipe(
    Effect.orElse(() => HttpServerResponse.file(`${staticDir}/index.html`)),
    Effect.orElse(() =>
      Effect.succeed(HttpServerResponse.unsafeJson({ error: "Not found" }, { status: 404 })),
    ),
  );
});

export const makeHttpApp = () => {
  const router = makeRpcRouter();
  return router.pipe(Effect.catchTag("RouteNotFound", () => staticHandler));
};

export const makeServeLayer = () => makeHttpApp().pipe(HttpServer.serve());
```

**Step 2: Run verification**

Run: `bun run check && bun run typecheck && bun test`
Expected: All pass — this is a pure refactor, no behavior change.

**Step 3: Commit**

```bash
git add apps/server/src/effect/http-app.ts
git commit -m "refactor(server): extract makeRpcRouter from makeHttpApp"
```

---

### Task 2: Export makeRpcRouter in package.json

**Files:**
- Modify: `apps/server/package.json`

**Step 1: Verify the export already exists**

The `./effect/http-app` export already exists in `apps/server/package.json`. Since `makeRpcRouter` is an additional named export from the same file, no package.json change is needed.

Verify by reading `apps/server/package.json` and confirming `"./effect/http-app": "./src/effect/http-app.ts"` is present.

**Step 2: Write an import smoke test**

```ts
// apps/server/src/effect/http-app-export.test.ts
import { describe, expect, test } from "bun:test";

describe("http-app exports", () => {
  test("makeRpcRouter is exported", async () => {
    const mod = await import("./http-app.ts");
    expect(typeof mod.makeRpcRouter).toBe("function");
  });

  test("makeHttpApp is still exported", async () => {
    const mod = await import("./http-app.ts");
    expect(typeof mod.makeHttpApp).toBe("function");
  });

  test("makeServeLayer is still exported", async () => {
    const mod = await import("./http-app.ts");
    expect(typeof mod.makeServeLayer).toBe("function");
  });
});
```

**Step 3: Run verification**

Run: `bun run check && bun run typecheck && bun test`
Expected: All pass.

**Step 4: Commit**

```bash
git add apps/server/src/effect/http-app-export.test.ts
git commit -m "test(server): add export smoke test for makeRpcRouter"
```

---

## Dependency Graph

- Task 2 depends on Task 1.

## Acceptance Criteria

- `makeRpcRouter()` is exported from `apps/server/src/effect/http-app.ts`.
- `makeHttpApp()` and `makeServeLayer()` still work exactly as before.
- All existing server tests pass without modification.
- `bun run check`, `bun run typecheck`, `bun test` all pass.
