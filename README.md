# Klovi

A local web app for browsing and presenting Claude Code session history. Built for showing AI coding workflows at meetups and conferences.

Klovi reads session data directly from `~/.claude/projects/` (JSONL files) and renders conversations with markdown, syntax highlighting, collapsible tool calls, and a step-through presentation mode.

## Quick Start

```bash
bun install
bun run dev
```

Open http://localhost:3583

## Features

**Session Browsing**
- Auto-discovers all projects from `~/.claude/projects/`
- Filterable project list with session counts and last activity
- Sessions show first message, model, git branch, and timestamp
- Full conversation rendering with user/assistant/system messages

**Message Rendering**
- Markdown with GFM support (tables, strikethrough, task lists)
- Syntax-highlighted code blocks (language-aware, Prism)
- Collapsible tool calls with smart summaries (file paths for Read/Write/Edit, commands for Bash, patterns for Grep/Glob)
- Collapsible thinking/reasoning blocks
- File references (`@filepath.ext`) highlighted as green badges
- Image attachments displayed as media-type badges
- Slash commands shown with green `> /command` badge

**Presentation Mode**
- Step-through navigation: each conversation turn is a step, assistant turns have sub-steps (thinking, text, each tool call)
- Keyboard controls: Arrow keys / Space to advance, Escape to exit, F for fullscreen
- Progress bar with step counter at the bottom
- Sidebar hidden, content full-width with larger font
- Fade-in animation for each revealed step

**Theme & Display**
- Light and dark themes (toggle in header, persisted to localStorage)
- System theme auto-detection
- Font size control (+/- buttons) for projector readability

## Scripts

| Script | Description |
|---|---|
| `bun run dev` | Start dev server with HMR (port 3583) |
| `bun test` | Run all tests |
| `bun run typecheck` | TypeScript type checking (`tsc --noEmit`) |
| `bun run lint` | Lint with Biome |
| `bun run format` | Format with Biome |
| `bun run check:fix` | Lint + format combined |

## API

| Endpoint | Description |
|---|---|
| `GET /api/projects` | List all discovered projects |
| `GET /api/projects/:encodedPath/sessions` | List sessions for a project |
| `GET /api/sessions/:id?project=:encodedPath` | Full parsed session with turns |

## Tech Stack

- [Bun](https://bun.sh) - runtime, bundler, test runner, HTTP server
- React 19 + TypeScript (strict mode)
- react-markdown + remark-gfm
- react-syntax-highlighter (Prism, oneDark theme)
- CSS custom properties for theming (no CSS framework)
- Biome for linting and formatting
- happy-dom + @testing-library/react for tests

## Documentation

See [docs/](docs/) for detailed documentation:

- [Architecture](docs/architecture.md) - project structure, data flow, component hierarchy
- [JSONL Format](docs/jsonl-format.md) - Claude Code session file format specification
- [Components](docs/components.md) - frontend component guide and patterns
- [Testing](docs/testing.md) - test setup, patterns, and conventions
- [Content Types](CONTENT_TYPES.md) - catalog of all JSONL content types and rendering status

## Built With

This project was built with love using [Claude Code](https://claude.ai/claude-code).

## Trademark Notice

"Claude" and "Claude Code" are trademarks of Anthropic, PBC. This project is not affiliated with, endorsed by, or sponsored by Anthropic. All trademarks and registered trademarks are the property of their respective owners.
