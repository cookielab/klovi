# Settings Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a settings modal with plugin enable/disable toggles and data directory configuration, accessed via App Menu > Preferences.

**Architecture:** Settings persisted in JSON file on disk (`settings.json` in app userData dir), owned by the main process. Webview communicates via 3 new RPC methods. Changes apply immediately with registry re-scan. Full-screen modal overlay with left sidebar for section tabs.

**Tech Stack:** React 19, Electrobun RPC, Bun filesystem APIs, plain CSS with existing custom properties.

**Design doc:** `docs/plans/2026-02-24-settings-page-design.md`

---

### Task 1: Settings persistence module

**Files:**
- Create: `src/bun/settings.ts`
- Test: `src/bun/settings.test.ts`

**Step 1: Write the failing tests**

```typescript
// src/bun/settings.test.ts
import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadSettings, saveSettings, getDefaultSettings } from "./settings.ts";
import type { PluginSettings } from "./settings.ts";

const testDir = join(tmpdir(), "klovi-settings-test-" + Date.now());

function settingsPath(): string {
  return join(testDir, "settings.json");
}

describe("settings", () => {
  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  test("getDefaultSettings returns all plugins enabled with null dataDirs", () => {
    const settings = getDefaultSettings();
    expect(settings.version).toBe(1);
    expect(settings.plugins["claude-code"]).toEqual({ enabled: true, dataDir: null });
    expect(settings.plugins["codex-cli"]).toEqual({ enabled: true, dataDir: null });
    expect(settings.plugins.opencode).toEqual({ enabled: true, dataDir: null });
  });

  test("loadSettings returns defaults when file does not exist", () => {
    const settings = loadSettings(join(testDir, "nonexistent", "settings.json"));
    expect(settings).toEqual(getDefaultSettings());
  });

  test("saveSettings writes and loadSettings reads back", () => {
    mkdirSync(testDir, { recursive: true });
    const path = settingsPath();
    const settings: PluginSettings = {
      version: 1,
      plugins: {
        "claude-code": { enabled: false, dataDir: "/custom/path" },
        "codex-cli": { enabled: true, dataDir: null },
        opencode: { enabled: true, dataDir: null },
      },
    };
    saveSettings(path, settings);
    const loaded = loadSettings(path);
    expect(loaded).toEqual(settings);
  });

  test("saveSettings creates parent directories", () => {
    const deep = join(testDir, "a", "b", "settings.json");
    saveSettings(deep, getDefaultSettings());
    expect(existsSync(deep)).toBe(true);
  });

  test("loadSettings returns defaults for corrupted JSON", () => {
    mkdirSync(testDir, { recursive: true });
    const path = settingsPath();
    Bun.write(path, "not valid json{{{");
    const settings = loadSettings(path);
    expect(settings).toEqual(getDefaultSettings());
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test src/bun/settings.test.ts`
Expected: FAIL — module `./settings.ts` not found

**Step 3: Write the implementation**

```typescript
// src/bun/settings.ts
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

export type PluginSettings = {
  version: 1;
  plugins: {
    [pluginId: string]: {
      enabled: boolean;
      dataDir: string | null;
    };
  };
};

export function getDefaultSettings(): PluginSettings {
  return {
    version: 1,
    plugins: {
      "claude-code": { enabled: true, dataDir: null },
      "codex-cli": { enabled: true, dataDir: null },
      opencode: { enabled: true, dataDir: null },
    },
  };
}

export function loadSettings(path: string): PluginSettings {
  try {
    if (!existsSync(path)) return getDefaultSettings();
    const raw = readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed.version !== 1 || typeof parsed.plugins !== "object") {
      return getDefaultSettings();
    }
    return parsed as PluginSettings;
  } catch {
    return getDefaultSettings();
  }
}

export function saveSettings(path: string, settings: PluginSettings): void {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const tmpPath = join(tmpdir(), `klovi-settings-${Date.now()}.tmp`);
  writeFileSync(tmpPath, JSON.stringify(settings, null, 2));
  renameSync(tmpPath, path);
}
```

**Step 4: Run tests to verify they pass**

Run: `bun test src/bun/settings.test.ts`
Expected: All 5 tests PASS

**Step 5: Run full checks**

Run: `bun run check && bun run typecheck && bun test`

**Step 6: Commit**

```
feat: add settings persistence module

Reads/writes PluginSettings from a JSON file with atomic writes.
Defaults to all plugins enabled with their built-in data directories.
```

