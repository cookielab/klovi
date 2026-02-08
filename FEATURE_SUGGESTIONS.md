# Klovi — Feature Suggestions

A prioritized catalog of missing features, improvements, and ideas based on a full codebase review.

---

## High Priority

### 1. Search

**Global search across sessions and projects**
- Currently there is no way to search message content, tool outputs, or code blocks
- Projects have a filter input, but sessions within a project have no filter at all
- A global search endpoint (`GET /api/search?q=...`) with full-text matching across JSONL content would make the tool dramatically more useful for finding past conversations
- Frontend: search bar in the header with results linking directly to the matching message

### 2. Session Filtering & Sorting

- Sessions are always sorted newest-first with no alternative
- Add sorting options: by date, by model, by message count, by token usage
- Add filters: by model (Opus/Sonnet/Haiku), by date range, by git branch
- The session list sidebar is currently a flat list — metadata-based grouping (by day, by branch) would help navigation

### 3. Responsive Design & Mobile Support

- Zero `@media` queries in the entire CSS — the 320px fixed sidebar breaks on anything narrower than ~700px
- No collapsible sidebar, no hamburger menu, no touch gestures
- Buttons are 24-28px (below the 44px touch target guideline)
- Add breakpoints at ~768px (collapse sidebar) and ~480px (stack layout)
- Swipe gestures for presentation mode on mobile

### 4. Accessibility (a11y)

- No ARIA labels on interactive elements (buttons, collapsible sections, navigation)
- No semantic HTML — most structure is `<div>` with class names instead of `<nav>`, `<main>`, `<article>`, `<section>`
- No `aria-expanded` on collapsible tool calls and thinking blocks
- No visible focus indicators (`:focus-visible` styles missing)
- No skip-to-content link
- No `aria-live` regions for dynamic content (loading states, step counter)
- Color alone used to indicate state in some places (theme indicator)

### 5. Session Caching & Performance

- Sessions are re-parsed from JSONL on every API request — no in-memory cache
- Large conversations render all messages at once with no virtualization
- Add an LRU cache for parsed sessions, invalidated by file mtime
- Implement virtual scrolling (e.g., `@tanstack/react-virtual`) for conversations with 100+ turns
- Lazy-load images instead of embedding all base64 data in the initial render

---

## Medium Priority

### 6. Export & Sharing

- No way to export a conversation to Markdown, JSON, or PDF
- No "copy conversation" button
- No batch export (e.g., all sessions for a project)
- A `GET /api/sessions/:id/export?format=md` endpoint with a download button in the UI would be valuable for documentation and sharing

### 7. Conversation Statistics

- No aggregate view of token usage across a session (total input/output/cache tokens)
- No per-project statistics (number of sessions, total tokens, models used, date range)
- A stats panel in the session header showing total tokens, message count, tool call count, and duration would add useful context
- A project-level dashboard with usage trends over time

### 8. Copy-to-Clipboard for Messages & Code

- Code blocks have no copy button (standard in every code viewer)
- Individual messages can't be copied
- Tool outputs can't be copied
- Add a copy button to: code blocks, message bubbles, tool call inputs/outputs

### 9. In-Conversation Navigation

- No table of contents or turn index for long conversations
- No way to jump to a specific message or tool call
- No anchor links / permalinks for individual messages
- A turn outline in the sidebar (when viewing a session) showing "User → Assistant → User → ..." with click-to-scroll would help navigate long sessions

### 10. Tool Output Improvements

- Truncated tool outputs (5000 chars) have no "show full output" option
- Tool input/output are plain monospace text — no syntax highlighting for JSON, diffs, or code
- Bash tool outputs could detect and syntax-highlight common output formats
- File diffs from Edit tool could render as a proper diff view (red/green lines)

### 11. Live File Watching

- No file watcher on the `~/.claude/projects/` directory
- Users must manually refresh to see new sessions or updated conversations
- Add `fs.watch()` (or Bun equivalent) on the projects directory and push updates via WebSocket or SSE
- At minimum, add a polling refresh on the session list (every 30s)

### 12. Error Boundaries & Retry

