# Security

## What Klovi Accesses

Klovi is a **read-only** native desktop app for browsing AI coding session history. It:

- Reads JSONL/session data from local tool directories and local SQLite state (defaults: `~/.claude/projects/`, `~/.codex/sessions/`, `~/.cursor/` plus Cursor's platform-specific app-support database, and `~/.local/share/opencode/`; paths can be customized in Settings where supported)
- Runs as a native desktop application (no network server)
- Does **not** write, modify, or delete any session files
- Does **not** send data to external servers

## Important Considerations

Session data may contain sensitive information such as API keys, credentials, or private code snippets that were part of your AI coding conversations.

- Be mindful of screen sharing when browsing sessions that may contain sensitive data
- Klovi only reads local files — no data leaves your machine

## Reporting Vulnerabilities

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public GitHub issue for security vulnerabilities.
2. Email security concerns to the maintainers via the contact information on the [Cookielab GitHub organization](https://github.com/cookielab).
3. Include a description of the vulnerability, steps to reproduce, and potential impact.

We will acknowledge receipt within 48 hours and aim to provide a fix within 7 days for critical issues.
