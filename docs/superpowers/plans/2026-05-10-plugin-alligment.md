# Plugin Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align Klovi plugins with the driver boundary documented in `docs/plugins.md`: plugin packages read provider-specific data and emit canonical Klovi models, while reusable UI renders canonical semantics instead of branching on provider ids or raw provider tool names.

**Architecture:** This is a staged migration. First extend the canonical tool-call model with semantic fields while keeping legacy fields. Then update each plugin parser to populate those fields. Next move reusable UI from raw tool-name branching to semantic `kind` rendering. Finally remove or shrink the frontend-plugin formatting escape hatch and add guardrail tests so plugin packages stay data-only drivers.

**Tech Stack:** Bun, TypeScript strict mode, Effect 3.21.2, React 19, `bun:test`, `@testing-library/react`, Biome.

**Reference docs:**

- `docs/plugins.md`
- `docs/architecture.md` sections "Backend and Plugin Flow" and "UI Layering"

**Hard constraints:**

- Do not add caching of any kind.
- Do not add React, JSX, CSS, DOM, or UI class-name exports to plugin packages.
- Keep compatibility during migration so existing session data keeps rendering.
- After every code change, run:
  ```sh
  bun run lint
  bun run typecheck
  bun test
  ```

---

## File Structure

### New files

| File | Responsibility |
|---|---|
| `packages/plugin-core/src/plugin-boundary.test.ts` | Guardrail tests that plugin packages do not contain UI files or React imports. |
| `packages/ui-components/src/tools/tool-call-normalization.test.ts` | Guardrail tests around semantic tool rendering and absence of raw provider branches. |

### Modified files

| File | Change |
|---|---|
| `packages/plugin-core/src/session-types.ts` | Add canonical tool-call fields: `kind`, `title`, `summary`, `formattedInput`, `rawName`. Keep `name` temporarily. |
| `packages/plugin-core/src/plugin-types.ts` | Replace badge `className` with semantic `tone`, or delete badge API if unused. |
| `packages/plugin-core/src/index.ts` | Export any new tool-call and badge types. |
| `packages/plugin-claude-code/src/parser.ts` | Normalize Claude Code raw tool names into canonical tool-call kinds and formatted fields. |
| `packages/plugin-codex/src/parser.ts` | Normalize Codex tool events into canonical tool-call kinds and formatted fields. |
| `packages/plugin-cursor/src/parser.ts` | Normalize known Cursor tool shapes and use `generic` for unknown tools. |
| `packages/plugin-opencode/src/parser.ts` | Normalize known OpenCode tool shapes and use `generic` for unknown tools. |
| `packages/plugin-codex/src/frontend.ts` | Remove formatter dependency after parser normalization, or keep as temporary fallback until final cleanup. |
| `packages/plugin-codex/src/extractors.ts` | Delete once no frontend formatter fallback is needed. |
| `packages/plugin-opencode/src/frontend.ts` | Remove empty formatter wiring once `FrontendPlugin` is reduced. |
| `packages/plugin-opencode/src/extractors.ts` | Delete if still empty after `FrontendPlugin` cleanup. |
| `packages/plugin-core/src/frontend-plugin-types.ts` | Reduce `FrontendPlugin` to metadata/resume command after UI no longer needs formatter callbacks. |
| `packages/ui/src/app/plugin-registry.ts` | Adjust registry to reduced `FrontendPlugin` shape. |
| `packages/ui-components/src/tools/ToolCall.tsx` | Render by `call.kind` instead of raw `call.name`. |
| `packages/ui-components/src/tools/ToolCallDefaults.ts` | Remove provider-shaped formatter tables; keep semantic fallback helpers only. |
| `packages/ui-components/src/tools/ToolCallDefaults.test.ts` | Update tests to assert semantic rendering helpers. |
| `packages/ui/src/app/components/settings/PluginRow.tsx` | Remove direct Cursor special case and render plugin metadata generically. |
| `packages/ui/src/shared/rpc-types.ts` | Add semantic plugin metadata if needed, for example `status?: "beta"`. |
| `packages/server/src/services/catalog.ts` | Add plugin metadata such as status/display label if needed. |
| `packages/server/src/services/settings-service.ts` | Include semantic plugin metadata in settings responses. |
| Relevant parser tests | Assert canonical `kind`, `title`, `summary`, `formattedInput`, and `rawName` values. |

