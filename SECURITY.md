# Security

## What Klovi Accesses

Klovi is a **read-only** local web viewer for Claude Code session history. It:

- Reads JSONL session files from `~/.claude/projects/` (or a custom directory via `--claude-code-dir`)
- Serves a local HTTP server (default port 3583)
- Does **not** write, modify, or delete any files
- Does **not** send data to external servers
- Does **not** require authentication

## Important Considerations

Session data may contain sensitive information such as API keys, credentials, or private code snippets that were part of your Claude Code conversations. The local server exposes this data on `http://localhost:3583`.

- Only run Klovi on trusted networks
- Do not expose the server to the public internet
- The startup warning can be acknowledged with `--accept-risks`

## Reporting Vulnerabilities

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public GitHub issue for security vulnerabilities.
2. Email security concerns to the maintainers via the contact information on the [Cookielab GitHub organization](https://github.com/cookielab).
3. Include a description of the vulnerability, steps to reproduce, and potential impact.

We will acknowledge receipt within 48 hours and aim to provide a fix within 7 days for critical issues.
