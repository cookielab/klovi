# Create apps/package

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create `apps/package` as the new published `@cookielab.io/klovi` NPM package that wires `apps/server` (API) and `apps/web` (UI) together, owns the CLI entrypoint, and serves the combined application.

**Architecture:** `apps/package` is a thin composition layer. It imports the RPC router from `apps/server`, adds static file serving for `apps/web` built assets, provides SPA fallback routing, and exposes a CLI that starts the server and opens the browser. It uses Effect `@effect/platform` for HTTP composition, matching the server's approach.

**Tech Stack:** Effect, @effect/platform, Bun, Node

**Depends on:** [20-extract-rpc-router-from-http-app.md](./20-extract-rpc-router-from-http-app.md)

---

### Task 1: Create apps/package scaffold

**Files:**
- Create: `apps/package/package.json`
- Create: `apps/package/tsconfig.json`

**Step 1: Create package.json**

Use a temporary package name `@cookielab.io/klovi-package` during development. Plan 22 will transfer the `@cookielab.io/klovi` identity here.

```json
{
  "name": "@cookielab.io/klovi-package",
  "version": "0.0.0",
  "description": "Klovi — browse and present AI coding session history",
  "type": "module",
  "license": "MIT",
  "author": "Cookielab s.r.o.",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/cookielab/klovi.git"
  },
  "homepage": "https://github.com/cookielab/klovi",
  "bugs": {
    "url": "https://github.com/cookielab/klovi/issues"
  },
  "bin": {
    "klovi": "./src/cli.ts"
  },
  "exports": {
    "./server": "./src/server.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit -p tsconfig.json"
  },
  "dependencies": {
    "@cookielab.io/klovi": "workspace:*",
    "@cookielab.io/klovi-web": "workspace:*",
    "effect": "*",
    "@effect/platform": "*",
    "@effect/platform-bun": "*",
    "@effect/platform-node": "*"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"]
}
```

**Step 3: Run bun install**

Run: `bun install`
Expected: Workspace resolves the new package.

**Step 4: Commit**

```bash
git add apps/package/package.json apps/package/tsconfig.json
git commit -m "feat(package): create apps/package scaffold"
```

---

### Task 2: Create static file handler

**Files:**
- Create: `apps/package/src/static-handler.ts`
- Create: `apps/package/src/static-handler.test.ts`

**Step 1: Write the failing test**

```ts
// apps/package/src/static-handler.test.ts
import { describe, expect, test } from "bun:test";
import { join, resolve } from "node:path";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";

import { makeStaticHandler } from "./static-handler.ts";

const tmpDir = resolve(import.meta.dir, "../.test-static");

// Create a temporary static directory with test files
function setupStaticDir() {
  mkdirSync(tmpDir, { recursive: true });
  writeFileSync(join(tmpDir, "index.html"), "<html>index</html>");
  writeFileSync(join(tmpDir, "app.js"), "console.log('app')");
  mkdirSync(join(tmpDir, "assets"), { recursive: true });
  writeFileSync(join(tmpDir, "assets", "style.css"), "body{}");
}

function cleanupStaticDir() {
  rmSync(tmpDir, { recursive: true, force: true });
}

describe("makeStaticHandler", () => {
  test("is a function", () => {
    expect(typeof makeStaticHandler).toBe("function");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test apps/package/src/static-handler.test.ts`
Expected: FAIL — module not found.

**Step 3: Write the static handler**

```ts
// apps/package/src/static-handler.ts
import { HttpServerRequest, HttpServerResponse } from "@effect/platform";
import { Effect } from "effect";

export const makeStaticHandler = (staticDir: string) =>
  Effect.gen(function* () {
    const req = yield* HttpServerRequest.HttpServerRequest;
    const url = new URL(req.url);
    const filePath = url.pathname === "/" ? "/index.html" : url.pathname;

    return yield* HttpServerResponse.file(`${staticDir}${filePath}`).pipe(
      Effect.orElse(() => HttpServerResponse.file(`${staticDir}/index.html`)),
      Effect.orElse(() =>
        Effect.succeed(HttpServerResponse.unsafeJson({ error: "Not found" }, { status: 404 })),
      ),
    );
  });
```

**Step 4: Run test to verify it passes**