---

### Task 2: Modify createRegistry to accept settings

**Files:**
- Modify: `src/plugins/auto-discover.ts`
- Modify: `src/plugins/config.ts` (use setters for custom paths)
- Test: add tests in `src/plugins/auto-discover.test.ts` (new file)

**Step 1: Write the failing tests**

```typescript
// src/plugins/auto-discover.test.ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { PluginSettings } from "../bun/settings.ts";
import { getDefaultSettings } from "../bun/settings.ts";
import { createRegistry } from "./auto-discover.ts";
import {
  getClaudeCodeDir,
  getCodexCliDir,
  getOpenCodeDir,
  setClaudeCodeDir,
  setCodexCliDir,
  setOpenCodeDir,
} from "./config.ts";

const testDir = join(tmpdir(), "klovi-registry-test-" + Date.now());

describe("createRegistry with settings", () => {
  let origClaude: string;
  let origCodex: string;
  let origOpenCode: string;

  beforeEach(() => {
    origClaude = getClaudeCodeDir();
    origCodex = getCodexCliDir();
    origOpenCode = getOpenCodeDir();
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    setClaudeCodeDir(origClaude);
    setCodexCliDir(origCodex);
    setOpenCodeDir(origOpenCode);
    rmSync(testDir, { recursive: true, force: true });
  });

  test("disabled plugin is not registered even if dir exists", () => {
    const claudeDir = join(testDir, ".claude");
    mkdirSync(join(claudeDir, "projects"), { recursive: true });
    setClaudeCodeDir(claudeDir);

    const settings: PluginSettings = {
      ...getDefaultSettings(),
      plugins: {
        ...getDefaultSettings().plugins,
        "claude-code": { enabled: false, dataDir: null },
      },
    };

    const registry = createRegistry(settings);
    expect(registry.getAllPlugins().find((p) => p.id === "claude-code")).toBeUndefined();
  });

  test("custom dataDir is used for discovery", () => {
    const customDir = join(testDir, "custom-claude");
    mkdirSync(join(customDir, "projects"), { recursive: true });

    const settings: PluginSettings = {
      ...getDefaultSettings(),
      plugins: {
        ...getDefaultSettings().plugins,
        "claude-code": { enabled: true, dataDir: customDir },
      },
    };

    const registry = createRegistry(settings);
    const plugin = registry.getAllPlugins().find((p) => p.id === "claude-code");
    expect(plugin).toBeDefined();
  });

  test("without settings argument, behaves as before (all enabled, default dirs)", () => {
    // This tests backward compatibility — no settings means auto-discover
    const registry = createRegistry();
    // Should not throw — just returns whatever plugins have existing dirs
    expect(registry).toBeDefined();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test src/plugins/auto-discover.test.ts`
Expected: FAIL — `createRegistry` doesn't accept settings parameter

**Step 3: Modify createRegistry**

Update `src/plugins/auto-discover.ts`:

```typescript
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { PluginSettings } from "../bun/settings.ts";
import { claudeCodePlugin } from "./claude-code/index.ts";
import { codexCliPlugin } from "./codex-cli/index.ts";
import { setClaudeCodeDir, setCodexCliDir, setOpenCodeDir } from "./config.ts";
import { openCodePlugin } from "./opencode/index.ts";
import { PluginRegistry } from "./registry.ts";

export function createRegistry(settings?: PluginSettings): PluginRegistry {
  const registry = new PluginRegistry();

  const allPlugins = [
    { plugin: claudeCodePlugin, setDir: setClaudeCodeDir },
    { plugin: codexCliPlugin, setDir: setCodexCliDir },
    { plugin: openCodePlugin, setDir: setOpenCodeDir },
  ] as const;

  for (const { plugin, setDir } of allPlugins) {
    const pluginSettings = settings?.plugins[plugin.id];

    // If settings exist and plugin is disabled, skip it
    if (pluginSettings && !pluginSettings.enabled) continue;

    // Apply custom dataDir if set
    if (pluginSettings?.dataDir) {
      setDir(pluginSettings.dataDir);
    }

    // Check if data directory exists
    const dataDir = plugin.getDefaultDataDir();
    if (!dataDir) continue;

    // OpenCode needs the actual DB file
    if (plugin.id === "opencode") {
      if (existsSync(join(dataDir, "opencode.db"))) {
        registry.register(plugin);
      }
    } else {
      if (existsSync(dataDir)) {
        registry.register(plugin);
      }
    }
  }

  return registry;
}
```

