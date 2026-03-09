# Dev Scripts Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `dev:bun` and `dev:node` root scripts that start the web build + HTTP server concurrently with auto browser-open.

**Architecture:** Make the existing `cli.ts` runtime-agnostic (Bun + Node 22+), add `openBrowser` logic to `server.ts`, wire up root package.json scripts using shell `&` for concurrency.

**Tech Stack:** TypeScript, Effect, `child_process.execFile`, `import.meta.dirname`

---

### Task 1: Add `openBrowser` helper to `server.ts`

**Files:**
- Modify: `apps/server/src/server.ts:1-113`

**Step 1: Write the `openBrowser` function**

Add this function after the `detectRuntime` function (line 50) in `apps/server/src/server.ts`:

```ts
function openInBrowser(url: string): void {
  const { execFile } = require("node:child_process") as typeof import("node:child_process");
  const cmd =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", url] : [url];
  execFile(cmd, args, () => {});
}
```

**Step 2: Call it after server starts**

In `startKloviServer`, after `const url = await addressPromise;` (line 105), add:

```ts
  if (options.openBrowser) {
    openInBrowser(url);
  }
```

**Step 3: Run checks**

Run: `bun run check && bun run typecheck && bun test`
Expected: All pass

**Step 4: Commit**

```bash
git add apps/server/src/server.ts
git commit -m "feat(server): add openBrowser support to startKloviServer"
```

---

### Task 2: Make `cli.ts` runtime-agnostic

**Files:**
- Modify: `apps/server/src/cli.ts`
- Modify: `apps/server/src/cli.test.ts`

**Step 1: Update `cli.ts`**

Replace the entire file content with:

```ts
#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { startKloviServer } from "./server.ts";

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

const server = await startKloviServer({
  host,
  port,
  mode: "standalone",
  staticDir,
  version,
  commit,
  openBrowser,
});

// biome-ignore lint/suspicious/noConsole: CLI output
console.log(`Klovi server listening on ${server.url}`);
```

**Step 2: Update `cli.test.ts` shebang test**

In `apps/server/src/cli.test.ts`, change the shebang assertion:

```ts
  test("cli.ts has shebang line", async () => {
    const content = await Bun.file(cliPath).text();
    expect(content.startsWith("#!/usr/bin/env node")).toBe(true);
  });
```

**Step 3: Run checks**

Run: `bun run check && bun run typecheck && bun test`
Expected: All pass

**Step 4: Commit**

```bash
git add apps/server/src/cli.ts apps/server/src/cli.test.ts
git commit -m "feat(server): make cli.ts runtime-agnostic with --no-browser support"
```

---

### Task 3: Update `index.ts` to use `import.meta.dirname`

**Files:**
- Modify: `apps/server/src/index.ts`

**Step 1: Replace `import.meta.dir` with `import.meta.dirname`**

Replace the entire file content with:

```ts
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { startKloviServer } from "./server.ts";

// Read version from package.json at startup
const __dir = import.meta.dirname;
const pkgPath = resolve(__dir, "../../package.json");
const pkg = JSON.parse(await readFile(pkgPath, "utf-8")) as Record<string, string>;
const version = pkg["version"] ?? "0.0.0";
const commit = pkg["commit"] ?? "";

const host = process.env["KLOVI_HOST"] ?? "127.0.0.1";
const port = Number(process.env["KLOVI_PORT"] ?? "3131");
const staticDir =
  process.env["KLOVI_STATIC_DIR"] ??
  resolve(__dir, "../../node_modules/@cookielab.io/klovi-web/dist");

const server = await startKloviServer({
  host,
  port,
  mode: "standalone",
  staticDir,
  version,
  commit,
});

// biome-ignore lint/suspicious/noConsole: CLI output
console.log(`Klovi server listening on ${server.url}`);
```

**Step 2: Run checks**

Run: `bun run check && bun run typecheck && bun test`
Expected: All pass

**Step 3: Commit**

```bash
git add apps/server/src/index.ts
git commit -m "refactor(server): use import.meta.dirname in index.ts"
```

---

### Task 4: Add root-level dev scripts

**Files:**
- Modify: `package.json` (root)

**Step 1: Update root `package.json` scripts**

Replace the existing `dev:server` script and add `dev:bun` / `dev:node`:

```json
"dev:server": "bun run --filter @cookielab.io/klovi start",
"dev:bun": "bun run --filter @cookielab.io/klovi-web dev & bun run --filter @cookielab.io/klovi dev & wait",
"dev:node": "bun run --filter @cookielab.io/klovi-web dev & npx tsx apps/server/src/cli.ts & wait"
```

**Step 2: Run checks**

Run: `bun run check && bun run typecheck && bun test`
Expected: All pass

**Step 3: Commit**

```bash
git add package.json
git commit -m "feat: add dev:bun and dev:node root scripts"
```

---

### Task 5: Smoke test the scripts

**Step 1: Test `dev:bun`**

Run: `bun run dev:bun`
Expected: Web build starts, server starts, browser opens to `http://127.0.0.1:3131`

**Step 2: Test `dev:node`**

Run: `bun run dev:node`
Expected: Web build starts, server starts via tsx/Node, browser opens to `http://127.0.0.1:3131`

**Step 3: Test `--no-browser`**

Run: `bun run apps/server/src/cli.ts -- --no-browser`
Expected: Server starts, browser does NOT open

**Step 4: Test `dev:desktop`**

Run: `bun run dev:desktop`
Expected: Electrobun app starts (unchanged behavior)