Run: `bun test apps/package/src/static-handler.test.ts`
Expected: PASS.

**Step 5: Run verification**

Run: `bun run check && bun run typecheck && bun test`
Expected: All pass.

**Step 6: Commit**

```bash
git add apps/package/src/static-handler.ts apps/package/src/static-handler.test.ts
git commit -m "feat(package): add static file handler with SPA fallback"
```

---

### Task 3: Create combined HTTP composition

**Files:**
- Create: `apps/package/src/http-app.ts`
- Create: `apps/package/src/http-app.test.ts`

**Step 1: Write the failing test**

```ts
// apps/package/src/http-app.test.ts
import { describe, expect, test } from "bun:test";
import { makePackageHttpApp } from "./http-app.ts";

describe("makePackageHttpApp", () => {
  test("is a function", () => {
    expect(typeof makePackageHttpApp).toBe("function");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test apps/package/src/http-app.test.ts`
Expected: FAIL — module not found.

**Step 3: Write the HTTP composition**

This composes the RPC router from `apps/server` with the static handler. RPC routes (`/api/rpc/*`) are handled by the server's router. All other routes fall through to static file serving.

```ts
// apps/package/src/http-app.ts
import { HttpServer } from "@effect/platform";
import { Effect } from "effect";
import { makeRpcRouter } from "@cookielab.io/klovi/effect/http-app";
import { makeStaticHandler } from "./static-handler.ts";

export const makePackageHttpApp = (staticDir: string) => {
  const router = makeRpcRouter();
  return router.pipe(
    Effect.catchTag("RouteNotFound", () => makeStaticHandler(staticDir)),
  );
};

export const makePackageServeLayer = (staticDir: string) =>
  makePackageHttpApp(staticDir).pipe(HttpServer.serve());
```

**Step 4: Run test to verify it passes**

Run: `bun test apps/package/src/http-app.test.ts`
Expected: PASS.

**Step 5: Run verification**

Run: `bun run check && bun run typecheck && bun test`
Expected: All pass.

**Step 6: Commit**

```bash
git add apps/package/src/http-app.ts apps/package/src/http-app.test.ts
git commit -m "feat(package): add HTTP composition layer combining RPC + static"
```

---

### Task 4: Create server startup function

**Files:**
- Create: `apps/package/src/server.ts`
- Create: `apps/package/src/server.test.ts`

**Step 1: Write the failing test**

```ts
// apps/package/src/server.test.ts
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type KloviPackageServer, startKloviPackageServer } from "./server.ts";

const URL_PATTERN = /^http:\/\/127\.0\.0\.1:\d+$/;

describe("startKloviPackageServer", () => {
  let server: KloviPackageServer;

  beforeAll(async () => {
    server = await startKloviPackageServer({ host: "127.0.0.1", port: 0 });
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
      body: "{}",
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { version: string; commit: string };
    expect(data).toHaveProperty("version");
    expect(data).toHaveProperty("commit");
  });

  test("POST /api/rpc/unknown returns 404", async () => {
    const res = await fetch(`${server.url}/api/rpc/unknownMethod`, {
      method: "POST",
      body: "{}",
    });
    expect(res.status).toBe(404);
  });

  test("GET / returns 404 when no staticDir", async () => {
    const res = await fetch(server.url);
    expect(res.status).toBe(404);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test apps/package/src/server.test.ts`
Expected: FAIL — module not found.

**Step 3: Write the server startup**