**Step 4: Run tests to verify they pass**

Run: `bun test src/plugins/auto-discover.test.ts`
Expected: All 3 tests PASS

**Step 5: Run full checks**

Run: `bun run check && bun run typecheck && bun test`

**Step 6: Commit**

```
feat: accept PluginSettings in createRegistry

Disabled plugins are skipped during discovery.
Custom data directories are applied before checking existence.
Backward compatible — works without settings argument.
```

---

### Task 3: Add RPC types and frontend RPCClient for settings

**Files:**
- Modify: `src/shared/rpc-types.ts`
- Modify: `src/frontend/rpc.ts`
- Modify: `src/frontend/test-helpers/mock-rpc.ts`

**Step 1: Add types to `src/shared/rpc-types.ts`**

Add the `PluginSettingInfo` type after `VersionInfo`:

```typescript
export interface PluginSettingInfo {
  id: string;
  displayName: string;
  enabled: boolean;
  dataDir: string;
  defaultDataDir: string;
  isCustomDir: boolean;
}
```

Add three new requests inside the `bun.requests` block (after `searchSessions`):

```typescript
      getPluginSettings: {
        params: {};
        response: { plugins: PluginSettingInfo[] };
      };
      updatePluginSetting: {
        params: { pluginId: string; enabled?: boolean; dataDir?: string | null };
        response: { plugins: PluginSettingInfo[] };
      };
      browseDirectory: {
        params: { startingFolder?: string };
        response: { path: string | null };
      };
```

Add `openSettings` to the `webview.messages` block:

```typescript
      openSettings: {};
```

**Step 2: Update `src/frontend/rpc.ts`**

Add `PluginSettingInfo` import and three new methods to the `RPCClient.request` interface:

```typescript
import type { PluginSettingInfo } from "../shared/rpc-types.ts";
```

Add to the `request` object in `RPCClient`:

```typescript
    getPluginSettings: (params: Record<string, never>) => Promise<{ plugins: PluginSettingInfo[] }>;
    updatePluginSetting: (params: {
      pluginId: string;
      enabled?: boolean;
      dataDir?: string | null;
    }) => Promise<{ plugins: PluginSettingInfo[] }>;
    browseDirectory: (params: { startingFolder?: string }) => Promise<{ path: string | null }>;
```

**Step 3: Update `src/frontend/test-helpers/mock-rpc.ts`**

Add defaults for the three new RPC methods in `defaultMock.request`:

```typescript
      getPluginSettings: () => Promise.resolve({ plugins: [] }),
      updatePluginSetting: () => Promise.resolve({ plugins: [] }),
      browseDirectory: () => Promise.resolve({ path: null }),
```

**Step 4: Run full checks**

Run: `bun run check && bun run typecheck && bun test`
Expected: All pass (types are consistent, mock covers new methods)

**Step 5: Commit**

```
feat: add RPC types for plugin settings

Adds getPluginSettings, updatePluginSetting, browseDirectory requests
and openSettings webview message to the RPC schema.
```

---

### Task 4: Add RPC handlers for settings

**Files:**
- Modify: `src/bun/rpc-handlers.ts`
- Modify: `src/bun/index.ts`
- Test: `src/bun/settings-handlers.test.ts` (new file)

**Step 1: Write the failing tests**

