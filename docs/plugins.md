# Plugin Architecture

## Purpose

Klovi plugins are driver packages. Each plugin reads one provider's local data
format and converts it into Klovi's canonical model from `packages/plugin-core`.
The UI renders canonical Klovi data, not provider-specific records.

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

The plugin architecture is fully migrated to the canonical tool model. All four
plugin packages parse provider storage and return shared `SessionSummary` and
`Session` objects. They contain no React components, JSX, CSS files, or React
dependencies.

### Tool model

Every `ToolCallWithResult` now carries canonical semantic fields set by the
plugin parser:

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
  /** Raw provider tool name before normalization. Debug/diagnostic only; UI must not branch on this. */
  rawName?: string;
};
```

The legacy `name` field was removed in Task 7. `rawName` is the only
debug/diagnostic field remaining and is optional — some generic tool calls may
not have a meaningful raw provider name.

UI code branches on `kind`, not on raw tool names. `ToolCall.tsx` dispatches on
`kind` to choose the shell renderer, diff renderer, sub-agent link, or generic
fallback.

### ToolCallDefaults.ts

`packages/ui-components/src/tools/ToolCallDefaults.ts` is a thin pass-through.
The hardcoded per-provider formatter tables were removed once all parsers emitted
`summary` and `formattedInput` directly.

### FrontendPlugin

`FrontendPlugin` in `packages/plugin-core/src/plugin-types.ts` is now metadata
and optional resume command only. The `summaryExtractors` and `inputFormatters`
shims were removed once plugin parsers produced canonical fields.

### Plugin status and display name

Plugin status (e.g. `beta`) and display name are driven by server metadata. The
UI uses `plugin.status === "beta"` from the server descriptor rather than
special-casing provider ids in components.

## Implementation History

1. **Plugin boundary defined** — Contracts documented; plugins may not export
   React, JSX, or CSS; UI may not branch on provider ids or raw tool names.

2. **`ToolCallWithResult` extended** — Added `kind`, `title`, `summary`, and
   `formattedInput` fields in `packages/plugin-core/src/session-types.ts`.

3. **Plugin parsers normalized** — All four parsers (`plugin-claude-code`,
   `plugin-codex`, `plugin-cursor`, `plugin-opencode`) map known provider tool
   names to canonical kinds and emit `summary` and `formattedInput`.

4. **UI refactored to branch on `kind`** — `ToolCall.tsx` dispatches on
   `call.kind`, not raw tool names. Shell, file-edit (diff), sub-agent, and
   generic renderers are selected canonically.

5. **`ToolCallDefaults.ts` shrunk** — Provider-shaped formatter tables removed;
   file now contains only generic fallback behavior based on canonical semantics.

6. **`FrontendPlugin` retired** — `summaryExtractors` and `inputFormatters`
   removed; only metadata fields and optional resume command remain.

7. **Provider-specific UI branches removed** — Cursor beta display driven by
   `plugin.status === "beta"` from server metadata.

8. **`Badge` / `getSessionBadges` removed** — Deleted in full; session badge
   display is driven by semantic plugin metadata.

9. **Guardrail tests added** — Tests assert that plugin packages contain no
   `.tsx`, `.jsx`, or CSS files; do not import React; reusable UI does not
   branch on built-in provider ids; tool UI does not branch on raw provider
   tool names.

10. **Legacy `name` field removed** — `ToolCallWithResult.name` dropped;
    `rawName` is the only debug/diagnostic field. All parsers, UI code, and
    tests updated.

## Verification

Any implementation work that changes code must run the full repository checks:

```sh
bun run lint
bun run typecheck
bun test
```

Documentation-only updates do not require the full code verification set.
