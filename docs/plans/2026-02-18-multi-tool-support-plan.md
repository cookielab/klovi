# Multi-Tool Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform Klovi from a Claude Code-only viewer into a universal AI coding session viewer with a plugin system supporting Claude Code, Codex CLI, and OpenCode.

**Architecture:** Plugin system with runtime registration. Each tool is a plugin that implements discovery, parsing, and UI contributions. A `PluginRegistry` aggregates projects by resolved filesystem path and merges sessions into unified timelines. See `docs/plans/2026-02-18-multi-tool-support-design.md` for the full design.

**Tech Stack:** Bun, React 19, TypeScript strict mode, `bun:sqlite` (for OpenCode), plain CSS

---

## Phase 1: Plugin Interface & Registry (Foundation)

### Task 1: Define Plugin Types

**Files:**
- Create: `src/shared/plugin-types.ts`

**Step 1: Write the plugin type definitions**

Create the shared plugin type definitions that both server and frontend will use:

```typescript
// src/shared/plugin-types.ts
import type { Project, Session, SessionSummary } from "./types.ts";

export interface PluginProject {
  pluginId: string;
  nativeId: string;              // plugin-specific identifier (e.g., encoded path for Claude)
  resolvedPath: string;          // canonical filesystem path
  displayName: string;
  sessionCount: number;
  lastActivity: string;
}

export interface MergedProject {
  encodedPath: string;           // URL-safe identifier (derived from resolvedPath)
  resolvedPath: string;
  name: string;
  fullPath: string;
  sessionCount: number;
  lastActivity: string;
  sources: Array<{
    pluginId: string;
    nativeId: string;
  }>;
}

export interface Badge {
  label: string;
  className: string;
}

export interface ToolPlugin {
  id: string;
  displayName: string;

  getDefaultDataDir(): string | null;
  discoverProjects(): Promise<PluginProject[]>;
  listSessions(nativeId: string): Promise<SessionSummary[]>;
  loadSession(nativeId: string, sessionId: string): Promise<Session>;

  getResumeCommand?(sessionId: string): string | null;
  getSessionBadges?(session: SessionSummary): Badge[];
}
```

**Step 2: Add `pluginId` to `SessionSummary` and `Session` in shared types**

Modify `src/shared/types.ts`:
- Add `pluginId?: string` to `SessionSummary` (line 17, after `sessionType`)
- Add `pluginId?: string` to `Session` (line 25, after `implSessionId`)
- Add `pluginId?: string` to `GlobalSessionResult` (line 108, after `projectName`)

**Step 3: Run checks**

Run: `bun run check && bun run typecheck && bun test`
Expected: All pass (new file, additive type changes only)

**Step 4: Commit**

```bash
git add src/shared/plugin-types.ts src/shared/types.ts
git commit -m "feat: define plugin type system for multi-tool support"
```

---

### Task 2: Create Plugin Registry

**Files:**
- Create: `src/server/plugin-registry.ts`
- Create: `src/server/plugin-registry.test.ts`

**Step 1: Write the failing test**

