# Strip Server To Pure Backend

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove static file serving, CLI, and web dependency from `apps/server`, making it a pure internal backend package that only provides API services and Effect layers.

**Architecture:** After plan 22, `apps/server` is named `@cookielab.io/klovi-server` but still contains static file serving in `http-app.ts`, a CLI entrypoint, and `index.ts`. These responsibilities now live in `apps/package`. Strip them from server to enforce the dependency rule: `apps/server` depends only on `packages/*`.

**Tech Stack:** Effect, @effect/platform

**Depends on:** [22-transfer-package-identity.md](./22-transfer-package-identity.md)

---

### Task 1: Remove static handler from http-app.ts

**Files:**
- Modify: `apps/server/src/effect/http-app.ts`
- Modify: `apps/server/src/effect/server-config.ts`

**Step 1: Remove staticDir from ServerConfig**

In `apps/server/src/effect/server-config.ts`, remove the `staticDir` field:

```ts
import { Context } from "effect";

export interface ServerConfigShape {
  readonly host: string;
  readonly port: number;
  readonly settingsPath: string;
  readonly version: string;
  readonly commit: string;
}

export class ServerConfig extends Context.Tag("@klovi/ServerConfig")<
  ServerConfig,
  ServerConfigShape
>() {}
```

**Step 2: Remove static handler and simplify http-app.ts**

In `apps/server/src/effect/http-app.ts`, remove the `staticHandler` and simplify `makeHttpApp()` to return a 404 for non-RPC routes:

```ts
import { HttpRouter, HttpServer, HttpServerRequest, HttpServerResponse } from "@effect/platform";
import { Effect } from "effect";
import { handleRPC, RPCError } from "../rpc.ts";
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

const notFoundHandler = Effect.succeed(
  HttpServerResponse.unsafeJson({ error: "Not found" }, { status: 404 }),
);

export const makeHttpApp = () =>
  makeRpcRouter().pipe(Effect.catchTag("RouteNotFound", () => notFoundHandler));

export const makeServeLayer = () => makeHttpApp().pipe(HttpServer.serve());
```

**Step 3: Run verification**

Run: `bun run check && bun run typecheck && bun test`
Expected: May see failures in server.ts and server.test.ts due to removed `staticDir` — those are fixed in Task 2.

**Step 4: Commit (defer until Task 2 if tests fail)**

---

### Task 2: Remove staticDir and openBrowser from server.ts

**Files:**
- Modify: `apps/server/src/server.ts`
- Modify: `apps/server/src/server.test.ts`

**Step 1: Simplify StartKloviServerOptions**

Remove `staticDir`, `openBrowser`, and browser-launch logic from `apps/server/src/server.ts`:

