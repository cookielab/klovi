# Security Warning on Every Launch

## Problem

After migrating from HTTP server to Electrobun native app, the `--accept-risks` startup warning was removed. The app now reads potentially sensitive session data (API keys, credentials, code snippets) without any user acknowledgment.

## Solution

Full-screen warning page shown on every app launch. No filesystem access occurs until the user clicks "Continue".

## Architecture

```
Launch → main process starts (NO file access, no registry)
       → webview loads, React mounts <AppGate />
       → SecurityWarning rendered (full-screen page)
       → user clicks "Continue"
       → RPC: acceptRisks() → main process creates plugin registry
       → accepted=true → <App /> mounts → hooks run → RPC reads files
```

### Main Process (`src/bun/index.ts`)

- Remove eager `createRegistry()` call
- Registry created lazily inside `acceptRisks` RPC handler
- All data RPC handlers return empty results if registry not yet initialized
- New RPC request: `acceptRisks: {} → { ok: boolean }`

### RPC Types (`src/shared/rpc-types.ts`)

- Add `acceptRisks` request returning `{ ok: boolean }`

### Frontend

- `src/views/main/index.ts` mounts `AppGate` instead of `App`
- `AppGate` component: `accepted` state, renders `SecurityWarning` or `App`
- `SecurityWarning`: full-screen centered page with logo, warning text, Continue button
- On Continue: calls `acceptRisks()` RPC, then sets `accepted = true`

### Warning Text

> **Session Data Notice**
>
> Klovi reads AI coding session history from your local machine. Session data may contain sensitive information such as API keys, credentials, or private code snippets.
>
> Klovi is fully local — your data never leaves your machine. Klovi is open source, so you can verify this yourself.
>
> Be mindful when screen sharing or using Klovi in public settings.

### Visual Design

- Centered vertically and horizontally, max-width ~480px
- Uses existing CSS variables for consistent theming (light/dark)
- Klovi logo (`favicon.svg`) above the text
- Warning icon before heading
- "Continue" button styled with `--accent` color

## Files to Change

1. `src/shared/rpc-types.ts` — add `acceptRisks` request type
2. `src/bun/index.ts` — lazy registry, `acceptRisks` handler
3. `src/frontend/components/ui/SecurityWarning.tsx` — new component
4. `src/frontend/App.tsx` — export `AppGate` wrapper
5. `src/views/main/index.ts` — mount `AppGate` instead of `App`
6. `src/frontend/App.css` — warning page styles
7. Tests for SecurityWarning and AppGate