```typescript
// src/server/plugin-registry.test.ts
import { beforeEach, describe, expect, test } from "bun:test";
import type { PluginProject, ToolPlugin } from "../shared/plugin-types.ts";
import type { Session, SessionSummary } from "../shared/types.ts";
import { PluginRegistry } from "./plugin-registry.ts";

function createMockPlugin(id: string, projects: PluginProject[]): ToolPlugin {
  return {
    id,
    displayName: id,
    getDefaultDataDir: () => null,
    discoverProjects: async () => projects,
    listSessions: async () => [],
    loadSession: async (_nativeId: string, sessionId: string): Promise<Session> => ({
      sessionId,
      project: "",
      turns: [],
    }),
  };
}

describe("PluginRegistry", () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry();
  });

  test("register and retrieve a plugin", () => {
    const plugin = createMockPlugin("test", []);
    registry.register(plugin);
    expect(registry.getPlugin("test")).toBe(plugin);
  });

  test("getAllPlugins returns all registered", () => {
    registry.register(createMockPlugin("a", []));
    registry.register(createMockPlugin("b", []));
    expect(registry.getAllPlugins()).toHaveLength(2);
  });

  test("getPlugin throws for unknown id", () => {
    expect(() => registry.getPlugin("unknown")).toThrow();
  });

  test("discoverAllProjects merges by resolvedPath", async () => {
    registry.register(
      createMockPlugin("tool-a", [
        {
          pluginId: "tool-a",
          nativeId: "native-a",
          resolvedPath: "/Users/dev/project",
          displayName: "project",
          sessionCount: 2,
          lastActivity: "2025-01-01T00:00:00Z",
        },
      ]),
    );
    registry.register(
      createMockPlugin("tool-b", [
        {
          pluginId: "tool-b",
          nativeId: "native-b",
          resolvedPath: "/Users/dev/project",
          displayName: "project",
          sessionCount: 3,
          lastActivity: "2025-01-02T00:00:00Z",
        },
      ]),
    );

    const merged = await registry.discoverAllProjects();
    expect(merged).toHaveLength(1);
    expect(merged[0]!.sources).toHaveLength(2);
    expect(merged[0]!.sessionCount).toBe(5);
    expect(merged[0]!.lastActivity).toBe("2025-01-02T00:00:00Z");
    expect(merged[0]!.resolvedPath).toBe("/Users/dev/project");
  });

  test("listAllSessions aggregates from all sources with pluginId", async () => {
    const sessionsA: SessionSummary[] = [
      {
        sessionId: "s1",
        timestamp: "2025-01-01T00:00:00Z",
        slug: "",
        firstMessage: "Hello",
        model: "claude-opus-4-6",
        gitBranch: "main",
        pluginId: "tool-a",
      },
    ];
    const sessionsB: SessionSummary[] = [
      {
        sessionId: "s2",
        timestamp: "2025-01-02T00:00:00Z",
        slug: "",
        firstMessage: "World",
        model: "gpt-4o",
        gitBranch: "main",
        pluginId: "tool-b",
      },
    ];

    const pluginA: ToolPlugin = {
      ...createMockPlugin("tool-a", []),
      listSessions: async () => sessionsA,
    };
    const pluginB: ToolPlugin = {
      ...createMockPlugin("tool-b", []),
      listSessions: async () => sessionsB,
    };

    registry.register(pluginA);
    registry.register(pluginB);

    const merged = {
      encodedPath: "enc",
      resolvedPath: "/dev/project",
      name: "project",
      fullPath: "/dev/project",
      sessionCount: 2,
      lastActivity: "",
      sources: [
        { pluginId: "tool-a", nativeId: "a" },
        { pluginId: "tool-b", nativeId: "b" },
      ],
    };

    const sessions = await registry.listAllSessions(merged);
    expect(sessions).toHaveLength(2);
    // Sorted by timestamp descending
    expect(sessions[0]!.sessionId).toBe("s2");
    expect(sessions[0]!.pluginId).toBe("tool-b");
    expect(sessions[1]!.sessionId).toBe("s1");
    expect(sessions[1]!.pluginId).toBe("tool-a");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/server/plugin-registry.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
// src/server/plugin-registry.ts
import type { MergedProject, PluginProject, ToolPlugin } from "../shared/plugin-types.ts";
import type { SessionSummary } from "../shared/types.ts";

function encodeResolvedPath(resolvedPath: string): string {
  // Convert /Users/foo/bar → -Users-foo-bar (same scheme as Claude Code)
  if (resolvedPath.startsWith("/")) {
    return resolvedPath.replace(/\//g, "-");
  }
  return resolvedPath.replace(/[/\\:]/g, "-");
}

export class PluginRegistry {
  private plugins = new Map<string, ToolPlugin>();

  register(plugin: ToolPlugin): void {
    this.plugins.set(plugin.id, plugin);
  }

  getPlugin(id: string): ToolPlugin {
    const plugin = this.plugins.get(id);
    if (!plugin) throw new Error(`Plugin not found: ${id}`);
    return plugin;
  }

  getAllPlugins(): ToolPlugin[] {
    return [...this.plugins.values()];
  }

  async discoverAllProjects(): Promise<MergedProject[]> {
    const allProjects: PluginProject[] = [];
    for (const plugin of this.plugins.values()) {
      try {
        const projects = await plugin.discoverProjects();
        allProjects.push(...projects);
      } catch {
        // Plugin discovery failed, skip it
      }
    }

    // Group by resolvedPath
    const byPath = new Map<string, PluginProject[]>();
    for (const p of allProjects) {
      const existing = byPath.get(p.resolvedPath) ?? [];
      existing.push(p);
      byPath.set(p.resolvedPath, existing);
    }

    // Merge into MergedProject
    const merged: MergedProject[] = [];
    for (const [resolvedPath, projects] of byPath) {
      const totalSessions = projects.reduce((sum, p) => sum + p.sessionCount, 0);
      const latestActivity = projects
        .map((p) => p.lastActivity)
        .sort()
        .pop() ?? "";

      merged.push({
        encodedPath: encodeResolvedPath(resolvedPath),
        resolvedPath,
        name: resolvedPath,
        fullPath: resolvedPath,
        sessionCount: totalSessions,
        lastActivity: latestActivity,
        sources: projects.map((p) => ({
          pluginId: p.pluginId,
          nativeId: p.nativeId,
        })),
      });
    }

    merged.sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
    return merged;
  }

  async listAllSessions(project: MergedProject): Promise<SessionSummary[]> {
    const allSessions: SessionSummary[] = [];

    for (const source of project.sources) {
      const plugin = this.plugins.get(source.pluginId);
      if (!plugin) continue;
      try {
        const sessions = await plugin.listSessions(source.nativeId);
        allSessions.push(...sessions);
      } catch {
        // Plugin session listing failed, skip it
      }
    }

    allSessions.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return allSessions;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/server/plugin-registry.test.ts`