```typescript
// src/bun/settings-handlers.test.ts
import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getPluginSettings, updatePluginSetting } from "./rpc-handlers.ts";
import { loadSettings, saveSettings, getDefaultSettings } from "./settings.ts";

const testDir = join(tmpdir(), "klovi-handlers-test-" + Date.now());
const settingsPath = join(testDir, "settings.json");

describe("settings RPC handlers", () => {
  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  test("getPluginSettings returns all three plugins", () => {
    mkdirSync(testDir, { recursive: true });
    saveSettings(settingsPath, getDefaultSettings());
    const result = getPluginSettings(settingsPath);
    expect(result.plugins).toHaveLength(3);
    expect(result.plugins.map((p) => p.id)).toEqual(["claude-code", "codex-cli", "opencode"]);
  });

  test("getPluginSettings shows enabled and default dirs", () => {
    mkdirSync(testDir, { recursive: true });
    saveSettings(settingsPath, getDefaultSettings());
    const result = getPluginSettings(settingsPath);
    const claude = result.plugins.find((p) => p.id === "claude-code")!;
    expect(claude.enabled).toBe(true);
    expect(claude.isCustomDir).toBe(false);
    expect(claude.dataDir).toBe(claude.defaultDataDir);
  });

  test("updatePluginSetting disables a plugin", () => {
    mkdirSync(testDir, { recursive: true });
    saveSettings(settingsPath, getDefaultSettings());
    const result = updatePluginSetting(settingsPath, { pluginId: "claude-code", enabled: false });
    const claude = result.plugins.find((p) => p.id === "claude-code")!;
    expect(claude.enabled).toBe(false);

    // Verify persisted
    const loaded = loadSettings(settingsPath);
    expect(loaded.plugins["claude-code"]!.enabled).toBe(false);
  });

  test("updatePluginSetting sets custom dataDir", () => {
    mkdirSync(testDir, { recursive: true });
    saveSettings(settingsPath, getDefaultSettings());
    const result = updatePluginSetting(settingsPath, {
      pluginId: "claude-code",
      dataDir: "/custom/path",
    });
    const claude = result.plugins.find((p) => p.id === "claude-code")!;
    expect(claude.dataDir).toBe("/custom/path");
    expect(claude.isCustomDir).toBe(true);
  });

  test("updatePluginSetting resets dataDir to default with null", () => {
    mkdirSync(testDir, { recursive: true });
    const settings = getDefaultSettings();
    settings.plugins["claude-code"]!.dataDir = "/custom/path";
    saveSettings(settingsPath, settings);

    const result = updatePluginSetting(settingsPath, {
      pluginId: "claude-code",
      dataDir: null,
    });
    const claude = result.plugins.find((p) => p.id === "claude-code")!;
    expect(claude.isCustomDir).toBe(false);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test src/bun/settings-handlers.test.ts`
Expected: FAIL — functions not exported from `rpc-handlers.ts`

**Step 3: Add handler functions to `src/bun/rpc-handlers.ts`**

Add imports at the top:

```typescript
import { loadSettings, saveSettings, getDefaultSettings } from "./settings.ts";
import type { PluginSettingInfo } from "../shared/rpc-types.ts";
import { getClaudeCodeDir, getCodexCliDir, getOpenCodeDir } from "../plugins/config.ts";
```

Add handler functions at the bottom:

```typescript
const PLUGIN_META: Array<{ id: string; displayName: string; getDefaultDir: () => string }> = [
  { id: "claude-code", displayName: "Claude Code", getDefaultDir: getClaudeCodeDir },
  { id: "codex-cli", displayName: "Codex CLI", getDefaultDir: getCodexCliDir },
  { id: "opencode", displayName: "OpenCode", getDefaultDir: getOpenCodeDir },
];

function buildPluginSettingsResponse(settingsPath: string): { plugins: PluginSettingInfo[] } {
  const settings = loadSettings(settingsPath);
  const plugins: PluginSettingInfo[] = PLUGIN_META.map(({ id, displayName, getDefaultDir }) => {
    const pluginConf = settings.plugins[id] ?? { enabled: true, dataDir: null };
    const defaultDataDir = getDefaultDir();
    const isCustomDir = pluginConf.dataDir !== null;
    return {
      id,
      displayName,
      enabled: pluginConf.enabled,
      dataDir: pluginConf.dataDir ?? defaultDataDir,
      defaultDataDir,
      isCustomDir,
    };
  });
  return { plugins };
}

export function getPluginSettings(settingsPath: string): { plugins: PluginSettingInfo[] } {
  return buildPluginSettingsResponse(settingsPath);
}

export function updatePluginSetting(
  settingsPath: string,
  params: { pluginId: string; enabled?: boolean; dataDir?: string | null },
): { plugins: PluginSettingInfo[] } {
  const settings = loadSettings(settingsPath);
  const existing = settings.plugins[params.pluginId] ?? { enabled: true, dataDir: null };

  if (params.enabled !== undefined) {
    existing.enabled = params.enabled;
  }
  if (params.dataDir !== undefined) {
    existing.dataDir = params.dataDir;
  }

  settings.plugins[params.pluginId] = existing;
  saveSettings(settingsPath, settings);
  return buildPluginSettingsResponse(settingsPath);
}
```

**Step 4: Run tests to verify they pass**

Run: `bun test src/bun/settings-handlers.test.ts`
Expected: All 5 tests PASS

**Step 5: Wire up handlers in `src/bun/index.ts`**

Add imports:

