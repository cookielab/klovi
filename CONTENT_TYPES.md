# Klovi Content Types & Formatting Guide

Catalog of all distinct content types found in AI coding session data and their visual treatment needs. Covers Claude Code (JSONL), Codex CLI (JSONL), and OpenCode (SQLite).

---

## 1. Message Roles

| Role | Current Status | Visual Treatment |
|------|---------------|-----------------|
| `user` | Handled | Green left border, light green bg |
| `assistant` | Handled | Gray bg, light border |
| `system` | Handled | Yellow bg, light border |

---

## 2. Assistant Content Blocks

### 2.1 Text (`type: "text"`)
Regular markdown text. Rendered with `react-markdown` + GFM.

**Special inline patterns to detect:**

| Pattern | Current Status | Visual Treatment |
|---------|---------------|-----------------|
| `@filepath.ext` references | Handled | Green badge with border |
| Inline code | Handled | Gray bg, rounded |
| Fenced code blocks | Handled | Syntax-highlighted with language label |
| Links | Handled | Open in new tab |
| Tables (GFM) | Handled | Standard markdown table |

### 2.2 Thinking (`type: "thinking"`)
Model's internal reasoning. Currently rendered as collapsible with 100-char preview.

```json
{ "type": "thinking", "thinking": "Let me analyze the code..." }
```

**Status:** Handled (collapsible, italic, markdown-rendered)

### 2.3 Tool Use (`type: "tool_use"`)
Invocation of a tool. Matched with `tool_result` by `id` / `tool_use_id`.

```json
{
  "type": "tool_use",
  "id": "toolu_015UqCc...",
  "name": "Bash",
  "input": { "command": "ls -la", "description": "List files" }
}
```

**Status:** Handled with per-tool summaries (see section 3)

---

## 3. Tools (37 unique names found)

### 3.1 Core File Tools

| Tool | Summary Field | Input Display | Status |
|------|--------------|---------------|--------|
| `Read` | `file_path` | File path | Handled |
| `Write` | `file_path` | File path + content (truncated 2000 chars) | Handled |
| `Edit` | `file_path` | "File: ...", "Replace: ...", "With: ..." | Handled |
| `Glob` | `pattern` | Pattern directly | Handled |
| `Grep` | `pattern` (60 chars) | Pattern | Handled |

### 3.2 Execution Tools

| Tool | Summary Field | Input Display | Status |
|------|--------------|---------------|--------|
| `Bash` | `command` (80 chars) | Command directly | Handled |
| `Task` | `description` (60 chars) | Description | Handled |
| `KillShell` | `task_id` or `shell_id` | JSON dump | Summary handled |

### 3.3 Web Tools

| Tool | Summary Field | Input Display | Status |
|------|--------------|---------------|--------|
| `WebFetch` | `url` (60 chars) | URL | Handled |
| `WebSearch` | `query` (60 chars) | Query | Handled |

### 3.4 Interaction Tools

| Tool | Summary Field | Input Display | Status |
|------|--------------|---------------|--------|
| `AskUserQuestion` | First question text (60 chars) | JSON dump | Summary handled |
| `Skill` | Skill name | JSON dump | Summary handled |

### 3.5 Task Management Tools

| Tool | Summary Field | Input Display | Status |
|------|--------------|---------------|--------|
| `TaskCreate` | `subject` (60 chars) | JSON dump | Summary handled |
| `TaskUpdate` | `#<taskId> → <status>` | JSON dump | Summary handled |
| `TaskList` | "List all tasks" | JSON dump | Summary handled |
| `TaskGet` | `#<taskId>` | JSON dump | Summary handled |
| `TaskOutput` | `task_id` | JSON dump | Summary handled |
| `TaskStop` | `task_id` or `shell_id` | JSON dump | Summary handled |
| `TodoWrite` | `subject` (60 chars) | JSON dump | Summary handled |

### 3.6 Plan Mode Tools