```ts
import { HttpServer } from "@effect/platform";
import { Effect, Fiber, Layer } from "effect";
import { makeServeLayer } from "./effect/http-app.ts";
import { makeBunServerLayer } from "./effect/platform-bun.ts";
import { makeNodeServerLayer } from "./effect/platform-node.ts";
import { setPluginLayer } from "./effect/plugin-runtime.ts";
import { ServerConfig } from "./effect/server-config.ts";
import { KloviServicesLive } from "./effect/server-services.ts";

export interface StartKloviServerOptions {
  host?: string;
  port?: number;
  mode?: "standalone" | "embedded";
  version?: string;
  commit?: string;
  settingsPath?: string;
  runtime?: "auto" | "bun" | "node";
}

export interface KloviServer {
  url: string;
  stop(): void;
}

export { ServerConfig, type ServerConfigShape } from "./effect/server-config.ts";
export { KloviServicesLive, type KloviServicesShape } from "./effect/server-services.ts";

function getDefaultSettingsPath(): string {
  const home = process.env["HOME"] ?? "";
  if (process.platform === "darwin") {
    return `${home}/Library/Application Support/io.cookielab.klovi/stable/settings.json`;
  }
  const configHome = process.env["XDG_CONFIG_HOME"] ?? `${home}/.config`;
  return `${configHome}/klovi/settings.json`;
}

function detectRuntime(requested: "auto" | "bun" | "node" = "auto"): "bun" | "node" {
  if (requested !== "auto") return requested;
  return typeof globalThis.Bun !== "undefined" ? "bun" : "node";
}

export async function startKloviServer(
  options: StartKloviServerOptions = {},
): Promise<KloviServer> {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 0;
  const settingsPath = options.settingsPath ?? getDefaultSettingsPath();
  const version = options.version ?? "dev";
  const commit = options.commit ?? "";
  const rt = detectRuntime(options.runtime);

  if (rt === "node") {
    const { NodePluginLayer } = await import("./effect/platform-node.ts");
    setPluginLayer(NodePluginLayer);
  }

  const configLayer = Layer.succeed(ServerConfig, {
    host,
    port,
    settingsPath,
    version,
    commit,
  });

  const servicesLayer = KloviServicesLive.pipe(Layer.provide(configLayer));

  const platformLayer =
    rt === "bun"
      ? makeBunServerLayer({ hostname: host, port })
      : makeNodeServerLayer({ host, port });

  let resolveAddress!: (url: string) => void;
  const addressPromise = new Promise<string>((resolve) => {
    resolveAddress = resolve;
  });

  const addressCapture = Layer.effectDiscard(
    HttpServer.addressWith((address) =>
      Effect.sync(() => {
        const addr = address as HttpServer.TcpAddress;
        resolveAddress(`http://${addr.hostname}:${addr.port}`);
      }),
    ),
  );

  const fullLayer = Layer.merge(makeServeLayer(), addressCapture).pipe(
    Layer.provide(servicesLayer),
    Layer.provide(configLayer),
    Layer.provide(platformLayer),
  );

  const fiber = Effect.runFork(Layer.launch(fullLayer));
  const url = await addressPromise;

  return {
    url,
    stop() {
      Effect.runFork(Fiber.interrupt(fiber));
    },
  };
}
```

**Step 2: Update server.test.ts**

Remove the static-related test case. The test for "GET / returns 404 when no staticDir" should now just be "GET / returns 404":

```ts
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type KloviServer, startKloviServer } from "./server.ts";

const URL_PATTERN = /^http:\/\/127\.0\.0\.1:\d+$/;

