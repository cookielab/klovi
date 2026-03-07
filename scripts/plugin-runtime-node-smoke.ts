/**
 * Node runtime smoke test for the plugin layer.
 *
 * Proves that all plugin packages can be imported and exercised under Node
 * with @effect/platform-node providers. Run via:
 *
 *   npx tsx scripts/plugin-runtime-node-smoke.ts
 *
 * Exits 0 on success, 1 on any failure.
 */

import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { claudeCodePlugin } from "@cookielab.io/klovi-plugin-claude-code";
import { codexCliPlugin } from "@cookielab.io/klovi-plugin-codex";
import {
  type PluginConfigShape,
  PluginRegistry,
  makePluginConfigLayer,
} from "@cookielab.io/klovi-plugin-core";
import { openCodePlugin } from "@cookielab.io/klovi-plugin-opencode";
import { NodePluginLayer } from "../apps/server/src/effect/platform-node.ts";
import { Effect, ManagedRuntime } from "effect";

const runtime = ManagedRuntime.make(NodePluginLayer);

function runPlugin<A, E>(
  effect: Effect.Effect<A, E, any>,
  config: PluginConfigShape,
): Promise<A> {
  return runtime.runPromise(
    effect.pipe(Effect.provide(makePluginConfigLayer(config))),
  );
}

function runRegistry<A>(effect: Effect.Effect<A, never, any>): Promise<A> {
  return runtime.runPromise(effect);
}

let passed = 0;
let failed = 0;

function ok(label: string) {
  passed++;
  console.log(`  ✓ ${label}`);
}

function fail(label: string, err: unknown) {
  failed++;
  console.error(`  ✗ ${label}:`, err);
}

// ── Helpers ────────────────────────────────────────────────

const testDir = join(tmpdir(), `klovi-node-smoke-${Date.now()}`);

async function writeJsonl(
  filePath: string,
  lines: Record<string, unknown>[],
): Promise<void> {
  const dir = filePath.substring(0, filePath.lastIndexOf("/"));
  await mkdir(dir, { recursive: true });
  await writeFile(
    filePath,
    lines.map((l) => JSON.stringify(l)).join("\n"),
    "utf-8",
  );
}

// ── Tests ──────────────────────────────────────────────────

async function testPluginImports() {
  console.log("\n1. Plugin imports under Node");
  try {
    if (claudeCodePlugin.id !== "claude-code") throw new Error("bad id");
    ok("claude-code plugin imported");
  } catch (e) {
    fail("claude-code import", e);
  }
  try {
    if (codexCliPlugin.id !== "codex-cli") throw new Error("bad id");
    ok("codex-cli plugin imported");
  } catch (e) {
    fail("codex-cli import", e);
  }
  try {
    if (openCodePlugin.id !== "opencode") throw new Error("bad id");
    ok("opencode plugin imported");
  } catch (e) {
    fail("opencode import", e);
  }
}

async function testRegistryBuild() {
  console.log("\n2. Registry build with Node runtime");
  try {
    const config = { dataDir: testDir };
    const registry = new PluginRegistry();
    registry.register(claudeCodePlugin, config);
    registry.register(codexCliPlugin, config);
    registry.register(openCodePlugin, config);
    ok("registry constructed with three plugins");

    const projects = await runRegistry(registry.discoverAllProjects());
    if (!Array.isArray(projects)) throw new Error("expected array");
    ok(`discoverAllProjects returned ${projects.length} projects`);
  } catch (e) {
    fail("registry build", e);
  }
}

async function testClaudeCodeRoundTrip() {
  console.log("\n3. Claude Code plugin round-trip under Node");
  const config = { dataDir: testDir };
  const projectId = "-Users-dev-project";

  try {
    await writeJsonl(
      join(testDir, "projects", projectId, "smoke-session.jsonl"),
      [
        {
          type: "user",
          uuid: "u1",
          timestamp: "2025-01-14T10:00:00.000Z",
          slug: "test-slug",
          gitBranch: "main",
          cwd: "/Users/dev/project",
          message: {
            role: "user",
            model: "claude-sonnet",
            content: "Hello from Node smoke test",
          },
        },
        {
          type: "assistant",
          uuid: "a1",
          timestamp: "2025-01-14T10:01:00.000Z",
          message: {
            role: "assistant",
            model: "claude-sonnet",
            content: [{ type: "text", text: "Response from smoke test" }],
          },
        },
      ],
    );

    const projects = await runPlugin(claudeCodePlugin.discoverProjects, config);
    if (projects.length === 0) throw new Error("no projects discovered");
    ok(`discovered ${projects.length} project(s)`);

    const sessions = await runPlugin(
      claudeCodePlugin.listSessions(projectId),
      config,
    );
    if (sessions.length === 0) throw new Error("no sessions found");
    ok(`listed ${sessions.length} session(s)`);

    const session = await runPlugin(
      claudeCodePlugin.loadSession(projectId, "smoke-session"),
      config,
    );
    if (session.turns.length === 0) throw new Error("no turns loaded");
    ok(`loaded session with ${session.turns.length} turn(s)`);
  } catch (e) {
    fail("claude-code round-trip", e);
  }
}

async function testOpenCodeImport() {
  console.log("\n4. OpenCode plugin isDataAvailable under Node");
  const config = { dataDir: join(testDir, "nonexistent-opencode") };
  try {
    const available = await runPlugin(openCodePlugin.isDataAvailable, config);
    if (available !== false)
      throw new Error(`expected false, got ${available}`);
    ok("isDataAvailable returns false for missing dir");
  } catch (e) {
    fail("opencode isDataAvailable", e);
  }
}

// ── Main ───────────────────────────────────────────────────

async function main() {
  console.log("Node plugin runtime smoke tests");
  console.log("================================");

  await mkdir(testDir, { recursive: true });

  try {
    await testPluginImports();
    await testRegistryBuild();
    await testClaudeCodeRoundTrip();
    await testOpenCodeImport();
  } finally {
    await rm(testDir, { recursive: true, force: true });
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
