# CCvie Content Types & Formatting Guide

Catalog of all distinct content types found in Claude Code JSONL session files and their visual treatment needs.

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
| `KillShell` | — | JSON dump | Not styled |

### 3.3 Web Tools

| Tool | Summary Field | Input Display | Status |
|------|--------------|---------------|--------|
| `WebFetch` | `url` (60 chars) | URL | Handled |
| `WebSearch` | `query` (60 chars) | Query | Handled |

### 3.4 Interaction Tools

| Tool | Summary Field | Input Display | Status |
|------|--------------|---------------|--------|
| `AskUserQuestion` | — | JSON dump | Not styled |
| `Skill` | — | JSON dump | Not styled |

### 3.5 Task Management Tools

| Tool | Summary Field | Input Display | Status |
|------|--------------|---------------|--------|
| `TaskCreate` | — | JSON dump | Not styled |
| `TaskUpdate` | — | JSON dump | Not styled |
| `TaskList` | — | JSON dump | Not styled |
| `TaskOutput` | — | JSON dump | Not styled |
| `TodoWrite` | — | JSON dump | Not styled |

### 3.6 Plan Mode Tools

| Tool | Summary Field | Input Display | Status |
|------|--------------|---------------|--------|
| `EnterPlanMode` | — | JSON dump | Not styled |
| `ExitPlanMode` | — | JSON dump | Not styled |

### 3.7 Notebook Tools

| Tool | Summary Field | Input Display | Status |
|------|--------------|---------------|--------|
| `NotebookEdit` | — | JSON dump | Not styled |
| `NotebookRead` | — | JSON dump | Not styled |

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
| Image in result | `content[].type === "image"` | Not handled | Should render thumbnail |
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
| `timestamp` | `"2025-02-06T10:30:00Z"` | No |
| `uuid` | `"abc-123..."` | No |
| `parentUuid` | `"def-456..."` | No |
| `model` | `"claude-opus-4-6"` | Yes (shown on assistant messages) |
| `stop_reason` | `"end_turn"`, `"tool_use"` | No |
| `usage.input_tokens` | `3000` | No |
| `usage.output_tokens` | `500` | No |
| `usage.cache_read_input_tokens` | `10747` | No |
| `usage.cache_creation_input_tokens` | `11728` | No |
| `cwd` | `"/Users/user/project"` | No |
| `gitBranch` | `"main"` | No |
| `version` | `"2.1.33"` | No |

---

## 9. Rendering Priority / Opportunities

### High Priority (commonly seen, not yet styled)

1. **`AskUserQuestion`** - Show the question text and options as a styled card
2. **`Skill`** - Show skill name and args (e.g., "Skill: commit")
3. **`TaskCreate` / `TaskUpdate` / `TaskList`** - Show task management as a styled list/status
4. **Token usage** - Display input/output/cache token counts per message
5. **Timestamps** - Show relative or absolute time on messages
6. **Image results in tool output** - Render base64 images as thumbnails

### Medium Priority

7. **`EnterPlanMode` / `ExitPlanMode`** - Visual separator or banner for plan sections
8. **`NotebookEdit`** - Show cell edits with notebook-style formatting
9. **MCP tools** - Group by server, show server icon, simplify display
10. **`KillShell`** - Show as a terminal kill indicator
11. **Git metadata** - Branch name, working directory shown in session header
12. **Stop reason** - Indicate if assistant was cut off vs finished naturally

### Lower Priority

13. **Progress events** - For future replay/streaming mode
14. **File history snapshots** - For future diff/timeline view
15. **Summaries** - For future compressed-context indicator
16. **`TodoWrite`** - Show todo items as a checklist

---

## 10. Content Structure Reference

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