| Tool | Summary Field | Input Display | Status |
|------|--------------|---------------|--------|
| `EnterPlanMode` | "Enter plan mode" | JSON dump | Summary handled |
| `ExitPlanMode` | "Exit plan mode" | JSON dump | Summary handled |

### 3.7 Notebook Tools

| Tool | Summary Field | Input Display | Status |
|------|--------------|---------------|--------|
| `NotebookEdit` | `notebook_path` | JSON dump | Summary handled |
| `NotebookRead` | `notebook_path` | JSON dump | Summary handled |

### 3.8 MCP Tools (Model Context Protocol)

Prefixed with `mcp__<server>__<action>`. Found in sessions:

**Chrome DevTools (14 tools):**
- `mcp__chrome-devtools__click`
- `mcp__chrome-devtools__evaluate_script`
- `mcp__chrome-devtools__fill`
- `mcp__chrome-devtools__fill_form`
- `mcp__chrome-devtools__get_network_request`
- `mcp__chrome-devtools__list_console_messages`
- `mcp__chrome-devtools__list_network_requests`
- `mcp__chrome-devtools__list_pages`
- `mcp__chrome-devtools__navigate_page`
- `mcp__chrome-devtools__new_page`
- `mcp__chrome-devtools__press_key`
- `mcp__chrome-devtools__take_screenshot`
- `mcp__chrome-devtools__take_snapshot`
- `mcp__chrome-devtools__wait_for`

**GitHub:**
- `mcp__github__pull_request_read`

**Status:** All MCP tools fall through to JSON dump. Could group by server prefix and show simplified summaries.

---

## 4. Tool Results (`type: "tool_result"`)

Arrive as user messages with content array:

```json
{
  "role": "user",
  "content": [{
    "type": "tool_result",
    "tool_use_id": "toolu_015UqCc...",
    "content": "file contents here...",
    "is_error": false
  }]
}
```

### Result variants:

| Variant | Detection | Current Status | Visual Treatment Needed |
|---------|-----------|---------------|------------------------|
| Text result | `content` is string | Handled | Monospace, truncated at 5000 chars |
| Error result | `is_error: true` | Handled | Red text (`.tool-call-error`) |
| Array content | `content` is array of objects | Partially | Joins text items |
| Image in result | `content[].type === "image"` | Handled | Rendered as clickable thumbnails with fullscreen lightbox |
| Empty result | `content` is empty/null | Handled | Shows nothing |

---

## 5. User Message Variants

### 5.1 Regular Text
Plain user input, rendered as markdown.

**Status:** Handled

### 5.2 Slash Commands
Detected by structured XML tags in content:

```xml
<command-name>/commit</command-name>
<command-message>commit</command-message>
<command-args>-m "fix bug"</command-args>
```

**Status:** Handled (green badge with `>` prefix)

### 5.3 Image Attachments
Content blocks of `type: "image"` within user messages:

```json
{ "type": "image", "source": { "type": "base64", "media_type": "image/png", "data": "iVBOR..." } }
```

**Status:** Handled (shows "image/png" badge, not the actual image)

### 5.4 Status Notices
Short bracket-wrapped messages like `[Session resumed]`, `[Context compressed]`:

```
[Some status text]
```

**Status:** Handled (centered, muted, small text)

---

## 6. Skipped/Filtered Content

These JSONL line types are skipped during parsing and never rendered:

### 6.1 Top-Level Types (skipped entirely)

| Type | Description |
|------|-------------|
| `progress` | Real-time progress updates (bash, agent, hook, mcp) |
| `file-history-snapshot` | File version tracking snapshots |
| `summary` | Conversation compression summaries |
| Lines with `isMeta: true` | System/meta messages (command echoes, etc.) |

### 6.2 User Messages Filtered Out

| Pattern | Description |
|---------|-------------|
| Starts with `<local-command` | Local command output |
| Starts with `<command-name` | Command name echo (but parsed for slash command display) |
| Starts with `<task-notification` | Sub-task notifications |
| Starts with `<system-reminder` | System reminder injections |
| Tool-result-only messages | Merged into preceding assistant turn |