```typescript
import { openFileDialog } from "electrobun/bun";
import { getPluginSettings, updatePluginSetting } from "./rpc-handlers.ts";
import { loadSettings } from "./settings.ts";
import { paths } from "electrobun/bun";
```

Add a `getSettingsPath()` helper near the top (after `getRegistry()`):

```typescript
function getSettingsPath(): string {
  return join(paths.userData, "settings.json");
}
```

Note: You will need to import `join` from `"node:path"` if not already imported.

Add to `rpc.handlers.requests` (after `searchSessions`):

```typescript
      getPluginSettings: () => getPluginSettings(getSettingsPath()),
      updatePluginSetting: (params) => {
        const result = updatePluginSetting(getSettingsPath(), params);
        // Re-create registry with new settings
        registry = createRegistry(loadSettings(getSettingsPath()));
        return result;
      },
      browseDirectory: async (params) => {
        const paths = await openFileDialog({
          startingFolder: params.startingFolder ?? "~/",
          canChooseFiles: false,
          canChooseDirectory: true,
          allowsMultipleSelection: false,
        });
        const selected = paths[0];
        return { path: selected && selected !== "" ? selected : null };
      },
```

**Step 6: Modify `acceptRisks` to use settings**

Update the `acceptRisks` handler to read settings:

```typescript
      acceptRisks: async () => {
        if (!registry) {
          const settings = loadSettings(getSettingsPath());
          registry = createRegistry(settings);
        }
        return { ok: true };
      },
```

**Step 7: Run full checks**

Run: `bun run check && bun run typecheck && bun test`

**Step 8: Commit**

```
feat: add RPC handlers for plugin settings

getPluginSettings reads current settings and returns plugin metadata.
updatePluginSetting persists changes and re-creates the registry.
browseDirectory opens the native folder picker.
acceptRisks now reads settings.json to configure registry.
```

---

### Task 5: Add Preferences menu item and openSettings message

**Files:**
- Modify: `src/bun/index.ts` (menu + event handler)
- Modify: `src/views/main/index.ts` (message handler)

**Step 1: Add Preferences to App Menu in `src/bun/index.ts`**

In the first submenu (App menu), add the Preferences item between the separator and Quit:

```typescript
  {
    submenu: [
      { label: "About Klovi", role: "about" },
      { type: "separator" },
      { label: "Preferences...", action: "openSettings", accelerator: "CmdOrCtrl+," },
      { type: "separator" },
      { label: "Quit Klovi", role: "quit" },
    ],
  },
```

**Step 2: Add openSettings case to the menu event handler**

In the `application-menu-clicked` switch statement, add:

```typescript
    case "openSettings":
      rpcSend.openSettings({});
      break;
```

**Step 3: Add openSettings message handler in `src/views/main/index.ts`**

Add to the `messages` object in `Electroview.defineRPC`:

```typescript
      openSettings: () => {
        window.dispatchEvent(new CustomEvent("klovi:openSettings"));
      },
```

**Step 4: Run full checks**

Run: `bun run check && bun run typecheck && bun test`

**Step 5: Commit**

```
feat: add Preferences menu item with Cmd+, shortcut

Dispatches openSettings message to webview when clicked.
```

---

### Task 6: Create SettingsModal component

**Files:**
- Create: `src/frontend/components/settings/SettingsModal.tsx`
- Create: `src/frontend/components/settings/SettingsModal.css`
- Test: `src/frontend/components/settings/SettingsModal.test.tsx`

**Step 1: Write the failing tests**