- No React error boundaries — a single malformed message crashes the entire view
- Failed API calls show raw HTTP error text with no retry option
- No offline/disconnection detection
- Wrap message rendering in error boundaries that show "Failed to render message" with a retry button
- Add retry buttons on failed session/project loads

---

## Lower Priority

### 13. Keyboard Navigation

- Tab navigation has no visible focus styling
- Sidebar items can't be navigated with arrow keys
- No keyboard shortcut to focus the search/filter input
- Add a shortcut cheatsheet (`?` key) listing all available shortcuts
- Add `j/k` navigation (vim-style) for stepping through messages

### 14. Bookmarks & Favorites

- No way to mark sessions as favorites or add bookmarks within a conversation
- A star/bookmark button on sessions and individual messages, stored in localStorage, would help users find important conversations quickly

### 15. Session Comparison

- No way to compare two sessions side-by-side
- Useful for reviewing how different models/prompts handle the same task
- A split-view with synchronized scrolling

### 16. MCP Tool Display

- MCP tools (`mcp__server__action`) currently fall through to a raw JSON dump for input/output
- Parse known MCP servers (GitHub, Chrome DevTools) with custom formatters
- Show server name badge more prominently
- Group MCP tool calls by server in the UI

### 17. Notebook-Style Edit Display

- `NotebookEdit` tool calls show raw JSON
- Could render as a proper notebook cell edit with cell number, type, and content diff

### 18. Config File Support

- CLI accepts flags only — no persistent configuration file
- Support a `.klovi.json` or `~/.config/klovi/config.json` for default port, projects directory, theme, hidden projects, etc.
- Allow project-level config overrides

### 19. Health Check & Graceful Shutdown

- No `/health` or `/ready` endpoint for monitoring
- No graceful shutdown handler (SIGTERM/SIGINT) — connections are dropped immediately
- Add `process.on('SIGTERM', ...)` for clean shutdown
- Add a health endpoint returning server uptime and version

### 20. Session Metadata Display

- Git branch is parsed but not prominently shown in the session view
- Working directory (`cwd`) is available but not displayed
- Show a metadata bar at the top of each session: branch, cwd, model, start time, duration, total tokens

### 21. Pagination for Large Project Lists

- All projects and sessions are returned in a single API response
- For users with hundreds of projects, this could become slow
- Add pagination or infinite scroll with `?page=1&limit=50` support

### 22. URL Sharing & Deep Linking

- Hash-based routing works but URLs are not human-readable
- Switching to path-based routes (`/project/foo/session/abc123`) would improve shareability
- Add a "copy link" button for the current view

### 23. Print Stylesheet

- No `@media print` styles
- Printing a conversation includes the sidebar, header controls, and collapsed sections
- Add a print stylesheet that expands all content, hides chrome, and formats for paper

### 24. Progress Event Replay

- `progress` events are currently skipped entirely
- Could be used for an animated replay mode showing the conversation as it happened in real-time
- Would be compelling for presentations and demos

### 25. Conversation Summary / Compressed Context Indicator

- `summary` lines (conversation compression markers) are skipped
- Could show a visual indicator: "Context was compressed here" with the summary text, helping users understand why earlier context may be missing

---

## Infrastructure & DX

### 26. Structured Logging

- Minimal `console.log` output — no structured logging
- Silent failures in JSONL parsing (malformed lines are silently skipped)
- Add a `--verbose` flag for debug-level output
- Log warnings for skipped/malformed lines so users know about data issues

### 27. API Documentation

- No OpenAPI/Swagger spec for the 5 API endpoints
- The README has a brief table but no request/response examples
- Generating API docs from types would help contributors

### 28. Code Splitting

- The entire frontend is one bundle — all components loaded upfront
- Lazy-load presentation mode components (only used occasionally)
- Lazy-load syntax highlighter (heavy dependency, not needed until code blocks render)

### 29. Test Coverage Gaps

- 80 tests across 7 files — good foundation but gaps remain
- No integration tests for API endpoints
- No tests for the HTTP server routing/static file serving
- No tests for the CLI argument parser
- No tests for error edge cases (malformed JSONL, missing files, corrupt localStorage)
- No visual regression tests for presentation mode