Expected: All pass

**Step 5: Run full checks**

Run: `bun run check && bun run typecheck && bun test`

**Step 6: Commit**

```bash
git add src/server/plugin-registry.ts src/server/plugin-registry.test.ts
git commit -m "feat: implement PluginRegistry with project merging and session aggregation"
```

---

## Phase 2: Extract Claude Code Plugin

### Task 3: Create Claude Code Plugin — Discovery

Move project/session discovery from `claude-dir.ts` into a plugin. The original `claude-dir.ts` stays temporarily as a thin wrapper to avoid breaking existing imports.

**Files:**
- Create: `src/server/plugins/claude-code/discovery.ts`
- Create: `src/server/plugins/claude-code/discovery.test.ts`
- Modify: `src/server/config.ts` — add `getClaudeCodeProjectsDir()` helper

**Step 1: Write the discovery module**

Extract project discovery logic from `src/server/parser/claude-dir.ts` into `src/server/plugins/claude-code/discovery.ts`. The module must:
- Export `discoverClaudeProjects()` → returns `PluginProject[]` with `pluginId: "claude-code"`
- Export `listClaudeSessions(nativeId: string)` → returns `SessionSummary[]` with `pluginId: "claude-code"`
- Reuse existing functions: `extractSessionMeta`, `extractCwd`, `decodeEncodedPath`, `classifySessionTypes`
- The `resolvedPath` for each project comes from `extractCwd` (reads the first session's `cwd` field) or `decodeEncodedPath` as fallback
- The `nativeId` is the encoded directory name (e.g., `-Users-foo-Workspace-bar`)

**Step 2: Write tests**

Port relevant tests from `src/server/parser/claude-dir.test.ts` — the `classifySessionTypes` and `aggregateSessions` tests should still pass. Add a new test verifying that `pluginId` is set to `"claude-code"` on returned sessions.

**Step 3: Run checks**

Run: `bun run check && bun run typecheck && bun test`

**Step 4: Commit**

```bash
git add src/server/plugins/claude-code/
git commit -m "feat: extract Claude Code discovery into plugin module"
```

---

### Task 4: Create Claude Code Plugin — Parser

**Files:**
- Create: `src/server/plugins/claude-code/parser.ts`
- Modify: `src/server/parser/session.ts` — re-export from new location (temporary compatibility)

**Step 1: Move session parsing into plugin**

Move the parsing logic from `src/server/parser/session.ts` into `src/server/plugins/claude-code/parser.ts`. This includes:
- `parseSession()` → becomes `loadClaudeSession(nativeId, sessionId)`
- `parseSubAgentSession()` → stays as Claude-specific feature
- All helper functions: `buildTurns`, `extractSubAgentMap`, `extractSlug`, `findPlanSessionId`, `findImplSessionId`, `readJsonlLines`, etc.
- The `RawLine` and related types stay in `src/server/parser/types.ts` (they may be reused by Codex CLI)

**Step 2: Update `src/server/parser/session.ts` to re-export from new location**

```typescript
// src/server/parser/session.ts — temporary compatibility re-exports
export { loadClaudeSession as parseSession } from "../plugins/claude-code/parser.ts";
export { parseSubAgentSession } from "../plugins/claude-code/parser.ts";
export { buildTurns, extractSubAgentMap, extractSlug, findPlanSessionId, findImplSessionId } from "../plugins/claude-code/parser.ts";
```

**Step 3: Verify existing tests pass**

Run: `bun test src/server/parser/session.test.ts`
Expected: All existing tests pass without modification

**Step 4: Run full checks**

Run: `bun run check && bun run typecheck && bun test`

**Step 5: Commit**

```bash
git add src/server/plugins/claude-code/parser.ts src/server/parser/session.ts
git commit -m "refactor: move session parser into Claude Code plugin"
```

---

### Task 5: Create Claude Code Plugin — Index (Registration)

**Files:**
- Create: `src/server/plugins/claude-code/index.ts`
- Create: `src/server/plugins/claude-code/index.test.ts`

**Step 1: Write the plugin entry point**

```typescript
// src/server/plugins/claude-code/index.ts
import type { ToolPlugin } from "../../../shared/plugin-types.ts";
import { getClaudeCodeDir } from "../../config.ts";
import { discoverClaudeProjects, listClaudeSessions } from "./discovery.ts";
import { loadClaudeSession } from "./parser.ts";

export const claudeCodePlugin: ToolPlugin = {
  id: "claude-code",
  displayName: "Claude Code",

  getDefaultDataDir: () => getClaudeCodeDir(),

  discoverProjects: () => discoverClaudeProjects(),

  listSessions: (nativeId: string) => listClaudeSessions(nativeId),

  loadSession: (nativeId: string, sessionId: string) =>
    loadClaudeSession(nativeId, sessionId),

  getResumeCommand: (sessionId: string) => `claude --resume ${sessionId}`,
};
```

**Step 2: Write test**

Test that the plugin object has correct `id`, `displayName`, and that `getResumeCommand` returns expected format.

**Step 3: Run checks**

Run: `bun run check && bun run typecheck && bun test`

**Step 4: Commit**

```bash
git add src/server/plugins/claude-code/index.ts src/server/plugins/claude-code/index.test.ts
git commit -m "feat: create Claude Code plugin entry point with registration"
```

---

## Phase 3: Config & CLI Changes

### Task 6: Update Config for Multi-Tool Support

**Files:**
- Modify: `src/server/config.ts`
- Modify: `src/server/config.test.ts`

**Step 1: Write failing tests for new config functions**

Add tests for:
- `getCodexCliDir()` returns default `~/.codex`
- `setCodexCliDir()` overrides the directory
- `getOpenCodeDir()` returns default `~/.local/share/opencode`
- `setOpenCodeDir()` overrides the directory
- Existing `getClaudeCodeDir` tests remain unchanged

**Step 2: Implement new config functions**

Add to `src/server/config.ts`:

```typescript
import { homedir } from "node:os";
import { join } from "node:path";

// Existing Claude Code config stays
let claudeCodeDir = join(homedir(), ".claude");
// ... existing functions ...

// Codex CLI
let codexCliDir = join(homedir(), ".codex");

export function getCodexCliDir(): string {
  return codexCliDir;
}

export function setCodexCliDir(dir: string): void {
  codexCliDir = dir;
}

// OpenCode
let openCodeDir = join(homedir(), ".local", "share", "opencode");

export function getOpenCodeDir(): string {
  return openCodeDir;
}

export function setOpenCodeDir(dir: string): void {
  openCodeDir = dir;
}
```

**Step 3: Run checks**

Run: `bun run check && bun run typecheck && bun test`

**Step 4: Commit**

```bash
git add src/server/config.ts src/server/config.test.ts
git commit -m "feat: add Codex CLI and OpenCode directory config"
```

---

### Task 7: Update CLI Args for Multi-Tool Flags

**Files:**
- Modify: `src/server/cli.ts`
- Modify: `src/server/cli.test.ts`

**Step 1: Write failing tests for new CLI flags**

Add tests for:
- `parseCliArgs(["--codex-cli-dir", "/tmp/codex"])` sets Codex CLI dir
- `parseCliArgs(["--opencode-dir", "/tmp/opencode"])` sets OpenCode dir
- `--claude-code-dir` continues to work unchanged
- All three can be combined
- Error on missing path argument for each

**Step 2: Implement CLI flag parsing**

Add to `parseCliArgs()` in `src/server/cli.ts`:

```typescript
const codexCliDirIdx = argv.indexOf("--codex-cli-dir");
if (codexCliDirIdx !== -1) {
  const dir = argv[codexCliDirIdx + 1];
  if (!dir || dir.startsWith("-")) {
    console.error("Error: --codex-cli-dir requires a path argument.");
    process.exit(1);
  }
  setCodexCliDir(dir);
}

const opencodeDirIdx = argv.indexOf("--opencode-dir");
if (opencodeDirIdx !== -1) {
  const dir = argv[opencodeDirIdx + 1];
  if (!dir || dir.startsWith("-")) {
    console.error("Error: --opencode-dir requires a path argument.");
    process.exit(1);
  }
  setOpenCodeDir(dir);
}
```

**Step 3: Update help text**

Update `showHelpText()` to list all three directory flags.

**Step 4: Update security warning**

Update `promptSecurityWarning()` to say "Klovi reads AI coding session history" instead of "Claude Code session history" and list the directories being scanned.

**Step 5: Update `index.ts` startup validation**

Change the startup check in `index.ts` from requiring Claude Code dir to exist, to warning when no tool directories are found (but not erroring — auto-discovery may find them).

**Step 6: Run checks**

Run: `bun run check && bun run typecheck && bun test`

**Step 7: Commit**

```bash
git add src/server/cli.ts src/server/cli.test.ts index.ts
git commit -m "feat: add --codex-cli-dir and --opencode-dir CLI flags"
```

---

## Phase 4: Wire Up Registry to API Layer

### Task 8: Create Global Registry Instance & Update API Handlers

**Files:**
- Create: `src/server/registry.ts` (singleton registry instance)
- Modify: `src/server/api/projects.ts`
- Modify: `src/server/api/sessions.ts`
- Modify: `src/server/api/session.ts`
- Modify: `src/server/api/search.ts`
- Modify: `src/server/api/stats.ts`
- Modify: `src/server/api/subagent.ts`
- Modify: `src/server/cli.ts` — `createRoutes()` passes registry

**Step 1: Create the singleton registry**

```typescript
// src/server/registry.ts
import { existsSync } from "node:fs";
import { PluginRegistry } from "./plugin-registry.ts";
import { claudeCodePlugin } from "./plugins/claude-code/index.ts";

export function createRegistry(): PluginRegistry {
  const registry = new PluginRegistry();

  // Auto-discover: register plugins whose data dirs exist
  if (existsSync(claudeCodePlugin.getDefaultDataDir()!)) {
    registry.register(claudeCodePlugin);
  }

  // Codex CLI and OpenCode plugins will be added here in later tasks

  return registry;
}
```

**Step 2: Update API handlers to accept registry**

Each handler function gains a `registry: PluginRegistry` parameter. For example:

`src/server/api/projects.ts`:
```typescript
import type { PluginRegistry } from "../plugin-registry.ts";

export async function handleProjects(registry: PluginRegistry): Promise<Response> {
  const projects = await registry.discoverAllProjects();
  return Response.json({ projects });
}
```

`src/server/api/sessions.ts`:
```typescript
import type { PluginRegistry } from "../plugin-registry.ts";

export async function handleSessions(encodedPath: string, registry: PluginRegistry): Promise<Response> {
  const projects = await registry.discoverAllProjects();
  const project = projects.find((p) => p.encodedPath === encodedPath);
  if (!project) return Response.json({ sessions: [] });
  const sessions = await registry.listAllSessions(project);
  return Response.json({ sessions });
}
```

`src/server/api/session.ts` — the session route needs to parse `pluginId` from the session. Add `pluginId` query param or use compound session IDs:
```typescript
export async function handleSession(
  sessionId: string,
  encodedPath: string,
  registry: PluginRegistry,
): Promise<Response> {
  // Parse compound session ID: "claude-code::abc123"
  const separatorIdx = sessionId.indexOf("::");
  if (separatorIdx === -1) {
    // Fallback: assume Claude Code for backwards compatibility
    return handleClaudeSession(sessionId, encodedPath);
  }
  const pluginId = sessionId.slice(0, separatorIdx);
  const rawSessionId = sessionId.slice(separatorIdx + 2);
  const plugin = registry.getPlugin(pluginId);

  const projects = await registry.discoverAllProjects();
  const project = projects.find((p) => p.encodedPath === encodedPath);
  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });

  const source = project.sources.find((s) => s.pluginId === pluginId);
  if (!source) return Response.json({ error: "Plugin source not found" }, { status: 404 });

  const session = await plugin.loadSession(source.nativeId, rawSessionId);
  session.pluginId = pluginId;
  return Response.json({ session });
}
```

**Step 3: Update `createRoutes()` to create registry and pass it**

```typescript
export function createRoutes(): Route[] {
  const registry = createRegistry();
  return [
    { pattern: "/api/projects", handler: () => handleProjects(registry) },
    // ... pass registry to all handlers
  ];
}
```

**Step 4: Keep backward compatibility**

The Claude Code sub-agent route stays Claude-specific (sub-agents are a Claude Code feature). The handler continues to call `parseSubAgentSession` from the Claude Code plugin directly.

**Step 5: Update existing tests**

Update `src/server/cli.test.ts` route tests to account for new handler signatures.

**Step 6: Run checks**

Run: `bun run check && bun run typecheck && bun test`

**Step 7: Commit**

```bash
git add src/server/registry.ts src/server/api/ src/server/cli.ts src/server/cli.test.ts
git commit -m "feat: wire PluginRegistry into API layer"
```

---

## Phase 5: Frontend Changes

### Task 9: Add `pluginId` to Frontend Session Display

**Files:**
- Modify: `src/frontend/components/project/SessionList.tsx`
- Modify: `src/frontend/components/project/SessionList.test.tsx`

**Step 1: Write failing test**

Add a test that verifies: when a session has `pluginId: "claude-code"`, the sidebar shows "Claude Code" instead of the model name.

**Step 2: Implement the change**

In `SessionList.tsx`, replace the model display (line 53) with the plugin display name:

```tsx
// Before:
{session.model && <span>{shortModel(session.model)} · </span>}

// After:
{session.pluginId && <span className="session-plugin-name">{pluginDisplayName(session.pluginId)} · </span>}
```

Add a helper function:
```typescript
function pluginDisplayName(pluginId: string): string {
  const names: Record<string, string> = {
    "claude-code": "Claude Code",
    "codex-cli": "Codex",
    "opencode": "OpenCode",
  };
  return names[pluginId] ?? pluginId;
}
```

When `pluginId` is not set (backwards compat), fall back to showing the model name as before.

**Step 3: Run checks**

Run: `bun run check && bun run typecheck && bun test`

**Step 4: Commit**

```bash
git add src/frontend/components/project/SessionList.tsx src/frontend/components/project/SessionList.test.tsx
git commit -m "feat: show tool name instead of model in session list sidebar"
```

---

### Task 10: Update Resume Command for Multi-Tool

**Files:**
- Modify: `src/frontend/App.tsx`

**Step 1: Update resume command logic**

Replace the hardcoded `isClaudeModel()` check (line 322) with plugin-aware logic:

```tsx
// Before:
copyCommand={
  view.kind === "session" && isClaudeModel(view.session.model)
    ? `claude --resume ${view.session.sessionId}`
    : undefined
}

// After:
copyCommand={
  view.kind === "session"
    ? getResumeCommand(view.session.pluginId, view.session.sessionId)
    : undefined
}
```

Add helper:
```typescript
function getResumeCommand(pluginId: string | undefined, sessionId: string): string | undefined {
  switch (pluginId) {
    case "claude-code":
      return `claude --resume ${sessionId}`;
    case "codex-cli":
      return `codex resume ${sessionId}`;
    default:
      return undefined;
  }
}
```

**Step 2: Run checks**

Run: `bun run check && bun run typecheck && bun test`

**Step 3: Commit**

```bash
git add src/frontend/App.tsx
git commit -m "feat: plugin-aware resume commands in session header"
```

---

### Task 11: Create Frontend Plugin Registry for Tool Renderers

**Files:**
- Create: `src/frontend/plugin-registry.ts`
- Modify: `src/frontend/components/message/ToolCall.tsx`
- Modify: `src/frontend/components/message/ToolCall.test.tsx`

**Step 1: Extract tool renderers and extractors into frontend registry**

Create `src/frontend/plugin-registry.ts` that exports the renderer maps and extractor maps organized by plugin:

```typescript
// src/frontend/plugin-registry.ts
import type { ToolCallWithResult } from "../shared/types.ts";

export type SummaryExtractor = (input: Record<string, unknown>) => string;
export type InputFormatter = (input: Record<string, unknown>) => string;

export interface FrontendPlugin {
  summaryExtractors: Record<string, SummaryExtractor>;
  inputFormatters: Record<string, InputFormatter>;
}

// All current extractors and formatters become the Claude Code plugin's contribution
// They remain in ToolCall.tsx but are registered under "claude-code"
```

**Step 2: Modify ToolCall.tsx**

The existing `SUMMARY_EXTRACTORS` and `INPUT_FORMATTERS` maps stay as-is for now — they work for Claude Code. The change is:
- `getToolSummary()` and `formatToolInput()` check the session's `pluginId` first, then fall back to the global maps
- Add a `pluginId` prop to `ToolCall` component (passed from parent)

This is a minimal change — the tool renderers stay in `ToolCall.tsx`. Per-plugin custom renderers (for Codex file_change, command_execution) will be added in Phase 6/7.

**Step 3: Run checks**

Run: `bun run check && bun run typecheck && bun test`

**Step 4: Commit**

```bash
git add src/frontend/plugin-registry.ts src/frontend/components/message/ToolCall.tsx src/frontend/components/message/ToolCall.test.tsx
git commit -m "feat: create frontend plugin registry for tool renderers"
```

---

### Task 12: Update Search to Include pluginId

**Files:**
- Modify: `src/server/api/search.ts`
- Modify: `src/frontend/components/search/SearchModal.tsx` (if needed)

**Step 1: Update search handler**

Update `handleSearchSessions()` to use the registry's `discoverAllProjects()` + `listAllSessions()` instead of Claude Code's `listAllSessions()`.

**Step 2: Verify search results include `pluginId`**

Each `GlobalSessionResult` should have `pluginId` set.

**Step 3: Run checks**

Run: `bun run check && bun run typecheck && bun test`

**Step 4: Commit**

```bash
git add src/server/api/search.ts
git commit -m "feat: multi-tool session search"
```

---

## Phase 6: Codex CLI Plugin

### Task 13: Create Codex CLI Plugin — Discovery

**Files:**
- Create: `src/server/plugins/codex-cli/discovery.ts`
- Create: `src/server/plugins/codex-cli/discovery.test.ts`

**Step 1: Research Codex CLI session structure**

Codex CLI stores sessions at: `~/.codex/sessions/<provider_id>/<YYYY-MM-DD>/<uuid>.jsonl`

The first line is a `SessionMeta` JSON object with: `uuid`, `name`, `cwd`, `timestamps`, `model`, `provider_id`.

**Step 2: Write failing test**

Test that `discoverCodexProjects()` reads the directory structure and returns `PluginProject[]` with correct `resolvedPath` (from `cwd` in SessionMeta).

Use a temp directory with fixture JSONL files for testing.

**Step 3: Implement discovery**

```typescript
// Scan ~/.codex/sessions/<provider>/<date>/<uuid>.jsonl
// Read first line of each JSONL to get SessionMeta
// Group by cwd to identify projects
// Return PluginProject[] with pluginId: "codex-cli"
```

**Step 4: Run checks**

Run: `bun run check && bun run typecheck && bun test`

**Step 5: Commit**

```bash
git add src/server/plugins/codex-cli/
git commit -m "feat: Codex CLI plugin discovery"
```

---

### Task 14: Create Codex CLI Plugin — Parser

**Files:**
- Create: `src/server/plugins/codex-cli/parser.ts`
- Create: `src/server/plugins/codex-cli/parser.test.ts`

**Step 1: Write failing tests**

Test normalization of Codex events to shared types:
- `agent_message` → text ContentBlock
- `reasoning` → thinking ContentBlock
- `command_execution` → ToolCallWithResult
- `file_change` → ToolCallWithResult
- `mcp_tool_call` → ToolCallWithResult
- `turn.completed` → TokenUsage aggregation
- User messages (turn boundaries)

**Step 2: Implement parser**

Read JSONL file, parse events, build `Turn[]` by grouping events between `turn.started` boundaries. Map each event type to the appropriate shared type.

**Step 3: Run checks**

Run: `bun run check && bun run typecheck && bun test`

**Step 4: Commit**

```bash
git add src/server/plugins/codex-cli/parser.ts src/server/plugins/codex-cli/parser.test.ts
git commit -m "feat: Codex CLI session parser"
```

---

### Task 15: Create Codex CLI Plugin — Renderers & Registration

**Files:**
- Create: `src/server/plugins/codex-cli/index.ts`
- Create: `src/server/plugins/codex-cli/extractors.ts`
- Modify: `src/server/registry.ts` — register Codex CLI plugin
- Modify: `src/frontend/plugin-registry.ts` — add Codex extractors

**Step 1: Create extractors for Codex-specific tool names**

```typescript
// src/server/plugins/codex-cli/extractors.ts
export const codexSummaryExtractors: Record<string, (input: Record<string, unknown>) => string> = {
  command_execution: (i) => truncate(String(i.command || ""), 80),
  file_change: (i) => String(i.path || ""),
  mcp_tool_call: (i) => `${i.server || ""}:${i.tool || ""}`,
};
```

**Step 2: Create plugin entry point**

```typescript
// src/server/plugins/codex-cli/index.ts
export const codexCliPlugin: ToolPlugin = {
  id: "codex-cli",
  displayName: "Codex",
  getDefaultDataDir: () => getCodexCliDir(),
  discoverProjects: () => discoverCodexProjects(),
  listSessions: (nativeId) => listCodexSessions(nativeId),
  loadSession: (nativeId, sessionId) => loadCodexSession(nativeId, sessionId),
  getResumeCommand: (sessionId) => `codex resume ${sessionId}`,
};
```

**Step 3: Register in `src/server/registry.ts`**

Add Codex CLI auto-discovery alongside Claude Code.

**Step 4: Add Codex extractors to frontend registry**

**Step 5: Run checks**

Run: `bun run check && bun run typecheck && bun test`

**Step 6: Commit**

```bash
git add src/server/plugins/codex-cli/ src/server/registry.ts src/frontend/plugin-registry.ts
git commit -m "feat: register Codex CLI plugin"
```

---

## Phase 7: OpenCode Plugin

### Task 16: Create OpenCode Plugin — Discovery

**Files:**
- Create: `src/server/plugins/opencode/discovery.ts`
- Create: `src/server/plugins/opencode/discovery.test.ts`

**Step 1: Research OpenCode SQLite schema**

OpenCode stores data in `~/.local/share/opencode/opencode.db`. Use `bun:sqlite` to query:
- Sessions table: `id`, `projectID`, `directory`, `title`, `time` (JSON with created/updated)
- Messages table: `sessionID`, `role`, `content`, `modelID`

**Step 2: Write failing test**

Create a test SQLite database with fixture data. Test that `discoverOpenCodeProjects()` returns `PluginProject[]` with `resolvedPath` from the `directory` field.

**Step 3: Implement discovery**

Use `bun:sqlite` to query the SQLite database directly.

**Step 4: Run checks**

Run: `bun run check && bun run typecheck && bun test`

**Step 5: Commit**

```bash
git add src/server/plugins/opencode/
git commit -m "feat: OpenCode plugin discovery via bun:sqlite"
```

---

### Task 17: Create OpenCode Plugin — Parser

**Files:**
- Create: `src/server/plugins/opencode/parser.ts`
- Create: `src/server/plugins/opencode/parser.test.ts`

**Step 1: Write failing tests**

Test normalization of OpenCode data to shared types:
- `MessageV2` (role: user) → UserTurn
- `MessageV2` (role: assistant) → AssistantTurn
- `TextPart` → text ContentBlock
- `ReasoningPart` → thinking ContentBlock
- `ToolPart` → ToolCallWithResult

**Step 2: Implement parser**

Query messages and parts from SQLite, build `Turn[]` from the results.

**Step 3: Run checks**

Run: `bun run check && bun run typecheck && bun test`

**Step 4: Commit**

```bash
git add src/server/plugins/opencode/parser.ts src/server/plugins/opencode/parser.test.ts
git commit -m "feat: OpenCode session parser"
```

---

### Task 18: Create OpenCode Plugin — Registration

**Files:**
- Create: `src/server/plugins/opencode/index.ts`
- Create: `src/server/plugins/opencode/extractors.ts`
- Modify: `src/server/registry.ts`
- Modify: `src/frontend/plugin-registry.ts`

**Step 1: Create plugin entry point and register**

Similar pattern to Codex CLI. Register in `src/server/registry.ts` with auto-discovery.

**Step 2: Run checks**

Run: `bun run check && bun run typecheck && bun test`

**Step 3: Commit**

```bash
git add src/server/plugins/opencode/ src/server/registry.ts src/frontend/plugin-registry.ts
git commit -m "feat: register OpenCode plugin"
```

---

## Phase 8: Cleanup & Documentation

### Task 19: Remove Legacy Compatibility Layer

**Files:**
- Modify: `src/server/parser/claude-dir.ts` — remove, update all imports to use plugin
- Modify: `src/server/parser/session.ts` — remove re-exports, keep only if still needed
- Update all import paths across the codebase

**Step 1: Find all imports of old modules**

Search for: `from "../parser/claude-dir"` and `from "../parser/session"`

**Step 2: Update to new plugin paths or registry calls**

**Step 3: Run checks**

Run: `bun run check && bun run typecheck && bun test`

**Step 4: Commit**

```bash
git commit -m "refactor: remove legacy compatibility layer, use plugins directly"
```

---

### Task 20: Update Documentation

**Files:**
- Modify: `README.md` — update description, screenshots, CLI docs
- Modify: `docs/architecture.md` — document plugin system
- Modify: `docs/components.md` — document sidebar changes
- Modify: `CONTENT_TYPES.md` — add Codex/OpenCode content types

**Step 1: Update all docs to reflect multi-tool support**

Remove "Claude Code" from the tagline. Update CLI documentation. Document the plugin system in architecture docs.

**Step 2: Commit**

```bash
git commit -m "docs: update documentation for multi-tool support"
```

---

### Task 21: Update Stats for Multi-Tool

**Files:**
- Modify: `src/server/parser/stats.ts`
- Modify: `src/server/api/stats.ts`

**Step 1: Update stats to aggregate across all plugins**

The current stats only scan `~/.claude`. Update to scan all registered plugins' data directories, or make stats plugin-contributed.

**Step 2: Run checks**

Run: `bun run check && bun run typecheck && bun test`

**Step 3: Commit**

```bash
git commit -m "feat: aggregate stats across all tool plugins"
```

---

## Execution Order & Dependencies

```
Task 1  (Plugin Types)
  ↓
Task 2  (Plugin Registry)
  ↓
Task 3  (Claude Discovery)  →  Task 4  (Claude Parser)  →  Task 5  (Claude Index)
                                                               ↓
Task 6  (Config)  →  Task 7  (CLI Args)
                        ↓
                   Task 8  (Wire Registry to API)
                        ↓
Task 9  (Sidebar)  ←  Task 10 (Resume)  ←  Task 11 (Frontend Registry)  ←  Task 12 (Search)
                                                               ↓
Task 13 (Codex Discovery)  →  Task 14 (Codex Parser)  →  Task 15 (Codex Registration)
                                                               ↓
Task 16 (OC Discovery)  →  Task 17 (OC Parser)  →  Task 18 (OC Registration)
                                                               ↓
Task 19 (Cleanup)  →  Task 20 (Docs)  →  Task 21 (Stats)
```

Tasks within each phase are sequential. Phases 6 and 7 (Codex CLI and OpenCode) can be done in parallel once Phase 5 is complete.