```typescript
// src/frontend/components/settings/SettingsModal.test.tsx
import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import type { PluginSettingInfo } from "../../../shared/rpc-types.ts";
import { setupMockRPC } from "../../test-helpers/mock-rpc.ts";
import { SettingsModal } from "./SettingsModal.tsx";

function makePlugin(overrides: Partial<PluginSettingInfo> = {}): PluginSettingInfo {
  return {
    id: "claude-code",
    displayName: "Claude Code",
    enabled: true,
    dataDir: "/Users/test/.claude",
    defaultDataDir: "/Users/test/.claude",
    isCustomDir: false,
    ...overrides,
  };
}

describe("SettingsModal", () => {
  afterEach(cleanup);

  test("renders Settings heading", () => {
    setupMockRPC({
      getPluginSettings: () => Promise.resolve({ plugins: [makePlugin()] }),
    });
    const { getByText } = render(<SettingsModal onClose={mock()} />);
    expect(getByText("Settings")).toBeTruthy();
  });

  test("renders plugin list with display names", async () => {
    setupMockRPC({
      getPluginSettings: () =>
        Promise.resolve({
          plugins: [
            makePlugin({ id: "claude-code", displayName: "Claude Code" }),
            makePlugin({ id: "codex-cli", displayName: "Codex CLI" }),
          ],
        }),
    });
    const { findByText } = render(<SettingsModal onClose={mock()} />);
    await findByText("Claude Code");
    await findByText("Codex CLI");
  });

  test("renders checkbox for each plugin", async () => {
    setupMockRPC({
      getPluginSettings: () =>
        Promise.resolve({
          plugins: [
            makePlugin({ id: "claude-code", enabled: true }),
            makePlugin({ id: "codex-cli", enabled: false }),
          ],
        }),
    });
    const { findAllByRole } = render(<SettingsModal onClose={mock()} />);
    const checkboxes = await findAllByRole("checkbox");
    expect(checkboxes).toHaveLength(2);
    expect((checkboxes[0] as HTMLInputElement).checked).toBe(true);
    expect((checkboxes[1] as HTMLInputElement).checked).toBe(false);
  });

  test("renders data directory path", async () => {
    setupMockRPC({
      getPluginSettings: () =>
        Promise.resolve({
          plugins: [makePlugin({ dataDir: "/Users/test/.claude" })],
        }),
    });
    const { findByDisplayValue } = render(<SettingsModal onClose={mock()} />);
    await findByDisplayValue("/Users/test/.claude");
  });

  test("calls onClose when X button is clicked", async () => {
    const onClose = mock();
    setupMockRPC({
      getPluginSettings: () => Promise.resolve({ plugins: [makePlugin()] }),
    });
    const { findByLabelText } = render(<SettingsModal onClose={onClose} />);
    const closeBtn = await findByLabelText("Close settings");
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("calls onClose when Escape is pressed", async () => {
    const onClose = mock();
    setupMockRPC({
      getPluginSettings: () => Promise.resolve({ plugins: [makePlugin()] }),
    });
    const { container, findByText } = render(<SettingsModal onClose={onClose} />);
    await findByText("Claude Code");
    fireEvent.keyDown(container, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("calls onClose when backdrop is clicked", async () => {
    const onClose = mock();
    setupMockRPC({
      getPluginSettings: () => Promise.resolve({ plugins: [makePlugin()] }),
    });
    const { container, findByText } = render(<SettingsModal onClose={onClose} />);
    await findByText("Claude Code");
    const overlay = container.querySelector(".settings-overlay")!;
    fireEvent.mouseDown(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("shows Reset link when path is customized", async () => {
    setupMockRPC({
      getPluginSettings: () =>
        Promise.resolve({
          plugins: [makePlugin({ isCustomDir: true, dataDir: "/custom/path" })],
        }),
    });
    const { findByText } = render(<SettingsModal onClose={mock()} />);
    await findByText("Reset");
  });

  test("does not show Reset link for default path", async () => {
    setupMockRPC({
      getPluginSettings: () =>
        Promise.resolve({ plugins: [makePlugin({ isCustomDir: false })] }),
    });
    const { findByText, queryByText } = render(<SettingsModal onClose={mock()} />);
    await findByText("Claude Code");
    expect(queryByText("Reset")).toBeNull();
  });

  test("shows Plugins section tab as active", async () => {
    setupMockRPC({
      getPluginSettings: () => Promise.resolve({ plugins: [makePlugin()] }),
    });
    const { findByText } = render(<SettingsModal onClose={mock()} />);
    const tab = await findByText("Plugins");
    expect(tab.classList.contains("active") || tab.closest(".active")).toBeTruthy();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test src/frontend/components/settings/SettingsModal.test.tsx`
Expected: FAIL — module not found

**Step 3: Write the SettingsModal component**

