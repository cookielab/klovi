---
description: Use Bun instead of Node.js, npm, pnpm, or vite.
globs: "*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json"
alwaysApply: false
---

## Verification (MANDATORY)

After every code change, run ALL checks and fix any issues you introduced:

```sh
bun run check      # Biome lint + format
bun run typecheck  # TypeScript type checking
bun test           # Unit tests
```

If any check fails, fix the issue and re-run until all pass. Never skip this step.

---

## Project Rule: No Caching (MANDATORY)

- Never implement caching in this project.
- Do not add in-memory caches, file-based caches, DB cache tables, HTTP cache layers, memoization caches, or TTL-based cache logic.
- Prefer direct computation and source-of-truth reads over cache invalidation strategies.

---

## Desktop App (Electrobun)

Klovi is a native desktop app built with [Electrobun](https://electrobun.dev). There is no HTTP server.

- **Dev mode**: `bunx electrobun dev`
- **Build**: `bunx electrobun build`
- **Main process**: `src/bun/index.ts` (Bun runtime, RPC handlers, BrowserWindow, ApplicationMenu)
- **Webview entry**: `src/views/main/index.ts` (Electroview RPC client, React mount)
- **RPC types**: `src/shared/rpc-types.ts` (typed schema shared between main process and webview)

Communication between main process and webview uses Electrobun's typed RPC, not HTTP.

---

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.
