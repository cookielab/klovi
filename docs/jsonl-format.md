# JSONL Session File Format

Claude Code stores session history as JSONL files in `~/.claude/projects/`. Each line is a separate JSON object. This document describes the format and how Klovi parses it.

## File Location

```
~/.claude/projects/
  └── <encoded-path>/           # e.g. -Users-foo-Workspace-bar
      └── <session-id>.jsonl    # UUID-based session file
```

The encoded path replaces `/` with `-` from the project's absolute path.

## Line Types

Each line has a `type` field:

| Type | Description | Parsed by Klovi |
|---|---|---|
| `user` | User message | Yes |
| `assistant` | Assistant response | Yes |
| `system` | System message | Yes |
| `progress` | Streaming progress updates | Skipped |
| `file-history-snapshot` | File version tracking | Skipped |
| `summary` | Conversation compression | Skipped |

Lines with `isMeta: true` are also skipped.

## Message Structure

### User Message

```json
{
  "type": "user",
  "message": {
    "role": "user",
    "content": "user typed this"
  },
  "timestamp": "2025-02-06T10:30:00Z",
  "uuid": "abc-123"
}
```

Content can be a string or an array of content blocks:

```json
{
  "content": [
    { "type": "text", "text": "look at this image" },
    { "type": "image", "source": { "type": "base64", "media_type": "image/png", "data": "iVBOR..." } }
  ]
}
```

### Assistant Message

```json
{
  "type": "assistant",
  "message": {
    "model": "claude-opus-4-6",
    "role": "assistant",
    "content": [
      { "type": "thinking", "thinking": "Let me analyze..." },
      { "type": "text", "text": "Here's what I found..." },
      { "type": "tool_use", "id": "toolu_abc", "name": "Read", "input": { "file_path": "/foo.ts" } }
    ],
    "stop_reason": "tool_use",
    "usage": {
      "input_tokens": 3000,
      "output_tokens": 500,
      "cache_read_input_tokens": 10747,
      "cache_creation_input_tokens": 11728
    }
  },
  "timestamp": "2025-02-06T10:30:05Z",
  "uuid": "def-456"
}
```

### Tool Result (as User Message)

Tool results arrive as user messages with `tool_result` content blocks:

```json
{
  "type": "user",
  "message": {
    "role": "user",
    "content": [{
      "type": "tool_result",
      "tool_use_id": "toolu_abc",
      "content": "file contents here...",
      "is_error": false
    }]
  }
}
```

Result content can be a string or an array with text and image blocks:

```json
{
  "content": [
    { "type": "text", "text": "result text" },
    { "type": "image", "source": { "type": "base64", "media_type": "image/png", "data": "..." } }
  ]
}
```

## Turn Merging

A single logical assistant turn in Claude Code often spans multiple JSONL lines:

```
Line 1: assistant (thinking block)
Line 2: user (tool_result only)     ← does NOT break the turn
Line 3: assistant (text + tool_use)
Line 4: user (tool_result only)     ← does NOT break the turn
Line 5: assistant (text)
```

Klovi merges all of these into **one AssistantTurn** with all thinking blocks, text blocks, and tool calls combined. This dramatically reduces turn count (e.g., 61 raw lines → 16 logical turns).

The rule: a user message that contains **only** `tool_result` blocks does not flush the current assistant turn. Only a real user message (with text content) starts a new turn.

## Filtered User Messages

These user message patterns are skipped during parsing (internal Claude Code messages):

| Pattern | Description |
|---|---|
| Starts with `<local-command` | Local command output |
| Starts with `<command-name` | Command name echo (parsed separately for slash command display) |
| Starts with `<task-notification` | Sub-task notifications |
| Starts with `<system-reminder` | System reminder injections |

## Slash Commands

Slash commands are encoded in user messages as XML:

```xml
<command-name>/commit</command-name>
<command-message>commit</command-message>
<command-args>-m "fix bug"</command-args>
```

Parsed by `command-message.ts` and displayed as a green command badge.

## Metadata Fields

Available on message lines but not all currently used:

| Field | Example | Used |
|---|---|---|
| `timestamp` | `"2025-02-06T10:30:00Z"` | Yes (shown on user and assistant messages) |
| `uuid` | `"abc-123"` | Yes (turn identity) |
| `slug` | `"abc-123-slug"` | Yes (session identity for plan/impl linking) |
| `model` | `"claude-opus-4-6"` | Yes (assistant badge) |
| `stop_reason` | `"end_turn"`, `"tool_use"` | Yes (on AssistantTurn) |
| `usage.*` | Token counts | Yes (token usage footer on assistant messages) |
| `cwd` | `"/Users/user/project"` | No |
| `gitBranch` | `"main"` | No (used in session list) |
| `version` | `"2.1.33"` | No |
| `parentUuid` | `"def-456"` | No |

## Plan/Implementation Session Linking

Klovi detects planning and implementation sessions using the `slug` field and first message content:

1. **Session type classification** (`classifySessionTypes()`): Sessions whose first message starts with "Implement the following plan" are classified as `implementation`. Sessions sharing the same `slug` as an implementation session (but not themselves implementation sessions) are classified as `plan`.

2. **Cross-session linking**: When viewing a session, Klovi resolves links to related sessions:
   - `findPlanSessionId()` — for implementation sessions, finds the planning session with the same `slug`. Skips status notices (e.g. `[Session resumed]`) when checking the first real user message.
   - `findImplSessionId()` — for any session, finds an implementation session with the same `slug`.

3. **UI rendering**: Planning sessions show a "View implementation session" link on the first user turn. Implementation sessions show a "View planning session" link on their "Implement the following plan" message.

## Progress Events (Skipped)

For reference, progress line subtypes:

| Subtype | Description |
|---|---|
| `bash_progress` | Shell command streaming output |
| `agent_progress` | Sub-agent (Task tool) updates |
| `hook_progress` | Pre/post hook execution |
| `mcp_progress` | MCP tool execution status |
| `plan_mode` | Plan mode state changes |
