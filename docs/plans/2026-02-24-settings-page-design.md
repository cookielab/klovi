# Settings Page Design

## Summary

Add a settings page to Klovi as an in-app full-screen modal overlay, accessed via App Menu > Preferences (and `Cmd+,` keyboard shortcut). The panel uses a left sidebar with section tabs for future extensibility, starting with a "Plugins" section.

Each plugin (Claude Code, Codex CLI, OpenCode) has:
- Enable/disable checkbox
- Data directory path display with text input
- Native folder picker via Browse button
- Reset to default link when customized

Settings are persisted in a JSON file on disk, owned by the main process. Changes apply immediately with registry re-scan.

## Data Model

**File location:** `${paths.userData}/settings.json`

```typescript
type PluginSettings = {
  version: 1;
  plugins: {
    [pluginId: string]: {
      enabled: boolean;
      dataDir: string | null; // null = use plugin's built-in default
    };
  };
};
```

- Plugin IDs: `"claude-code"`, `"codex-cli"`, `"opencode"`
- `dataDir: null` means use the plugin's built-in default path
- If `settings.json` doesn't exist, all plugins default to enabled with default paths (preserving current behavior)
- File is written atomically (write to temp + rename)

## RPC Interface

### New Request Methods (Bun serves, Webview calls)

| Method | Input | Output | Purpose |
|--------|-------|--------|---------|
| `getPluginSettings` | `{}` | `PluginSettingsResponse` | Get current settings + plugin metadata |
| `updatePluginSetting` | `{ pluginId, enabled?, dataDir? }` | `PluginSettingsResponse` | Update one plugin, re-scan, return new state |
| `browseDirectory` | `{ startingFolder? }` | `{ path: string \| null }` | Open native folder picker |

### PluginSettingsResponse

```typescript
{
  plugins: Array<{
    id: string;
    displayName: string;
    enabled: boolean;
    dataDir: string;        // current effective path (custom or default)
    defaultDataDir: string;  // the built-in default
    isCustomDir: boolean;
  }>;
}
```

### New Menu Message (Webview receives from Bun)

- `openSettings: {}` — dispatched when user clicks App Menu > Preferences

## Frontend UI

### SettingsModal Component

- Full-screen overlay (same pattern as SearchModal)
- Left sidebar with section tabs: "Plugins" (active), "General" (future, disabled/greyed)
- Right content area showing the active section
- Close with X button or Escape key
- Opens via `openSettings` menu message or `Cmd+,` keyboard shortcut

### Plugin List Section

Each plugin is a row/card:
- Checkbox toggle for enabled/disabled
- Plugin display name (e.g., "Claude Code")
- Current effective data directory path
- Text input for custom path
- "Browse" button → opens Electrobun's native `openFileDialog` with `canChooseDirectory: true`
- "Reset" link shown only when path is customized (reverts to default)
- Disabled plugins have dimmed path controls

### Path Validation

- Main process validates directory exists after Browse or text input
- Inline error for invalid paths
- Optional warning for valid directories with no session data

## State Flow

1. User toggles a plugin or changes a path in the modal
2. Frontend calls `updatePluginSetting` RPC
3. Main process updates in-memory settings, writes `settings.json` atomically, re-creates plugin registry
4. Returns updated `PluginSettingsResponse`
5. Frontend updates settings UI
6. On modal close (if changes were made), main view re-fetches projects/sessions

### App Startup

- Main process reads `settings.json` before `acceptRisks`
- Missing file → defaults (all enabled, default paths)
- Registry created with these settings

### Registry Integration

- `createRegistry()` modified to accept settings config
- Disabled plugins are skipped
- Custom paths are applied via existing `setClaudeCodeDir()`, `setCodexCliDir()`, `setOpenCodeDir()` setters

## App Menu Changes

Add to App Menu:
```
App Menu:
  ├── About Klovi
  ├── ─────────────
  ├── Preferences... (Cmd+,)    ← NEW
  ├── ─────────────
  └── Quit Klovi
```

## Testing

- **Settings persistence:** Read/write settings.json, schema validation, defaults, atomic write
- **Registry with settings:** Disabled plugins excluded, custom paths used, missing dirs handled
- **SettingsModal component:** Render with mock RPC, toggle interactions, path display, browse
- **RPC handlers:** getPluginSettings returns correct shape, updatePluginSetting persists and re-scans

## Decisions

- **Access:** App Menu > Preferences + Cmd+, keyboard shortcut
- **Panel style:** Full-screen modal overlay (in-app, not separate window)
- **Persistence:** JSON file on disk in app's userData directory
- **Approach:** RPC-driven — main process owns settings, webview communicates via RPC
- **Apply changes:** Immediately with registry re-scan (no restart required)
- **Scope:** Plugins section only initially, structured for future General section
- **Folder picker:** Text input + Browse button using Electrobun's native openFileDialog