---

## 7. Progress Events (currently skipped)

If ever rendered (e.g., for replay mode), these are the subtypes:

| Progress Type | Fields | Description |
|--------------|--------|-------------|
| `bash_progress` | `output`, `fullOutput`, `elapsedTimeSeconds`, `totalLines` | Shell command streaming |
| `agent_progress` | varies | Sub-agent (Task tool) updates |
| `hook_progress` | varies | Pre/post hook execution |
| `mcp_progress` | `status`, `serverName`, `toolName` | MCP tool execution status |
| `plan_mode` | `data` | Plan mode state changes |

---

## 8. Message Metadata

Fields available on message lines for potential display:

| Field | Example | Currently Used |
|-------|---------|---------------|
| `timestamp` | `"2025-02-06T10:30:00Z"` | Yes (shown on user and assistant messages) |
| `uuid` | `"abc-123..."` | Yes (turn identity) |
| `parentUuid` | `"def-456..."` | No |
| `model` | `"claude-opus-4-6"` | Yes (shown on assistant messages) |
| `stop_reason` | `"end_turn"`, `"tool_use"` | Yes (on AssistantTurn) |
| `usage.input_tokens` | `3000` | Yes (token usage footer on assistant messages) |
| `usage.output_tokens` | `500` | Yes (token usage footer on assistant messages) |
| `usage.cache_read_input_tokens` | `10747` | Yes (token usage footer on assistant messages) |
| `usage.cache_creation_input_tokens` | `11728` | Yes (token usage footer on assistant messages) |
| `cwd` | `"/Users/user/project"` | No |
| `gitBranch` | `"main"` | No |
| `version` | `"2.1.33"` | No |

---

## 9. Rendering Priority / Opportunities

### Medium Priority

1. **MCP tools** - Group by server, show server icon, simplify display
2. **Git metadata** - Branch name, working directory shown in session header
3. **`NotebookEdit`** - Show cell edits with notebook-style formatting

### Lower Priority

4. **Progress events** - For future replay/streaming mode
5. **File history snapshots** - For future diff/timeline view
6. **Summaries** - For future compressed-context indicator

### Recently Completed

- **Token usage** - Input/output/cache token counts shown as footer on assistant messages
- **Timestamps** - Relative timestamps shown on user and assistant messages
- **Image results in tool output** - Rendered as clickable thumbnails with fullscreen lightbox (ImageLightbox component)
- **`AskUserQuestion`** - Summary shows first question text
- **`Skill`** - Summary shows skill name
- **`TaskCreate` / `TaskUpdate` / `TaskList` / `TaskGet` / `TaskOutput` / `TaskStop`** - Summaries for all task management tools
- **`EnterPlanMode` / `ExitPlanMode`** - Summaries show mode transitions
- **`NotebookEdit` / `NotebookRead`** - Summaries show notebook path
- **`KillShell`** - Summary shows task/shell ID
- **`TodoWrite`** - Summary shows subject

---

## 10. Codex CLI Content Types

Codex CLI stores sessions as JSONL files in `~/.codex/sessions/`. The first line is a session metadata object; subsequent lines are events.

### 10.1 Session Metadata (first line)

```json
{
  "uuid": "abc-123",
  "cwd": "/Users/user/project",
  "timestamps": { "created": 1700000000, "updated": 1700001000 },
  "model": "o4-mini",
  "provider_id": "openai"
}
```

### 10.2 Event Types

| Event Type | Description | Mapped To | Status |
|---|---|---|---|
| `turn.started` | Marks beginning of a conversation turn | Triggers new user/assistant turn boundary | Handled |
| `turn.completed` | Marks end of a turn, includes usage data | Finalizes assistant turn with token usage | Handled |
| `item.completed` | Contains a completed item (tool output, message, etc.) | Dispatched by item type (see below) | Handled |

### 10.3 Item Types (within `item.completed` events)

