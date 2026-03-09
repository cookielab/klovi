# @cookielab.io/klovi

Browse and present AI coding session history. Supports Claude Code, Codex (CLI & app), and OpenCode.

## Quick Start

```bash
# Run with Node.js
npx @cookielab.io/klovi

# Run with Bun
bunx @cookielab.io/klovi
```

Klovi starts a local server on `http://127.0.0.1:3583` and opens your browser. All data stays on your machine — sessions are read directly from each tool's local storage.

## CLI Options

```
klovi [options]

Options:
  --port NUMBER     Override the default port (default: 3583)
  --no-browser      Start the server without opening a browser
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `KLOVI_PORT` | `3583` | Server port |
| `KLOVI_HOST` | `127.0.0.1` | Bind address (localhost-only by default) |
| `KLOVI_STATIC_DIR` | (auto) | Override the static assets directory |
| `KLOVI_SETTINGS_PATH` | `~/.klovi/settings.json` | Override the settings file used by the CLI |

## Programmatic API

```ts
import { startKloviServer } from "@cookielab.io/klovi/server";

const server = await startKloviServer({
  host: "127.0.0.1",
  port: 3583,
});

console.log(`Klovi listening on ${server.url}`);

// Later:
server.stop();
```

### `startKloviServer(options?)`

Starts the Klovi backend server. Returns `{ url, stop() }`.

| Option | Type | Default | Description |
|---|---|---|---|
| `host` | `string` | `"127.0.0.1"` | Bind address |
| `port` | `number` | `0` (auto) | Server port |
| `version` | `string` | `"dev"` | Version string |
| `commit` | `string` | `""` | Commit hash |
| `settingsPath` | `string` | `~/.klovi/settings.json` | Settings file path |
| `runtime` | `"auto" \| "bun" \| "node"` | `"auto"` | Runtime selection |

## Supported Tools

- **Claude Code** — reads from `~/.claude/projects/`
- **Codex** (CLI & app) — reads from `~/.codex/sessions/`
- **OpenCode** — reads from `~/.local/share/opencode/opencode.db`

## License

MIT
