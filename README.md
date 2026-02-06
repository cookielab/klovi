# CCvie

A local web app for browsing and presenting Claude Code session history. Built for showing AI coding workflows at meetups and conferences.

CCvie reads session data directly from `~/.claude/projects/` and renders conversations with markdown, syntax highlighting, collapsible tool calls, and a step-through presentation mode.

## Quick Start

```bash
bun install
bun --hot index.ts
```

Open http://localhost:3000

## Features

**Session Browsing**
- Auto-discovers all projects from `~/.claude/projects/`
- Filterable project list with session counts and last activity
- Sessions show first message, model, git branch, and timestamp
- Full conversation rendering with user/assistant messages

**Message Rendering**
- Markdown with GFM support (tables, strikethrough, task lists)
- Syntax-highlighted code blocks (language-aware)
- Collapsible tool calls with smart summaries (file paths for Read/Write/Edit, commands for Bash, patterns for Grep/Glob)
- Collapsible thinking/reasoning blocks

**Presentation Mode**
- Step-through navigation: each conversation turn is a step, assistant turns have sub-steps (thinking, text, each tool call)
- Keyboard controls: Arrow keys / Space to advance, Escape to exit, F for fullscreen
- Progress bar at the bottom
- Sidebar hidden, content full-width with larger font
- Fade-in animation for each revealed step

**Theme & Display**
- Light and dark themes (toggle in header, persisted to localStorage)
- Font size control (+/- buttons) for projector readability

## API

| Endpoint | Description |
|---|---|
| `GET /api/projects` | List all discovered projects |
| `GET /api/projects/:encodedPath/sessions` | List sessions for a project |
| `GET /api/sessions/:id?project=:encodedPath` | Full parsed session |

## Tech Stack

- [Bun](https://bun.sh) runtime, bundler, and server
- React + TypeScript
- react-markdown + remark-gfm
- react-syntax-highlighter (Prism)
- CSS custom properties for theming