### Out of scope

- Adding third-party rendering plugins or plugin-provided React components.
- Changing storage discovery behavior unrelated to tool-call normalization.
- Removing all legacy fields before UI and parser tests prove the migration is complete.
- Changing public package distribution layout except where type exports require it.

---

## Target Model

Add semantic tool-call fields while preserving legacy `name` during migration:

```ts
export type ToolCallKind =
	| "shell"
	| "file_read"
	| "file_write"
	| "file_edit"
	| "search"
	| "web"
	| "subagent"
	| "skill"
	| "mcp"
	| "generic";

export type ToolCallWithResult = {
	toolUseId: string;
	kind: ToolCallKind;
	title: string;
	summary?: string | undefined;
	input: Record<string, unknown>;
	formattedInput?: string | undefined;
	result: string;
	isError: boolean;
	resultImages?: ToolResultImage[] | undefined;
	subAgentId?: string | undefined;

	/** Temporary compatibility/debug field. UI must not render from this. */
	name: string;
	rawName?: string | undefined;
};
```

Rules:

- `kind` drives rendering.
- `title` is the user-facing tool label.
- `summary` is the compact title-row detail.
- `formattedInput` is display text when JSON is not the best representation.
- `input` remains source data for debug/default JSON rendering.
- `name` exists only until all consumers are migrated.

---

## Task 1: Extend Core Types

**Files:**

- Modify: `packages/plugin-core/src/session-types.ts`
- Modify: `packages/plugin-core/src/plugin-types.ts`
- Modify: `packages/plugin-core/src/index.ts`

- [ ] **Step 1: Add `ToolCallKind` and semantic fields**

Update `ToolCallWithResult` in `session-types.ts` with the target model above. Keep `name` required during the first phase so existing plugin parser output remains type-compatible once parser objects are updated.

- [ ] **Step 2: Replace styling badge contract**

Change:

```ts
export type Badge = {
	label: string;
	className: string;
};
```

to:

```ts
export type BadgeTone = "default" | "info" | "warning" | "success";

export type Badge = {
	label: string;
	tone?: BadgeTone | undefined;
};
```

If `getSessionBadges` is still unused across the repo, it is acceptable to delete it instead, but update all exports/tests accordingly.

- [ ] **Step 3: Export new types**

Update `packages/plugin-core/src/index.ts` to export `ToolCallKind` and any new badge tone type.

- [ ] **Step 4: Run focused typecheck**

Run:

```sh
bun run typecheck
```

Expect failures in parser code because semantic tool-call fields are not populated yet. Continue to Task 2.

---

## Task 2: Normalize Plugin Parser Tool Calls

**Files:**

- Modify: `packages/plugin-claude-code/src/parser.ts`
- Modify: `packages/plugin-codex/src/parser.ts`
- Modify: `packages/plugin-cursor/src/parser.ts`
- Modify: `packages/plugin-opencode/src/parser.ts`
- Modify parser tests in each plugin package.

- [ ] **Step 1: Add local helper functions per parser**

Each plugin parser should have a small helper that converts raw provider names and inputs to canonical fields. Keep helpers close to parser code unless duplication becomes meaningful.

Example shape:

```ts
function normalizeToolCall(rawName: string, input: Record<string, unknown>): {
	kind: ToolCallKind;
	title: string;
	summary?: string;
	formattedInput?: string;
} {
	// Provider-specific mapping here.
}
```

- [ ] **Step 2: Normalize Claude Code tools**

Map common Claude tools:

| Raw name | Kind | Title |
|---|---|---|
| `Bash` | `shell` | `Bash` |
| `Read` | `file_read` | `Read` |
| `Write` | `file_write` | `Write` |
| `Edit` | `file_edit` | `Edit` |
| `NotebookRead` | `file_read` | `Notebook Read` |
| `NotebookEdit` | `file_edit` | `Notebook Edit` |
| `Glob` / `Grep` | `search` | raw display name |
| `WebFetch` / `WebSearch` | `web` | raw display name |
| `Skill` | `skill` | skill name if present |
| `Task` with `subAgentId` | `subagent` | `Sub-Agent` |
| `mcp__...` | `mcp` | parsed MCP display name |
| unknown | `generic` | raw name |

