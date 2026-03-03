# Bun-Only Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Node.js patterns with Bun-native APIs where Bun has genuinely better alternatives.

**Architecture:** Four independent changes: (1) replace custom semver with `Bun.semver`, (2) replace setTimeout with `Bun.sleep()`, (3) replace readdir+filter with `Bun.Glob`, (4) clean up workspace package.json fields. All changes are in production and test code only — no architectural changes.

**Tech Stack:** Bun runtime APIs (`semver`, `sleep`, `Glob`), Bun test runner

---

### Task 1: Replace `compareVersions()` with `Bun.semver`

**Files:**
- Modify: `src/bun/updater.ts:20-52` (remove function), `src/bun/updater.ts:101-102` (update call sites)
- Modify: `src/bun/updater.test.ts:7,15-47` (update tests)

**Step 1: Update the test file**

In `src/bun/updater.test.ts`, replace the `compareVersions` import and test block.

Remove `compareVersions` from the import on line 7:
```ts
import {
  filterReleasesByChannel,
  findLatestRelease,
  type GitHubRelease,
  getAssetName,
  UpdateManager,
} from "./updater.ts";
```

Add `semver` import:
```ts
import { semver } from "bun";
```

Replace the `describe("compareVersions")` block (lines 15-47) with:
```ts
describe("semver.order (version comparison)", () => {
  test("returns positive when a > b", () => {
    expect(semver.order("2.0.0", "1.0.0")).toBeGreaterThan(0);
  });

  test("returns negative when a < b", () => {
    expect(semver.order("1.0.0", "2.0.0")).toBeLessThan(0);
  });

  test("returns 0 when equal", () => {
    expect(semver.order("1.2.3", "1.2.3")).toBe(0);
  });

  test("compares minor versions", () => {
    expect(semver.order("1.2.0", "1.1.0")).toBeGreaterThan(0);
  });

  test("compares patch versions", () => {
    expect(semver.order("1.0.2", "1.0.1")).toBeGreaterThan(0);
  });

  test("prerelease is less than release", () => {
    expect(semver.order("1.0.0-beta.1", "1.0.0")).toBeLessThan(0);
  });

  test("rc is greater than beta", () => {
    expect(semver.order("1.0.0-rc.1", "1.0.0-beta.1")).toBeGreaterThan(0);
  });

  test("beta.2 is greater than beta.1", () => {
    expect(semver.order("1.0.0-beta.2", "1.0.0-beta.1")).toBeGreaterThan(0);
  });
});
```

**Step 2: Run tests to verify they pass**

Run: `bun test src/bun/updater.test.ts`
Expected: All 8 semver tests pass (validates Bun.semver handles our version patterns).

**Step 3: Update the production code**

In `src/bun/updater.ts`:

Add import at top of file:
```ts
import { semver } from "bun";
```

Remove the entire `compareVersions` function (lines 20-52).

In `findLatestRelease` (currently lines 101-102), replace `compareVersions` calls with `semver.order`:
```ts
if (semver.order(release.tag_name, currentVersion) > 0) {
  if (!best || semver.order(release.tag_name, best.tag_name) > 0) {
```

**Step 4: Run all tests**

Run: `bun test src/bun/updater.test.ts`
Expected: All tests pass, including `findLatestRelease` tests which validate the integration.

**Step 5: Verify**

Run: `bun run check && bun run typecheck && bun test`
Expected: All pass.

**Step 6: Commit**

```bash
git add src/bun/updater.ts src/bun/updater.test.ts
git commit -m "refactor(updater): replace custom compareVersions with Bun.semver"
```

---

### Task 2: Replace `setTimeout` delay with `Bun.sleep()`

**Files:**
- Modify: `src/bun/updater.ts:297`

**Step 1: Make the change**

In `src/bun/updater.ts`, line 297, replace:
```ts
          await new Promise((resolve) => setTimeout(resolve, delay));
```
with:
```ts
          await Bun.sleep(delay);
```

**Step 2: Verify**

Run: `bun run check && bun run typecheck && bun test`
Expected: All pass.

**Step 3: Commit**

```bash
git add src/bun/updater.ts
git commit -m "refactor(updater): replace setTimeout delay with Bun.sleep()"
```

---

### Task 3: Replace `listFilesBySuffix` with `Bun.Glob`

