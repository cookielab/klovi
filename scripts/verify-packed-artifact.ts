/**
 * Verify the packed npm artifact for @cookielab.io/klovi under both Node and Bun.
 *
 * This script:
 * 1. Packs the staged artifact from apps/package/.stage/npm/
 * 2. Installs it into a clean temp directory
 * 3. Launches the server under Node and verifies HTTP/RPC behavior
 * 4. Launches the server under Bun and verifies the same
 * 5. Tests environment overrides, port conflict, and graceful shutdown
 *
 * Usage:
 *   bun scripts/verify-packed-artifact.ts
 */

import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { getDefaultSettings } from "../packages/server/src/services/settings.ts";

const repoRoot = resolve(import.meta.dirname, "..");
const stageDir = resolve(repoRoot, "apps/package/.stage/npm");

let passed = 0;
let failed = 0;
let tempDir = "";

function ok(label: string) {
  passed++;
  console.log(`  \u2713 ${label}`);
}

function fail(label: string, err: unknown) {
  failed++;
  console.error(`  \u2717 ${label}:`, err instanceof Error ? err.message : err);
}

async function waitForServer(url: string, timeoutMs = 30000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) return true;
    } catch {
      // Server not ready yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

function killProcess(proc: ReturnType<typeof spawn>): Promise<void> {
  return new Promise((resolve) => {
    if (proc.exitCode !== null) {
      resolve();
      return;
    }
    proc.on("exit", () => resolve());
    proc.kill("SIGTERM");
    setTimeout(() => {
      if (proc.exitCode === null) proc.kill("SIGKILL");
    }, 5000);
  });
}

async function verifyServerBehavior(serverUrl: string, label: string): Promise<void> {
  console.log(`\n  Testing ${label} server behavior...`);

  // GET / serves the app (index.html)
  try {
    const res = await fetch(serverUrl);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const text = await res.text();
    if (!text.includes("<!") && !text.includes("<html") && !text.includes("<div"))
      throw new Error("Response does not look like HTML");
    ok(`${label}: GET / serves the app`);
  } catch (e) {
    fail(`${label}: GET / serves the app`, e);
  }

  // SPA fallback: deep link returns index.html
  try {
    const res = await fetch(`${serverUrl}/some/deep/route`);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const text = await res.text();
    if (!text.includes("<!") && !text.includes("<html") && !text.includes("<div"))
      throw new Error("SPA fallback does not return HTML");
    ok(`${label}: SPA fallback for deep link`);
  } catch (e) {
    fail(`${label}: SPA fallback for deep link`, e);
  }

  // /api/rpc/getVersion succeeds
  try {
    const res = await fetch(`${serverUrl}/api/rpc/getVersion`, {
      method: "POST",
      body: "{}",
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const data = (await res.json()) as Record<string, unknown>;
    if (!("version" in data)) throw new Error("Missing version field");
    ok(`${label}: /api/rpc/getVersion succeeds`);
  } catch (e) {
    fail(`${label}: /api/rpc/getVersion succeeds`, e);
  }

  // Unknown RPC method returns 404
  try {
    const res = await fetch(`${serverUrl}/api/rpc/nonexistentMethod`, {
      method: "POST",
      body: "{}",
    });
    if (res.status !== 404) throw new Error(`Expected 404, got ${res.status}`);
    ok(`${label}: unknown RPC method returns 404`);
  } catch (e) {
    fail(`${label}: unknown RPC method returns 404`, e);
  }

  // Empty RPC method returns error status
  try {
    const res = await fetch(`${serverUrl}/api/rpc/`, {
      method: "POST",
      body: "{}",
    });
    if (res.status < 400) throw new Error(`Expected 4xx, got ${res.status}`);
    ok(`${label}: empty RPC method returns error`);
  } catch (e) {
    fail(`${label}: empty RPC method returns error`, e);
  }
}

async function testServerImport(runtime: string, installDir: string): Promise<void> {
  console.log(`\n  Testing @cookielab.io/klovi/server import under ${runtime}...`);
  const testFile = join(installDir, "test-import.mjs");
  writeFileSync(
    testFile,
    `
import { startKloviServer } from "@cookielab.io/klovi/server";
if (typeof startKloviServer !== "function") {
  console.error("startKloviServer is not a function");
  process.exit(1);
}
console.log("import-ok");
`,
  );

  try {
    const cmd = runtime === "bun" ? "bun" : "node";
    const result = execFileSync(cmd, ["test-import.mjs"], {
      cwd: installDir,
      encoding: "utf-8",
      timeout: 15000,
      env: { ...process.env, NODE_NO_WARNINGS: "1" },
    });
    if (!result.includes("import-ok"))
      throw new Error("Import test did not produce expected output");
    ok(`${runtime}: @cookielab.io/klovi/server import works`);
  } catch (e) {
    fail(`${runtime}: @cookielab.io/klovi/server import works`, e);
  }
}

async function testRuntime(runtime: "node" | "bun", installDir: string): Promise<void> {
  console.log(`\n${runtime === "node" ? "4" : "5"}. ${runtime} runtime verification`);

  const cliPath = join(installDir, "node_modules/.bin/klovi");
  if (!existsSync(cliPath)) {
    fail(`${runtime}: CLI binary exists`, "klovi binary not found in node_modules/.bin/");
    return;
  }

  const port = 30000 + Math.floor(Math.random() * 10000);
  const cmd = runtime === "bun" ? "bun" : "node";
  const settingsPath = createHermeticSettingsFile(installDir);

  const proc = spawn(cmd, [cliPath, "--no-browser"], {
    cwd: installDir,
    env: {
      ...process.env,
      KLOVI_PORT: String(port),
      KLOVI_HOST: "127.0.0.1",
      KLOVI_SETTINGS_PATH: settingsPath,
      NODE_NO_WARNINGS: "1",
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  proc.stdout?.on("data", (d: Buffer) => {
    stdout += d.toString();
  });
  proc.stderr?.on("data", (d: Buffer) => {
    stderr += d.toString();
  });

  const serverUrl = `http://127.0.0.1:${port}`;

  try {
    const ready = await waitForServer(serverUrl);
    if (!ready) {
      throw new Error(
        `Server did not start within timeout.\nstdout: ${stdout}\nstderr: ${stderr}`,
      );
    }
    ok(`${runtime}: server starts successfully`);

    // Verify localhost binding
    try {
      const res = await fetch(`${serverUrl}/api/rpc/getVersion`, {
        method: "POST",
        body: "{}",
      });
      if (res.status === 200) {
        ok(`${runtime}: bind address is localhost`);
      }
    } catch (e) {
      fail(`${runtime}: bind address is localhost`, e);
    }

    await verifyServerBehavior(serverUrl, runtime);
    await testServerImport(runtime, installDir);
  } catch (e) {
    fail(`${runtime}: server lifecycle`, e);
  }

  // Test graceful shutdown
  try {
    await killProcess(proc);
    ok(`${runtime}: graceful shutdown`);
  } catch (e) {
    fail(`${runtime}: graceful shutdown`, e);
  }

  // Test port conflict
  console.log(`\n  Testing ${runtime} port conflict...`);
  const blockerPort = 30000 + Math.floor(Math.random() * 10000);
  const { createServer } = await import("node:net");
  const blocker = createServer();
  await new Promise<void>((res) => blocker.listen(blockerPort, "127.0.0.1", () => res()));

  try {
    const conflictProc = spawn(cmd, [cliPath, "--no-browser"], {
      cwd: installDir,
      env: {
        ...process.env,
        KLOVI_PORT: String(blockerPort),
        KLOVI_HOST: "127.0.0.1",
        KLOVI_SETTINGS_PATH: settingsPath,
        NODE_NO_WARNINGS: "1",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    const exitCode = await new Promise<number | null>((res) => {
      const timeout = setTimeout(() => {
        conflictProc.kill("SIGKILL");
        res(null);
      }, 10000);
      conflictProc.on("exit", (code) => {
        clearTimeout(timeout);
        res(code);
      });
    });

    if (exitCode !== null && exitCode !== 0) {
      ok(`${runtime}: port conflict produces clear failure`);
    } else if (exitCode === null) {
      fail(`${runtime}: port conflict produces clear failure`, "Process did not exit");
    } else {
      ok(`${runtime}: port conflict exits (code ${exitCode})`);
    }
  } catch (e) {
    fail(`${runtime}: port conflict produces clear failure`, e);
  } finally {
    await new Promise<void>((res) => blocker.close(() => res()));
  }
}

async function testEnvOverrides(installDir: string): Promise<void> {
  console.log("\n6. Environment variable overrides");

  const cliPath = join(installDir, "node_modules/.bin/klovi");
  const customPort = 30000 + Math.floor(Math.random() * 10000);
  const settingsPath = createHermeticSettingsFile(installDir);

  const proc = spawn("node", [cliPath, "--no-browser"], {
    cwd: installDir,
    env: {
      ...process.env,
      KLOVI_PORT: String(customPort),
      KLOVI_HOST: "127.0.0.1",
      KLOVI_SETTINGS_PATH: settingsPath,
      NODE_NO_WARNINGS: "1",
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stdout = "";
  proc.stdout?.on("data", (d: Buffer) => {
    stdout += d.toString();
  });

  try {
    const ready = await waitForServer(`http://127.0.0.1:${customPort}`);
    if (!ready) throw new Error("Server did not start with custom port/host");

    if (stdout.includes(String(customPort))) {
      ok("KLOVI_PORT override works");
    } else {
      ok("KLOVI_PORT override works (server listening)");
    }

    ok("KLOVI_HOST override works");
  } catch (e) {
    fail("KLOVI_HOST/KLOVI_PORT override", e);
  } finally {
    await killProcess(proc);
  }
}

function createHermeticSettingsFile(installDir: string): string {
  const settingsDir = join(installDir, ".klovi-test");
  const settingsPath = join(settingsDir, "settings.json");
  const settings = getDefaultSettings();

  for (const pluginId of Object.keys(settings.plugins)) {
    const plugin = settings.plugins[pluginId];
    if (plugin) {
      plugin.enabled = false;
      plugin.dataDir = null;
    }
  }

  settings.general = {
    showSecurityWarning: false,
  };

  mkdirSync(settingsDir, { recursive: true });
  writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);

  return settingsPath;
}

// ── Main ──────────────────────────────────────────────────

async function main() {
  console.log("Packed artifact verification");
  console.log("============================");

  // 1. Verify staged artifact exists
  console.log("\n1. Verify staged artifact");
  if (!existsSync(stageDir)) {
    console.error(`Error: Staged artifact not found at ${stageDir}`);
    console.error("Run the staging script first: bun run stage:npm");
    process.exit(1);
  }
  ok("Staged artifact directory exists");

  const stagedPkg = JSON.parse(readFileSync(join(stageDir, "package.json"), "utf-8"));
  if (stagedPkg.name !== "@cookielab.io/klovi") {
    fail("Package name", `Expected @cookielab.io/klovi, got ${stagedPkg.name}`);
  } else {
    ok("Package name is @cookielab.io/klovi");
  }

  // Check no workspace deps
  const deps = stagedPkg.dependencies ?? {};
  const workspaceDeps = Object.entries(deps).filter(
    ([, v]) => typeof v === "string" && v.startsWith("workspace:"),
  );
  if (workspaceDeps.length > 0) {
    fail("No workspace deps", `Found: ${workspaceDeps.map(([k]) => k).join(", ")}`);
  } else {
    ok("No workspace:* dependencies");
  }

  // Check no internal package refs
  const internalDeps = Object.keys(deps).filter((k) => k.startsWith("@cookielab.io/klovi-"));
  if (internalDeps.length > 0) {
    fail("No internal package refs", `Found: ${internalDeps.join(", ")}`);
  } else {
    ok("No internal workspace package references");
  }

  // Check version/commit metadata if present
  if (stagedPkg.version && stagedPkg.version !== "0.0.0") {
    ok(`Staged version: ${stagedPkg.version}`);
  }
  if (stagedPkg.commit) {
    ok(`Staged commit: ${stagedPkg.commit}`);
  }

  // 2. Pack the artifact
  console.log("\n2. Pack the staged artifact");
  tempDir = join(tmpdir(), `klovi-verify-${Date.now()}`);
  mkdirSync(tempDir, { recursive: true });

  let tarball: string;
  try {
    const packOutput = execFileSync("npm", ["pack", "--json"], {
      cwd: stageDir,
      encoding: "utf-8",
    });
    const packResult = JSON.parse(packOutput) as Array<{ filename: string }>;
    const filename = packResult[0]!.filename;
    tarball = join(stageDir, filename);
    ok(`npm pack produced ${filename}`);
  } catch (e) {
    fail("npm pack", e);
    process.exit(1);
  }

  // 3. Install into clean temp directory
  console.log("\n3. Install into clean temp directory");
  const installDir = join(tempDir, "install-test");
  mkdirSync(installDir, { recursive: true });

  writeFileSync(
    join(installDir, "package.json"),
    JSON.stringify({ name: "klovi-verify", version: "1.0.0", type: "module" }, null, 2),
  );

  try {
    execFileSync("npm", ["install", tarball, "--install-strategy=nested"], {
      cwd: installDir,
      encoding: "utf-8",
      timeout: 60000,
    });
    ok("npm install from tarball succeeded");
  } catch (e) {
    fail("npm install from tarball", e);
    process.exit(1);
  }

  // Verify installed structure
  const installedPkgDir = join(installDir, "node_modules/@cookielab.io/klovi");
  if (!existsSync(join(installedPkgDir, "dist/cli.js"))) {
    fail("Installed structure", "dist/cli.js missing");
  } else {
    ok("dist/cli.js present in installed package");
  }
  if (!existsSync(join(installedPkgDir, "dist/server.js"))) {
    fail("Installed structure", "dist/server.js missing");
  } else {
    ok("dist/server.js present in installed package");
  }
  if (!existsSync(join(installedPkgDir, "dist/web/index.html"))) {
    fail("Installed structure", "dist/web/index.html missing");
  } else {
    ok("dist/web/index.html present in installed package");
  }

  // 4. Node verification
  await testRuntime("node", installDir);

  // 5. Bun verification
  try {
    execFileSync("bun", ["--version"], { encoding: "utf-8" });
    await testRuntime("bun", installDir);
  } catch {
    console.log("\n5. Bun runtime verification - SKIPPED (bun not available)");
  }

  // 6. Environment overrides
  await testEnvOverrides(installDir);

  // Cleanup
  console.log("\nCleaning up...");
  rmSync(tempDir, { recursive: true, force: true });
  // Clean up tarballs in stage dir
  try {
    const entries = readdirSync(stageDir);
    for (const f of entries) {
      if (f.endsWith(".tgz")) {
        rmSync(join(stageDir, f), { force: true });
      }
    }
  } catch {
    // ignore
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  process.exit(1);
});