Preserve `rawName` and legacy `name`.

- [ ] **Step 3: Normalize Codex tools**

Map known Codex events:

| Raw name | Kind | Title |
|---|---|---|
| `command_execution` | `shell` | `Command` |
| `file_change` | `file_edit` | `File Change` |
| `web_search` | `web` | `Web Search` |
| `mcp__...` | `mcp` | parsed MCP display name |
| unknown | `generic` | raw name |

Move the existing summary/input formatting behavior from `packages/plugin-codex/src/extractors.ts` into parser normalization.

- [ ] **Step 4: Normalize Cursor tools**

Map known Cursor tool names when stable. Use `generic` for unknown tool names. Do not invent detailed mappings without test fixtures. Preserve raw data in `input`.

- [ ] **Step 5: Normalize OpenCode tools**

Map known OpenCode tool names when stable. Use `generic` for unknown tool names. Preserve raw data in `input`.

- [ ] **Step 6: Update parser tests**

Add or update assertions so representative sessions verify:

- `call.kind`
- `call.title`
- `call.summary` where expected
- `call.formattedInput` where expected
- `call.name` and `call.rawName` are still present during migration

- [ ] **Step 7: Run plugin-focused tests**

Run:

```sh
bun test packages/plugin-claude-code packages/plugin-codex packages/plugin-cursor packages/plugin-opencode
```

Fix parser/test failures before moving on.

---

## Task 3: Render Tools by Canonical Semantics

**Files:**

- Modify: `packages/ui-components/src/tools/ToolCall.tsx`
- Modify: `packages/ui-components/src/tools/ToolCallDefaults.ts`
- Modify: `packages/ui-components/src/tools/ToolCallDefaults.test.ts`
- Modify any `ToolCall` tests if present or add coverage where missing.

- [ ] **Step 1: Update `ToolCall` props usage**

Keep accepting `getFrontendPlugin` temporarily, but make `ToolCall` prefer canonical fields on `call`.

- [ ] **Step 2: Replace raw-name rendering branches**

Replace branches like:

```ts
call.name === "Bash"
call.name === "Edit"
call.name === "Task"
call.name.startsWith("mcp__")
```

with branches based on:

```ts
call.kind === "shell"
call.kind === "file_edit"
call.kind === "subagent"
call.kind === "mcp"
```

- [ ] **Step 3: Preserve existing UX**

Shell tools should still use `BashToolContent` or equivalent shell-specific rendering. File edits should still use `DiffView` when normalized old/new strings are available in `input`. Sub-agent links should still route to `#/{project}/{sessionId}/subagent/{subAgentId}`.

- [ ] **Step 4: Shrink `ToolCallDefaults.ts`**

Remove provider-shaped formatter tables once equivalent data comes from `summary` and `formattedInput`. Keep generic helpers for truncating output and JSON fallback.

- [ ] **Step 5: Update tests**

Tests should assert that:

- summary uses `call.summary`
- title uses `call.title`
- formatted input uses `call.formattedInput`
- unknown/generic tools fall back to JSON input
- shell/file-edit/subagent rendering is selected by `kind`

---

## Task 4: Reduce Frontend Plugin Integration

**Files:**

- Modify: `packages/plugin-core/src/frontend-plugin-types.ts`
- Modify: `packages/ui/src/app/plugin-registry.ts`
- Modify: `packages/ui/src/app/plugin-registry.test.ts`
- Modify: plugin package `frontend.ts` files.
- Delete: `packages/plugin-codex/src/extractors.ts` and tests if no longer used.
- Delete: `packages/plugin-opencode/src/extractors.ts` if still empty and no longer used.

- [ ] **Step 1: Remove formatter callbacks from `FrontendPlugin`**

Target:

```ts
export type FrontendPlugin = {
	id: string;
	displayName: string;
	getResumeCommand?: (sessionId: string) => string | null;
};
```

