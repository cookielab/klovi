# Plugin Architecture

## Purpose

Klovi plugins are driver packages. Each plugin reads one provider's local data
format and converts it into Klovi's canonical model from `packages/plugin-core`.
The UI should render canonical Klovi data, not provider-specific records.

Built-in driver packages currently live in:

- `packages/plugin-claude-code`
- `packages/plugin-codex`
- `packages/plugin-cursor`
- `packages/plugin-opencode`

`packages/plugin-core` owns shared contracts, registry behavior, session ids,
session types, and common runtime services.

## Boundary Contract

Plugins may:

- discover provider projects and sessions
- load provider transcripts and metadata
- normalize provider data into canonical `Project`, `SessionSummary`, `Session`,
  `Turn`, and tool-call shapes
- expose metadata such as id, display name, default data directory, availability,
  and resume command
- use provider-specific storage APIs, parsers, and runtime dependencies needed
  to read source-of-truth data

Plugins must not:

- export React components, JSX, CSS, DOM behavior, or UI class names
- require `packages/ui` or `packages/ui-components` to branch on provider ids
- require reusable UI to understand raw provider tool names
- expose presentation callbacks as the long-term way to render plugin data
- add caches, memoization layers, TTLs, or cache invalidation logic

Provider-specific interpretation should happen before data crosses from a plugin
into the server/UI boundary.

## Current State

The core driver shape is already in place. The plugin packages parse provider
storage and return shared `SessionSummary` and `Session` objects. They do not
contain React components, JSX, CSS files, or React dependencies.

Known gaps remain around tool rendering:

- `ToolCallWithResult` still contains raw tool names and raw input objects, so
  UI code must infer semantics from provider/tool names.
- `packages/ui-components/src/tools/ToolCallDefaults.ts` contains hardcoded
  tables for names such as `Read`, `Write`, `Edit`, `Bash`, `Task`,
  `WebSearch`, and related tool schemas.
- `FrontendPlugin` supports plugin-provided `summaryExtractors` and
  `inputFormatters`. These are not React components, but they are
  presentation-specific plugin behavior and should become temporary migration
  shims.
- `packages/ui/src/app/components/settings/PluginRow.tsx` special-cases Cursor
  as `Cursor (beta)` instead of receiving that as semantic metadata.
- `Badge` in `packages/plugin-core/src/plugin-types.ts` includes `className`,
  which would allow plugin output to carry UI styling if used.

## Target Tool Model

The UI should branch on canonical semantics instead of raw provider names. A
future `ToolCallWithResult` can keep compatibility fields during migration, but
the rendering contract should look like this:

```ts
type ToolCallKind =
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

type ToolCallWithResult = {
  toolUseId: string;
  kind: ToolCallKind;
  title: string;
  summary?: string;
  input: Record<string, unknown>;
  formattedInput?: string;
  result: string;
  isError: boolean;
  resultImages?: ToolResultImage[];
  subAgentId?: string;
  rawName?: string;
};
```

`rawName` is only for debugging and compatibility. UI should not use it to pick
rendering paths.

## Remediation Plan

1. Define the plugin boundary in docs and tests.
   The contract above should be treated as the architecture rule for future
   plugins and future parser changes.

2. Extend `ToolCallWithResult` in `packages/plugin-core/src/session-types.ts`.
   Add canonical fields such as `kind`, `title`, `summary`, and
   `formattedInput` while temporarily keeping `name` for compatibility.

3. Normalize tool calls in plugin parsers.
   Claude should map tools like `Bash`, `Edit`, `Read`, and `Task` to canonical
   kinds. Codex should map `command_execution`, `file_change`, and `web_search`.
   Cursor and OpenCode should map known shapes where possible and use
   `generic` for unknown provider tools.

4. Refactor reusable tool UI.
   `packages/ui-components/src/tools/ToolCall.tsx` should branch on
   `call.kind`, not raw tool names. Shell tools can use the existing shell
   renderer, file edits can use the diff renderer when normalized old/new
   strings are available, sub-agent tools can render the sub-agent link, and
   generic tools can use JSON/default rendering.

5. Shrink `ToolCallDefaults.ts`.
   Keep only generic fallback behavior that is based on canonical tool
   semantics. Remove provider-shaped formatter tables once parsers emit
   sufficient `summary` and `formattedInput` values.

6. Retire or reduce `FrontendPlugin`.
   First make UI prefer normalized tool fields. Then keep `FrontendPlugin`
   formatters as a compatibility fallback. Finally remove `summaryExtractors`
   and `inputFormatters`, leaving only metadata such as display name and resume
   command if needed.

7. Remove direct plugin-specific UI branches.
   Replace the Cursor beta special case with plugin metadata, for example a
   `status: "beta"` field or a display name supplied by the server descriptor.

8. Remove CSS from plugin contracts.
   Change `Badge` from `{ label, className }` to semantic data such as
   `{ label, tone }`, or delete `getSessionBadges` if it remains unused.

9. Add guardrail tests.
   Tests should assert that plugin packages contain no `.tsx`, `.jsx`, or CSS
   files, do not import React, reusable UI does not branch on built-in provider
   ids, and tool UI does not branch on raw provider tool names.

10. Remove compatibility fields.
    After all plugins emit canonical tool data and UI consumes it, remove legacy
    name-based rendering paths and plugin frontend formatter shims.

## Verification

Any implementation work that changes code must run the full repository checks:

```sh
bun run lint
bun run typecheck
bun test
```

Documentation-only updates do not require the full code verification set.