```typescript
// src/frontend/components/settings/SettingsModal.tsx
import { useCallback, useEffect, useState } from "react";
import type { PluginSettingInfo } from "../../../shared/rpc-types.ts";
import { getRPC } from "../../rpc.ts";
import "./SettingsModal.css";

interface SettingsModalProps {
  onClose: () => void;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const [plugins, setPlugins] = useState<PluginSettingInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRPC()
      .request.getPluginSettings({} as Record<string, never>)
      .then((data) => {
        setPlugins(data.plugins);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleToggle = useCallback((pluginId: string, enabled: boolean) => {
    getRPC()
      .request.updatePluginSetting({ pluginId, enabled })
      .then((data) => setPlugins(data.plugins))
      .catch(() => {});
  }, []);

  const handleBrowse = useCallback((pluginId: string, currentDir: string) => {
    getRPC()
      .request.browseDirectory({ startingFolder: currentDir })
      .then((data) => {
        if (data.path) {
          return getRPC().request.updatePluginSetting({ pluginId, dataDir: data.path });
        }
        return null;
      })
      .then((data) => {
        if (data) setPlugins(data.plugins);
      })
      .catch(() => {});
  }, []);

  const handlePathChange = useCallback((pluginId: string, dataDir: string) => {
    getRPC()
      .request.updatePluginSetting({ pluginId, dataDir })
      .then((data) => setPlugins(data.plugins))
      .catch(() => {});
  }, []);

  const handleReset = useCallback((pluginId: string) => {
    getRPC()
      .request.updatePluginSetting({ pluginId, dataDir: null })
      .then((data) => setPlugins(data.plugins))
      .catch(() => {});
  }, []);

  return (
    <div className="settings-overlay" onMouseDown={onClose} onKeyDown={() => {}}>
      <div className="settings-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2 className="settings-title">Settings</h2>
          <button type="button" className="settings-close" aria-label="Close settings" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="settings-body">
          <nav className="settings-sidebar">
            <button type="button" className="settings-tab active">Plugins</button>
            <button type="button" className="settings-tab" disabled>General</button>
          </nav>
          <div className="settings-content">
            <h3 className="settings-section-title">Plugins</h3>
            {loading ? (
              <div className="settings-loading">Loading...</div>
            ) : (
              <div className="settings-plugin-list">
                {plugins.map((plugin) => (
                  <PluginRow
                    key={plugin.id}
                    plugin={plugin}
                    onToggle={handleToggle}
                    onBrowse={handleBrowse}
                    onPathChange={handlePathChange}
                    onReset={handleReset}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface PluginRowProps {
  plugin: PluginSettingInfo;
  onToggle: (pluginId: string, enabled: boolean) => void;
  onBrowse: (pluginId: string, currentDir: string) => void;
  onPathChange: (pluginId: string, dataDir: string) => void;
  onReset: (pluginId: string) => void;
}

function PluginRow({ plugin, onToggle, onBrowse, onPathChange, onReset }: PluginRowProps) {
  const [editingPath, setEditingPath] = useState(plugin.dataDir);

  useEffect(() => {
    setEditingPath(plugin.dataDir);
  }, [plugin.dataDir]);

  const handlePathBlur = () => {
    if (editingPath !== plugin.dataDir) {
      onPathChange(plugin.id, editingPath);
    }
  };

  const handlePathKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (editingPath !== plugin.dataDir) {
        onPathChange(plugin.id, editingPath);
      }
    }
  };

  return (
    <div className={`settings-plugin-row ${!plugin.enabled ? "disabled" : ""}`}>
      <div className="settings-plugin-header">
        <label className="settings-plugin-label">
          <input
            type="checkbox"
            checked={plugin.enabled}
            onChange={(e) => onToggle(plugin.id, e.target.checked)}
          />
          <span className="settings-plugin-name">{plugin.displayName}</span>
        </label>
      </div>
      <div className="settings-plugin-path">
        <input
          type="text"
          className="settings-path-input"
          value={editingPath}
          onChange={(e) => setEditingPath(e.target.value)}
          onBlur={handlePathBlur}
          onKeyDown={handlePathKeyDown}
          disabled={!plugin.enabled}
        />
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => onBrowse(plugin.id, plugin.dataDir)}
          disabled={!plugin.enabled}
        >
          Browse
        </button>
        {plugin.isCustomDir && (
          <button
            type="button"
            className="settings-reset-link"
            onClick={() => onReset(plugin.id)}
            disabled={!plugin.enabled}
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
```

**Step 4: Write the CSS**

