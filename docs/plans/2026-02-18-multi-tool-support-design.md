# Multi-Tool Support Design

**Date:** 2026-02-18
**Status:** Approved

## Goal

Make Klovi a universal AI coding session viewer. Support multiple AI coding tools simultaneously, merging sessions from different tools into a unified view per project.

## Initial Scope

Three plugins: **Claude Code**, **Codex CLI**, **OpenCode**. Architecture supports adding more (Copilot, Cursor, Zed) later.

## Architecture: Plugin System with Runtime Registration

### Plugin Interface

```typescript
interface ToolPlugin {
  // Identity
  id: string;                              // "claude-code" | "codex-cli" | "opencode"
  displayName: string;                     // "Claude Code" | "Codex" | "OpenCode"

  // Discovery
  getDefaultDataDir(): string | null;
  discoverProjects(): Promise<Project[]>;
  listSessions(project: Project): Promise<SessionSummary[]>;

  // Parsing
  loadSession(project: Project, sessionId: string): Promise<Session>;

  // Optional: tool-specific features
  getResumeCommand?(sessionId: string): string | null;
  getSessionBadges?(session: SessionSummary): Badge[];
  getLinkedSession?(session: Session): { type: "plan" | "impl"; id: string } | null;

  // Optional: custom UI contributions
  toolRenderers?: Map<string, React.ComponentType<ToolCallProps>>;
  toolSummaryExtractors?: Record<string, (input: Record<string, unknown>) => string>;
}
```

### Plugin Registry

```typescript
class PluginRegistry {
  private plugins: Map<string, ToolPlugin>;

  register(plugin: ToolPlugin): void;
  getPlugin(id: string): ToolPlugin;
  getAllPlugins(): ToolPlugin[];

  discoverAllProjects(): Promise<MergedProject[]>;
  listAllSessions(project: MergedProject): Promise<SessionSummary[]>;
}
```

## Project Merging

Projects matched by **resolved filesystem path** across plugins.

```typescript
interface MergedProject {
  resolvedPath: string;              // /Users/foo/Workspace/bar
  displayName: string;               // "bar"
  sources: Array<{
    pluginId: string;                // "claude-code"
    nativeId: string;                // "-Users-foo-Workspace-bar"
  }>;
}
```

## Unified Session Timeline

Sessions from all plugins appear in a single chronological list per project. Each session carries its `pluginId`.

```typescript
interface SessionSummary {
  sessionId: string;
  firstMessage: string;
  model: string;
  timestamp: number;
  gitBranch?: string;
  pluginId: string;                  // which tool this session comes from
  sessionType?: string;              // "plan" | "implementation" (Claude-specific)
}
```

## Sidebar Display

- **Tool name replaces model name** (e.g., "Claude Code" instead of "Opus 4.6")
- Plan/implementation badges remain as secondary indicators when present

## CLI Configuration

Auto-discover all tools from default locations. Per-tool flags as overrides:

```
klovi                                        # auto-discovers all
klovi --claude-code-dir ~/custom/.claude      # override Claude Code
klovi --codex-cli-dir ~/custom/.codex         # override Codex CLI
klovi --opencode-dir ~/alt/opencode           # override OpenCode
```

## Normalization

All plugins normalize into existing shared types (`Turn`, `ContentBlock`, `ToolCallWithResult`).

### Codex CLI Mapping

| Codex Event | Shared Type |
|---|---|
| `agent_message` | `ContentBlock` type: `"text"` |
| `reasoning` | `ContentBlock` type: `"thinking"` |
| `command_execution` | `ToolCallWithResult` |
| `file_change` | `ToolCallWithResult` |
| `mcp_tool_call` | `ToolCallWithResult` |
| `turn.completed` | Token usage aggregation |
| `SessionMeta` (first line) | `SessionSummary` fields |

### OpenCode Mapping

| OpenCode Entity | Shared Type |
|---|---|
| `MessageV2` (role: user) | User `Turn` |
| `MessageV2` (role: assistant) | Assistant `Turn` |
| `TextPart` | `ContentBlock` type: `"text"` |
| `ReasoningPart` | `ContentBlock` type: `"thinking"` |
| `ToolPart` | `ToolCallWithResult` |
| Session metadata | `SessionSummary` |

## Tool-Specific Features (No Features Dropped)

Tool-specific features preserved via optional fields and plugin contributions:

- **Claude Code:** sub-agents (`subAgentId`), plan/impl classification, resume command, MCP badges, skill badges
- **Codex CLI:** resume command (`codex resume <id>`), todo lists
- **OpenCode:** session sharing, worktree snapshots

Each plugin contributes its own renderers, extractors, badges, and commands through the registry.

## File Structure

```
src/
  server/
    plugin-registry.ts
    plugin-types.ts
    plugins/
      claude-code/
        index.ts                   # plugin registration
        discovery.ts               # from claude-dir.ts
        parser.ts                  # from session.ts
        renderers.tsx              # Bash, Edit, Task renderers
        extractors.ts              # tool summary extractors
      codex-cli/
        index.ts
        discovery.ts               # scans ~/.codex/sessions/
        parser.ts                  # Codex JSONL event parser
        renderers.tsx
        extractors.ts
      opencode/
        index.ts
        discovery.ts               # reads opencode.db via bun:sqlite
        parser.ts                  # SQLite to shared types
        renderers.tsx
        extractors.ts
    config.ts                      # CLI flags, auto-discovery
    routes.ts                      # uses registry instead of direct calls
  frontend/
    plugin-registry.ts             # frontend plugin lookup map
    components/
      message/
        ToolCall.tsx               # dispatcher via registry
        DefaultToolContent.tsx     # fallback renderer
  shared/
    types.ts                       # shared types (minor additions)
    plugin-types.ts                # plugin interface
```

## API Routes

Compound session IDs (`pluginId::sessionId`) for self-contained URLs:

```
GET /api/projects                                          # merged projects
GET /api/projects/:encodedPath/sessions                    # unified timeline
GET /api/projects/:encodedPath/sessions/claude-code::abc   # plugin-specific load
```

Routes unchanged in shape, backed by registry instead of direct Claude Code calls.

## Frontend Plugin Registry

Static imports, no dynamic loading:

```typescript
const plugins = {
  "claude-code": { renderers, extractors, getResumeCommand },
  "codex-cli":   { renderers, extractors },
  "opencode":    { renderers, extractors },
};
```

`ToolCall.tsx` becomes a dispatcher that looks up the session's plugin and delegates rendering.