| Item Type | Description | Rendered As | Summary |
|---|---|---|---|
| `agent_message` | Text response from the model | Text content block | Text shown directly |
| `reasoning` | Model's internal reasoning | Thinking block (collapsible) | Preview shown |
| `command_execution` | Shell command executed | Tool call: `command_execution` | Command string (80 chars) |
| `file_change` | File modifications | Tool call: `file_change` | File path from first change |
| `mcp_tool_call` | MCP tool invocation | Tool call (by tool name) | JSON input |
| `web_search` | Web search query | Tool call: `web_search` | Query string (60 chars) |

---

## 11. OpenCode Content Types

OpenCode stores sessions in a SQLite database (`~/.local/share/opencode/opencode.db`) with `session`, `message`, and `part` tables.

### 11.1 Message Roles

| Role | Description | Mapped To |
|---|---|---|
| `user` | User input | UserTurn |
| `assistant` | Model response | AssistantTurn (with model, tokens, finish reason) |

### 11.2 Part Types (within messages)

| Part Type | Description | Rendered As | Status |
|---|---|---|---|
| `text` | Text content | Text content block (or user text for user messages) | Handled |
| `reasoning` | Model reasoning | Thinking block (collapsible) | Handled |
| `tool` | Tool invocation with state | Tool call (collapsible) | Handled |
| `file` | File attachment | Skipped (not rendered) | Ignored |
| `snapshot` | State snapshot | Skipped | Ignored |
| `step-finish` | Step completion with token usage | Token usage extracted | Handled |
| `step-start` | Step start marker | Skipped | Ignored |
| `patch` | Code patch | Skipped | Ignored |
| `agent` | Sub-agent marker | Skipped | Ignored |
| `compaction` | Context compaction | Skipped | Ignored |
| `subtask` | Subtask marker | Skipped | Ignored |
| `retry` | Retry marker | Skipped | Ignored |

### 11.3 Tool States

Tool parts have a `state` field with one of these statuses:

| Status | Description | Display |
|---|---|---|
| `completed` | Tool finished successfully | Shows input + output |
| `error` | Tool finished with error | Shows input + error (red text) |
| `pending` | Tool not yet started | Shows "[Tool execution was interrupted]" |
| `running` | Tool still running | Shows "[Tool execution was interrupted]" |

---

## 12. Claude Code Content Structure Reference

### Full assistant message line:
```json
{
  "type": "assistant",
  "message": {
    "model": "claude-opus-4-6",
    "id": "msg_...",
    "role": "assistant",
    "content": [
      { "type": "thinking", "thinking": "..." },
      { "type": "text", "text": "..." },
      { "type": "tool_use", "id": "toolu_...", "name": "Read", "input": { "file_path": "..." } }
    ],
    "stop_reason": "tool_use",
    "usage": { "input_tokens": 3000, "output_tokens": 500 }
  },
  "timestamp": "2025-02-06T10:30:00Z",
  "uuid": "..."
}
```

### Full user message line:
```json
{
  "type": "user",
  "message": {
    "role": "user",
    "content": "user typed this"
  },
  "timestamp": "2025-02-06T10:30:00Z",
  "uuid": "..."
}
```

### Tool result as user message:
```json
{
  "type": "user",
  "message": {
    "role": "user",
    "content": [{
      "type": "tool_result",
      "tool_use_id": "toolu_...",
      "content": [{ "type": "text", "text": "result text" }],
      "is_error": false
    }]
  }
}
```

### File history snapshot:
```json
{
  "type": "file-history-snapshot",
  "messageId": "...",
  "snapshot": {
    "trackedFileBackups": {
      "tsconfig.json": { "backupFileName": "hash@v1", "version": 1 }
    }
  }
}
```

### Progress event:
```json
{
  "type": "progress",
  "data": {
    "type": "bash_progress",
    "output": "...",
    "elapsedTimeSeconds": 2,
    "totalLines": 1
  },
  "toolUseID": "bash-progress-0",
  "parentToolUseID": "toolu_..."
}
```