```ts
// apps/package/src/server.ts
import { execFile } from "node:child_process";
import { HttpServer } from "@effect/platform";
import { Effect, Fiber, Layer } from "effect";
import { ServerConfig } from "@cookielab.io/klovi/effect/server-config";
import { KloviServicesLive } from "@cookielab.io/klovi/effect/server-services";
import { makeBunServerLayer } from "@cookielab.io/klovi/effect/platform-bun";
import { makeNodeServerLayer } from "@cookielab.io/klovi/effect/platform-node";
import { setPluginLayer } from "@cookielab.io/klovi/effect/plugin-runtime";
import { makePackageServeLayer } from "./http-app.ts";
import { makeStaticHandler } from "./static-handler.ts";
import { makeRpcRouter } from "@cookielab.io/klovi/effect/http-app";

export interface StartKloviPackageServerOptions {
  host?: string;
  port?: number;
  staticDir?: string | undefined;
  openBrowser?: boolean;
  version?: string;
  commit?: string;
  settingsPath?: string;
  runtime?: "auto" | "bun" | "node";
}

export interface KloviPackageServer {
  url: string;
  stop(): void;
}

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

function openInBrowser(url: string): void {
  const cmd =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", url] : [url];
  execFile(cmd, args, () => {});
}

export async function startKloviPackageServer(
  options: StartKloviPackageServerOptions = {},
): Promise<KloviPackageServer> {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 0;
  const settingsPath = options.settingsPath ?? getDefaultSettingsPath();
  const version = options.version ?? "dev";
  const commit = options.commit ?? "";
  const rt = detectRuntime(options.runtime);

  if (rt === "node") {
    const { NodePluginLayer } = await import("@cookielab.io/klovi/effect/platform-node");
    setPluginLayer(NodePluginLayer);
  }

  const configLayer = Layer.succeed(ServerConfig, {
    host,
    port,
    staticDir: options.staticDir,
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

  const serveLayer = options.staticDir
    ? makePackageServeLayer(options.staticDir)
    : makeRpcRouter().pipe(HttpServer.serve());

  const fullLayer = Layer.merge(serveLayer, addressCapture).pipe(
    Layer.provide(servicesLayer),
    Layer.provide(configLayer),
    Layer.provide(platformLayer),
  );

  const fiber = Effect.runFork(Layer.launch(fullLayer));
  const url = await addressPromise;

  if (options.openBrowser) {
    openInBrowser(url);
  }

  return {
    url,
    stop() {
      Effect.runFork(Fiber.interrupt(fiber));
    },
  };
}
```

**Step 4: Run test to verify it passes**

Run: `bun test apps/package/src/server.test.ts`
Expected: PASS.

**Step 5: Run verification**

Run: `bun run check && bun run typecheck && bun test`
Expected: All pass.

**Step 6: Commit**

```bash
git add apps/package/src/server.ts apps/package/src/server.test.ts
git commit -m "feat(package): add server startup with HTTP composition"
```

---

### Task 5: Create CLI entrypoint

**Files:**
- Create: `apps/package/src/cli.ts`
- Create: `apps/package/src/cli.test.ts`

**Step 1: Write the failing test**

```ts
// apps/package/src/cli.test.ts
import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";

describe("CLI smoke tests", () => {
  const cliPath = resolve(import.meta.dir, "cli.ts");
  const serverPath = resolve(import.meta.dir, "server.ts");

  test("cli.ts file exists", async () => {
    const file = Bun.file(cliPath);
    expect(await file.exists()).toBe(true);
  });

  test("cli.ts has shebang line", async () => {
    const content = await Bun.file(cliPath).text();
    expect(content.startsWith("#!/usr/bin/env node")).toBe(true);
  });

  test("server.ts exports startKloviPackageServer", async () => {
    const serverModule = await import(serverPath);
    expect(typeof serverModule.startKloviPackageServer).toBe("function");
  });

  test("package.json bin points to cli.ts", async () => {
    const pkgPath = resolve(import.meta.dir, "../package.json");
    const pkg = await Bun.file(pkgPath).json();
    expect(pkg.bin?.klovi).toBe("./src/cli.ts");
  });

  test("package.json exports server entry", async () => {
    const pkgPath = resolve(import.meta.dir, "../package.json");
    const pkg = await Bun.file(pkgPath).json();
    expect(pkg.exports?.["./server"]).toBe("./src/server.ts");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test apps/package/src/cli.test.ts`
Expected: FAIL — cli.ts not found.

**Step 3: Write the CLI entrypoint**