- [ ] **Step 2: Update frontend plugin exports**

Each `frontend.ts` should export only metadata and optional resume command. No summary extractors or input formatters should remain.

- [ ] **Step 3: Delete unused extractor modules**

Remove extractor files and tests once imports are gone.

- [ ] **Step 4: Update registry tests**

Keep tests for built-in plugin registration and resume commands. Remove formatter expectations.

---

## Task 5: Remove Direct Plugin-Specific UI Branches

**Files:**

- Modify: `packages/ui/src/app/components/settings/PluginRow.tsx`
- Modify: `packages/ui/src/shared/rpc-types.ts`
- Modify: `packages/server/src/services/catalog.ts`
- Modify: `packages/server/src/services/settings-service.ts`
- Modify relevant settings tests.

- [ ] **Step 1: Add semantic plugin metadata if needed**

If Cursor should remain visually marked as beta, add a generic metadata field:

```ts
type PluginSettingInfo = {
	id: string;
	displayName: string;
	status?: "beta" | undefined;
	// existing fields...
};
```

Add `status: "beta"` to the Cursor descriptor in `catalog.ts`.

- [ ] **Step 2: Render metadata generically**

Replace:

```ts
plugin.id === "cursor" ? "Cursor (beta)" : plugin.displayName
```

with either `plugin.displayName` or a generic status badge/string derived from `plugin.status`.

- [ ] **Step 3: Add/update tests**

Settings tests should prove beta status renders without hardcoding Cursor id in the component.

---

## Task 6: Add Guardrail Tests

**Files:**

- Create: `packages/plugin-core/src/plugin-boundary.test.ts`
- Create: `packages/ui-components/src/tools/tool-call-normalization.test.ts`

- [ ] **Step 1: Guard plugin packages against UI files**

Test that these package `src` trees contain no `.tsx`, `.jsx`, `.css`, `.scss`, `.sass`, or `.less` files:

- `packages/plugin-core/src`
- `packages/plugin-claude-code/src`
- `packages/plugin-codex/src`
- `packages/plugin-cursor/src`
- `packages/plugin-opencode/src`

- [ ] **Step 2: Guard plugin packages against React imports**

Scan plugin source files and fail if they import `react`, reference JSX runtime imports, or include obvious JSX syntax.

- [ ] **Step 3: Guard reusable UI against provider-id branching**

Fail if `packages/ui-components/src` contains branches against built-in provider ids:

- `claude-code`
- `codex-cli`
- `cursor`
- `opencode`

Allow those strings in tests only when testing the guard itself.

- [ ] **Step 4: Guard tool UI against raw provider tool branches**

Fail if `ToolCall.tsx` branches on raw names such as `Bash`, `Edit`, `Task`, `command_execution`, `file_change`, or `web_search`. The UI may display `rawName` for debug fallback, but must not use it to choose rendering.

---

## Task 7: Final Compatibility Cleanup

Only do this after Tasks 1-6 are green.

- [ ] **Step 1: Remove legacy `name` rendering dependency**

Search for `call.name` across the repo. It should only be used by plugin parsers when setting compatibility data or by debug/fallback code. Remove UI rendering decisions based on it.

- [ ] **Step 2: Decide whether to keep `name` in the public model**

If tests prove all consumers use `kind`, remove `name` from `ToolCallWithResult` and keep only `rawName`. Otherwise keep `name` but document it as compatibility-only.

- [ ] **Step 3: Update docs**

Update `docs/plugins.md` to reflect the implemented state, not the planned state. If `FrontendPlugin` was reduced, remove language describing formatter shims as current behavior.

---

## Verification Checklist

Run the full required verification after all implementation changes:

```sh
bun run lint
bun run typecheck
bun test
```

Also run targeted checks during development:

```sh
bun test packages/plugin-core
bun test packages/plugin-claude-code
bun test packages/plugin-codex
bun test packages/plugin-cursor
bun test packages/plugin-opencode
bun test packages/ui-components/src/tools
bun test packages/ui/src/app/plugin-registry.test.ts
```

All checks must pass before the work is considered complete.