**Files:**
- Modify: `packages/klovi-plugin-claude-code/src/shared/discovery-utils.ts:1-2,21-28`
- Modify: `packages/klovi-plugin-codex/src/shared/discovery-utils.ts:1-2,21-28`
- Test: `packages/klovi-plugin-claude-code/src/shared/discovery-utils.test.ts` (existing tests)
- Test: `packages/klovi-plugin-codex/src/shared/discovery-utils.test.ts` (existing tests)

**Step 1: Update claude-code discovery-utils.ts**

In `packages/klovi-plugin-claude-code/src/shared/discovery-utils.ts`:

Remove `import type { Dirent } from "node:fs";` on line 1 — `readdir` with `{ withFileTypes: true }` returns `Dirent[]` already, but `readDirEntriesSafe` needs the `Dirent` type for its return signature. Keep it if TypeScript requires it; remove only if unused after the change.

Actually, `readDirEntriesSafe` has return type `Promise<Dirent[]>`, so the `Dirent` import must stay. The `readdir` import must also stay because `readDirEntriesSafe` still uses it.

Replace the `listFilesBySuffix` function (lines 21-28):
```ts
export async function listFilesBySuffix(dir: string, suffix: string): Promise<string[]> {
  try {
    const glob = new Bun.Glob(`*${suffix}`);
    return Array.from(glob.scanSync({ cwd: dir }));
  } catch {
    return [];
  }
}
```

**Step 2: Run tests**

Run: `bun test packages/klovi-plugin-claude-code/src/shared/discovery-utils.test.ts`
Expected: All tests pass including `listFilesBySuffix filters matching files`.

**Step 3: Update codex discovery-utils.ts**

In `packages/klovi-plugin-codex/src/shared/discovery-utils.ts`:

Same change — replace `listFilesBySuffix` (lines 21-28):
```ts
export async function listFilesBySuffix(dir: string, suffix: string): Promise<string[]> {
  try {
    const glob = new Bun.Glob(`*${suffix}`);
    return Array.from(glob.scanSync({ cwd: dir }));
  } catch {
    return [];
  }
}
```

**Step 4: Run tests**

Run: `bun test packages/klovi-plugin-codex/src/shared/discovery-utils.test.ts`
Expected: All tests pass.

**Step 5: Verify**

Run: `bun run check && bun run typecheck && bun test`
Expected: All pass.

**Step 6: Commit**

```bash
git add packages/klovi-plugin-claude-code/src/shared/discovery-utils.ts packages/klovi-plugin-codex/src/shared/discovery-utils.ts
git commit -m "refactor(discovery): replace readdir+filter with Bun.Glob in listFilesBySuffix"
```

---

### Task 4: Clean up workspace `package.json` files

**Files:**
- Modify: `packages/klovi-plugin-core/package.json` — remove `main`, `module`, `types`
- Modify: `packages/klovi-plugin-claude-code/package.json` — remove `main`, `module`, `types`
- Modify: `packages/klovi-plugin-codex/package.json` — remove `main`, `module`, `types`
- Modify: `packages/klovi-plugin-opencode/package.json` — remove `main`, `module`, `types`
- Modify: `packages/klovi-ui/package.json` — remove `main`, `module`, `types`
- Modify: `packages/klovi-design-system/package.json` — remove `main`, `module`, `types`

**Step 1: Remove redundant fields from all 6 packages**

Each package has these three lines to remove:
```json
  "main": "./src/index.ts",
  "module": "./src/index.ts",
  "types": "./src/index.ts",
```

Bun resolves via the `exports` field which all packages already define. The `main`/`module`/`types` fields are Node.js bundler compatibility that's no longer needed.

Example result for `klovi-plugin-core/package.json`:
```json
{
  "name": "@cookielab.io/klovi-plugin-core",
  "version": "0.1.0",
  "description": "Core plugin contracts and registry for Klovi plugin packages",
  "type": "module",
  "license": "MIT",
  "exports": {
    ".": "./src/index.ts"
  },
  "sideEffects": false,
  "files": [
    "src"
  ]
}
```

**Step 2: Verify**

Run: `bun run check && bun run typecheck && bun test`
Expected: All pass — Bun uses `exports` field, not `main`/`module`/`types`.

**Step 3: Commit**

```bash
git add packages/*/package.json
git commit -m "chore: remove redundant main/module/types from workspace packages"
```