```ts
#!/usr/bin/env node
// apps/package/src/cli.ts
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { startKloviPackageServer } from "./server.ts";

const __dir = import.meta.dirname;
const pkgPath = resolve(__dir, "../package.json");
const pkg = JSON.parse(await readFile(pkgPath, "utf-8")) as Record<string, string>;
const version = pkg["version"] ?? "0.0.0";
const commit = pkg["commit"] ?? "";

const host = process.env["KLOVI_HOST"] ?? "127.0.0.1";
const port = Number(process.env["KLOVI_PORT"] ?? "3131");
const staticDir =
  process.env["KLOVI_STATIC_DIR"] ??
  resolve(__dir, "../node_modules/@cookielab.io/klovi-web/dist");

const openBrowser = !process.argv.includes("--no-browser");

const server = await startKloviPackageServer({
  host,
  port,
  staticDir,
  version,
  commit,
  openBrowser,
});

// biome-ignore lint/suspicious/noConsole: CLI output
console.log(`Klovi server listening on ${server.url}`);
```

**Step 4: Run test to verify it passes**

Run: `bun test apps/package/src/cli.test.ts`
Expected: PASS.

**Step 5: Run verification**

Run: `bun run check && bun run typecheck && bun test`
Expected: All pass.

**Step 6: Commit**

```bash
git add apps/package/src/cli.ts apps/package/src/cli.test.ts
git commit -m "feat(package): add CLI entrypoint"
```

---

### Task 6: Add integration test for combined server

**Files:**
- Create: `apps/package/src/integration.test.ts`

**Step 1: Write the integration test**

Tests the full round-trip: server startup, RPC calls, and static file serving when a staticDir is provided.

```ts
// apps/package/src/integration.test.ts
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { type KloviPackageServer, startKloviPackageServer } from "./server.ts";

const tmpStaticDir = resolve(import.meta.dir, "../.test-integration-static");

describe("apps/package integration", () => {
  let server: KloviPackageServer;

  beforeAll(async () => {
    // Create temporary static files
    mkdirSync(tmpStaticDir, { recursive: true });
    writeFileSync(join(tmpStaticDir, "index.html"), "<html><body>Klovi</body></html>");
    writeFileSync(join(tmpStaticDir, "app.js"), "console.log('app')");

    server = await startKloviPackageServer({
      host: "127.0.0.1",
      port: 0,
      staticDir: tmpStaticDir,
      version: "1.0.0",
      commit: "test123",
    });
  });

  afterAll(() => {
    server?.stop();
    rmSync(tmpStaticDir, { recursive: true, force: true });
  });

  test("RPC: getVersion returns configured version", async () => {
    const res = await fetch(`${server.url}/api/rpc/getVersion`, {
      method: "POST",
      body: "{}",
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { version: string; commit: string };
    expect(data.version).toBe("1.0.0");
    expect(data.commit).toBe("test123");
  });

  test("RPC: unknown method returns 404", async () => {
    const res = await fetch(`${server.url}/api/rpc/unknownMethod`, {
      method: "POST",
      body: "{}",
    });
    expect(res.status).toBe(404);
  });

  test("static: GET / serves index.html", async () => {
    const res = await fetch(server.url);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("Klovi");
  });

  test("static: GET /app.js serves JS file", async () => {
    const res = await fetch(`${server.url}/app.js`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("console.log");
  });

  test("static: SPA fallback for unknown route serves index.html", async () => {
    const res = await fetch(`${server.url}/some/deep/route`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("Klovi");
  });
});
```

**Step 2: Run integration test**

Run: `bun test apps/package/src/integration.test.ts`
Expected: PASS.

**Step 3: Run verification**

Run: `bun run check && bun run typecheck && bun test`
Expected: All pass.

**Step 4: Commit**

```bash
git add apps/package/src/integration.test.ts
git commit -m "test(package): add integration test for combined server"
```

---

## Dependency Graph

- Task 1 has no prerequisites.
- Task 2 depends on Task 1.
- Task 3 depends on Task 2.
- Task 4 depends on Task 3.
- Task 5 depends on Task 4.
- Task 6 depends on Task 4.

## Acceptance Criteria

- `apps/package` exists with `package.json`, `tsconfig.json`, and source files.
- `startKloviPackageServer()` starts a combined API + static server.
- RPC routes (`POST /api/rpc/:method`) work through the package server.
- Static files are served from the configured `staticDir`.
- SPA fallback returns `index.html` for unknown routes.
- CLI entrypoint exists with shebang and correct wiring.
- Integration test proves RPC and static serving work together.
- `bun run check`, `bun run typecheck`, `bun test` all pass.