describe("startKloviServer", () => {
  let server: KloviServer;

  beforeAll(async () => {
    server = await startKloviServer({ host: "127.0.0.1", port: 0 });
  });

  afterAll(() => {
    server?.stop();
  });

  test("returns a URL", () => {
    expect(server.url).toMatch(URL_PATTERN);
  });

  test("POST /api/rpc/getVersion returns version info", async () => {
    const res = await fetch(`${server.url}/api/rpc/getVersion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { version: string; commit: string };
    expect(data).toHaveProperty("version");
    expect(data).toHaveProperty("commit");
  });

  test("POST /api/rpc/acceptRisks returns ok", async () => {
    const res = await fetch(`${server.url}/api/rpc/acceptRisks`, {
      method: "POST",
      body: "{}",
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean };
    expect(data.ok).toBe(true);
  });

  test("POST /api/rpc/unknown returns 404", async () => {
    const res = await fetch(`${server.url}/api/rpc/unknownMethod`, {
      method: "POST",
      body: "{}",
    });
    expect(res.status).toBe(404);
  });

  test("POST /api/rpc/ without method returns 400", async () => {
    const res = await fetch(`${server.url}/api/rpc/`, {
      method: "POST",
      body: "{}",
    });
    expect(res.status).toBe(400);
  });

  test("POST with invalid JSON returns 400", async () => {
    const res = await fetch(`${server.url}/api/rpc/getVersion`, {
      method: "POST",
      body: "not json{{{",
    });
    expect(res.status).toBe(400);
  });

  test("GET / returns 404", async () => {
    const res = await fetch(server.url);
    expect(res.status).toBe(404);
  });
});
```

**Step 3: Run verification**

Run: `bun run check && bun run typecheck && bun test`
Expected: All pass.

**Step 4: Commit**

```bash
git add apps/server/src/effect/http-app.ts apps/server/src/effect/server-config.ts apps/server/src/server.ts apps/server/src/server.test.ts
git commit -m "refactor(server): remove static serving, staticDir, and openBrowser"
```

---

### Task 3: Delete CLI and index files from apps/server

**Files:**
- Delete: `apps/server/src/cli.ts`
- Delete: `apps/server/src/cli.test.ts`
- Delete: `apps/server/src/index.ts`
- Modify: `apps/server/package.json`

**Step 1: Delete the files**

Remove `apps/server/src/cli.ts`, `apps/server/src/cli.test.ts`, and `apps/server/src/index.ts`. These responsibilities now live in `apps/package`.

**Step 2: Remove start script from package.json**

In `apps/server/package.json`, remove the `start` script (which referenced `index.ts`) and update the `dev` script if it references `index.ts`:

```json
{
  "scripts": {
    "dev": "bun run --watch src/server.ts",
    "typecheck": "tsc --noEmit -p tsconfig.json"
  }
}
```

Note: The `dev` script change is approximate — the server is now a library, not a standalone entry. Adjust to whatever makes sense for development. If `apps/server` has no standalone entry, consider removing `dev` and `start` entirely, keeping only `typecheck`.

**Step 3: Run verification**

Run: `bun run check && bun run typecheck && bun test`
Expected: All pass. The deleted test file should no longer be picked up by `bun test`.

**Step 4: Commit**

```bash
git add -A apps/server/src/cli.ts apps/server/src/cli.test.ts apps/server/src/index.ts apps/server/package.json
git commit -m "refactor(server): remove CLI and index entrypoints"
```

---

### Task 4: Clean up server exports

**Files:**
- Modify: `apps/server/package.json`

**Step 1: Review and clean exports**

The `apps/server/package.json` exports should reflect its role as a pure backend library. Remove any exports that are no longer relevant and ensure the remaining ones are correct:

```json
{
  "exports": {
    "./server": "./src/server.ts",
    "./effect/server-config": "./src/effect/server-config.ts",
    "./effect/server-services": "./src/effect/server-services.ts",
    "./effect/http-app": "./src/effect/http-app.ts",
    "./effect/platform-bun": "./src/effect/platform-bun.ts",
    "./effect/platform-node": "./src/effect/platform-node.ts",
    "./effect/plugin-runtime": "./src/effect/plugin-runtime.ts",
    "./services/app-services": "./src/services/app-services.ts",
    "./services/auto-discover": "./src/services/auto-discover.ts",
    "./services/catalog": "./src/services/catalog.ts",
    "./services/registry": "./src/services/registry.ts",
    "./services/settings": "./src/services/settings.ts",
    "./services/stats": "./src/services/stats.ts"
  }
}
```

**Step 2: Verify no remaining imports of @cookielab.io/klovi-web in apps/server**

Search `apps/server/src/` for any import of `@cookielab.io/klovi-web`. There should be none.

Run: `grep -r "klovi-web" apps/server/src/`
Expected: No matches.

**Step 3: Run verification**

Run: `bun run check && bun run typecheck && bun test`
Expected: All pass.

**Step 4: Commit**

```bash
git add apps/server/package.json
git commit -m "refactor(server): clean up exports for pure backend role"
```

---

### Task 5: Update integration test in apps/server

**Files:**
- Modify: `apps/server/src/integration.test.ts`

**Step 1: Remove any static-serving assertions**

The integration test in `apps/server` should only test RPC behavior, not static file serving. Review `apps/server/src/integration.test.ts` and remove any assertions about static files or HTML responses. The current test already only tests RPC, so this should be a no-op verification.

**Step 2: Run verification**

Run: `bun run check && bun run typecheck && bun test`
Expected: All pass.

**Step 3: Commit (only if changes were needed)**

```bash
git add apps/server/src/integration.test.ts
git commit -m "test(server): clean up integration test for API-only server"
```

---

## Dependency Graph

- Task 1 has no prerequisites.
- Task 2 depends on Task 1.
- Task 3 depends on Task 2.
- Task 4 depends on Task 3.
- Task 5 depends on Task 2.

## Acceptance Criteria

- `apps/server/src/effect/http-app.ts` has no static file handler — only RPC routes and a 404 fallback.
- `apps/server/src/effect/server-config.ts` has no `staticDir` field.
- `apps/server/src/server.ts` has no `staticDir`, `openBrowser`, or browser-launch logic.
- `apps/server/src/cli.ts`, `apps/server/src/cli.test.ts`, and `apps/server/src/index.ts` are deleted.
- `apps/server/package.json` has no `bin` field, no `@cookielab.io/klovi-web` dependency.
- `grep -r "klovi-web" apps/server/src/` returns no matches.
- All existing RPC tests continue to pass.
- `bun run check`, `bun run typecheck`, `bun test` all pass.