```css
/* src/frontend/components/settings/SettingsModal.css */
.settings-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.settings-modal {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-lg);
  width: 640px;
  max-width: 90vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.settings-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.settings-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}

.settings-close:hover {
  color: var(--text-primary);
}

.settings-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.settings-sidebar {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px;
  border-right: 1px solid var(--border);
  min-width: 120px;
}

.settings-tab {
  background: none;
  border: none;
  padding: 8px 12px;
  text-align: left;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.settings-tab:hover:not(:disabled) {
  background: var(--bg-secondary);
}

.settings-tab.active {
  background: var(--accent-subtle);
  color: var(--accent);
  font-weight: 500;
}

.settings-tab:disabled {
  color: var(--text-muted);
  cursor: default;
  opacity: 0.5;
}

.settings-content {
  flex: 1;
  padding: 16px 20px;
  overflow-y: auto;
}

.settings-section-title {
  font-size: 0.95rem;
  font-weight: 600;
  margin: 0 0 16px;
  color: var(--text-primary);
}

.settings-loading {
  color: var(--text-muted);
  padding: 20px 0;
}

.settings-plugin-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settings-plugin-row {
  padding: 12px;
  border: 1px solid var(--border-light);
  background: var(--bg-primary);
}

.settings-plugin-row.disabled {
  opacity: 0.6;
}

.settings-plugin-header {
  margin-bottom: 8px;
}

.settings-plugin-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.settings-plugin-name {
  font-weight: 500;
  color: var(--text-primary);
}

.settings-plugin-path {
  display: flex;
  gap: 8px;
  align-items: center;
}

.settings-path-input {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 0.85rem;
}

.settings-path-input:focus {
  outline: none;
  border-color: var(--accent);
}

.settings-path-input:disabled {
  opacity: 0.5;
}

.settings-reset-link {
  background: none;
  border: none;
  color: var(--accent);
  cursor: pointer;
  font-size: 0.85rem;
  padding: 0;
  white-space: nowrap;
}

.settings-reset-link:hover {
  text-decoration: underline;
}

.settings-reset-link:disabled {
  opacity: 0.5;
  cursor: default;
}
```

**Step 5: Run tests to verify they pass**

Run: `bun test src/frontend/components/settings/SettingsModal.test.tsx`
Expected: All 10 tests PASS

**Step 6: Run full checks**

Run: `bun run check && bun run typecheck && bun test`

**Step 7: Commit**

```
feat: add SettingsModal component with plugin configuration

Full-screen modal overlay with section tabs (Plugins active, General disabled).
Each plugin shows checkbox, path input, Browse button, and Reset link.
```

---

### Task 7: Wire SettingsModal into App

**Files:**
- Modify: `src/frontend/App.tsx`

**Step 1: Add state and event listeners**

Add import at top:

```typescript
import { SettingsModal } from "./components/settings/SettingsModal.tsx";
```

Add state in `App()`:

```typescript
const [settingsOpen, setSettingsOpen] = useState(false);
```

Add `Cmd+,` keyboard shortcut handler. In the `handleCmdK` useEffect, add a new parallel useEffect:

```typescript
  // Cmd+, opens settings
  useEffect(() => {
    function handleCmdComma(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        setSettingsOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleCmdComma);
    return () => window.removeEventListener("keydown", handleCmdComma);
  }, []);
```

Add `klovi:openSettings` listener in the menu events useEffect:

```typescript
    const handleOpenSettings = () => setSettingsOpen(true);
    window.addEventListener("klovi:openSettings", handleOpenSettings);
    // ... in cleanup:
    window.removeEventListener("klovi:openSettings", handleOpenSettings);
```

Add the modal to the JSX (alongside SearchModal):

```typescript
      {settingsOpen && (
        <SettingsModal onClose={() => setSettingsOpen(false)} />
      )}
```

**Step 2: Run full checks**

Run: `bun run check && bun run typecheck && bun test`

**Step 3: Commit**

```
feat: wire SettingsModal into App with Cmd+, shortcut

Settings opens via App Menu > Preferences or Cmd+, keyboard shortcut.
Listens for klovi:openSettings custom event from menu dispatch.
```

---

### Task 8: Manual QA and polish

**Step 1: Run the app**

Run: `bun run dev`

**Step 2: Test the following manually**

- Click App Menu > Preferences → settings modal opens
- Press `Cmd+,` → settings modal opens
- All 3 plugins listed with correct names and paths
- Toggle a plugin off → checkbox unchecks, path controls dim
- Click Browse → native folder picker opens
- Select a folder → path updates in the input
- Click Reset → path reverts to default
- Press Escape → modal closes
- Click backdrop → modal closes
- Toggle dark/light theme → settings modal renders correctly in both

**Step 3: Fix any issues found during QA**

**Step 4: Run final checks**

Run: `bun run check && bun run typecheck && bun test`

**Step 5: Commit any polish fixes**

```
fix: polish settings modal after manual QA
```
