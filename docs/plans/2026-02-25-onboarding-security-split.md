# Onboarding / Security Warning Split — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Separate the one-time onboarding wizard from the recurring security warning so onboarding runs only on first launch and the security warning shows on every subsequent launch (unless opted out).

**Architecture:** Add an `isFirstLaunch` RPC that checks if `settings.json` exists on disk (no file = first launch). AppGate branches: first launch → full 2-step Onboarding; not first launch + `showSecurityWarning=true` → new standalone SecurityWarning screen; not first launch + `showSecurityWarning=false` → straight to App. A new `SecurityWarning` component reuses Step 1 content with an "Accept & Continue" button and "Don't show this again" checkbox.

**Tech Stack:** React 19, TypeScript strict, Electrobun RPC, Bun test, @testing-library/react

---

### Task 1: Add `isFirstLaunch` RPC — backend

**Files:**
- Modify: `src/shared/rpc-types.ts:28` (add RPC definition)
- Modify: `src/bun/rpc-handlers.ts:154` (add handler function)
- Modify: `src/bun/index.ts:55` (register handler)
- Modify: `src/frontend/test-helpers/mock-rpc.ts:42` (add mock default)
- Test: `src/bun/settings-handlers.test.ts`

**Step 1: Write the failing tests**

Add to `src/bun/settings-handlers.test.ts`:

```ts
test("isFirstLaunch returns true when settings file does not exist", () => {
  // testDir cleaned by afterEach — no settings file present
  const result = isFirstLaunch(settingsPath);
  expect(result.firstLaunch).toBe(true);
});

test("isFirstLaunch returns false when settings file exists", () => {
  mkdirSync(testDir, { recursive: true });
  saveSettings(settingsPath, getDefaultSettings());
  const result = isFirstLaunch(settingsPath);
  expect(result.firstLaunch).toBe(false);
});
```

Import `isFirstLaunch` alongside existing imports from `./rpc-handlers.ts`.

**Step 2: Run tests to verify they fail**

Run: `bun test src/bun/settings-handlers.test.ts`
Expected: FAIL — `isFirstLaunch` is not exported from `./rpc-handlers.ts`

**Step 3: Add the RPC type definition**

In `src/shared/rpc-types.ts`, add inside `requests` (after `acceptRisks`):

```ts
isFirstLaunch: { params: {}; response: { firstLaunch: boolean } };
```

**Step 4: Implement the handler**

In `src/bun/rpc-handlers.ts`, add after the `getGeneralSettings` function:

```ts
export function isFirstLaunch(settingsPath: string): { firstLaunch: boolean } {
  return { firstLaunch: !existsSync(settingsPath) };
}
```

Add `existsSync` to the `node:fs` import (already imported in `settings.ts` but check `rpc-handlers.ts`). Actually `rpc-handlers.ts` doesn't import `existsSync` — add it:

```ts
import { existsSync } from "node:fs";
```

**Step 5: Register the handler in main process**

In `src/bun/index.ts`, add import of `isFirstLaunch` from `./rpc-handlers.ts`, then add handler:

```ts
isFirstLaunch: () => isFirstLaunch(getSettingsPath()),
```

Place it next to `getGeneralSettings` (ungated — before registry checks).

**Step 6: Add mock default**

In `src/frontend/test-helpers/mock-rpc.ts`, add to `defaultMock.request`:

```ts
isFirstLaunch: () => Promise.resolve({ firstLaunch: false }),
```

Note: default `false` (not first launch) so existing tests behave as "returning user."

Also add `isFirstLaunch` to the `RPCClient` type if it's auto-derived from `KloviRPC` — check `src/frontend/rpc.ts`.

**Step 7: Run tests to verify they pass**

Run: `bun test src/bun/settings-handlers.test.ts`
Expected: PASS (all existing + 2 new)

**Step 8: Run full checks**

Run: `bun run check && bun run typecheck && bun test`

**Step 9: Commit**

```bash
git add src/shared/rpc-types.ts src/bun/rpc-handlers.ts src/bun/index.ts src/bun/settings-handlers.test.ts src/frontend/test-helpers/mock-rpc.ts
git commit -m "feat: add isFirstLaunch RPC to detect first app launch"
```

---

### Task 2: Create SecurityWarning component

**Files:**
- Create: `src/frontend/components/ui/SecurityWarning.tsx`
- Create: `src/frontend/components/ui/SecurityWarning.test.tsx`
- Reuse: `src/frontend/components/ui/Onboarding.css` (same styles)

**Step 1: Write the failing tests**

Create `src/frontend/components/ui/SecurityWarning.test.tsx`:

```tsx
import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { SecurityWarning } from "./SecurityWarning.tsx";

describe("SecurityWarning", () => {
  afterEach(cleanup);

  test("renders Session Data Notice heading", () => {
    const { getByText } = render(
      <SecurityWarning onAccept={() => {}} onDontShowAgain={() => {}} />,
    );
    expect(getByText("Session Data Notice")).toBeTruthy();
  });

  test("renders sensitive information text", () => {
    const { getByText } = render(
      <SecurityWarning onAccept={() => {}} onDontShowAgain={() => {}} />,
    );
    expect(getByText(/sensitive information/)).toBeTruthy();
  });

  test("renders fully local text", () => {
    const { getByText } = render(
      <SecurityWarning onAccept={() => {}} onDontShowAgain={() => {}} />,
    );
    expect(getByText(/fully local/)).toBeTruthy();
  });

  test("renders Accept & Continue button", () => {
    const { getByRole } = render(
      <SecurityWarning onAccept={() => {}} onDontShowAgain={() => {}} />,
    );
    expect(getByRole("button", { name: "Accept & Continue" })).toBeTruthy();
  });

  test("renders Don't show this again checkbox", () => {
    const { getByLabelText } = render(
      <SecurityWarning onAccept={() => {}} onDontShowAgain={() => {}} />,
    );
    expect(getByLabelText("Don't show this again")).toBeTruthy();
  });

  test("clicking Accept & Continue calls onAccept", () => {
    const onAccept = mock(() => {});
    const { getByRole } = render(
      <SecurityWarning onAccept={onAccept} onDontShowAgain={() => {}} />,
    );
    fireEvent.click(getByRole("button", { name: "Accept & Continue" }));
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  test("checking checkbox and clicking Accept calls onDontShowAgain", () => {
    const onDontShowAgain = mock(() => {});
    const onAccept = mock(() => {});
    const { getByRole, getByLabelText } = render(
      <SecurityWarning onAccept={onAccept} onDontShowAgain={onDontShowAgain} />,
    );
    fireEvent.click(getByLabelText("Don't show this again"));
    fireEvent.click(getByRole("button", { name: "Accept & Continue" }));
    expect(onDontShowAgain).toHaveBeenCalledTimes(1);
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  test("clicking Accept without checkbox does not call onDontShowAgain", () => {
    const onDontShowAgain = mock(() => {});
    const onAccept = mock(() => {});
    const { getByRole } = render(
      <SecurityWarning onAccept={onAccept} onDontShowAgain={onDontShowAgain} />,
    );
    fireEvent.click(getByRole("button", { name: "Accept & Continue" }));
    expect(onDontShowAgain).not.toHaveBeenCalled();
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  test("renders Klovi logo", () => {
    const { container } = render(
      <SecurityWarning onAccept={() => {}} onDontShowAgain={() => {}} />,
    );
    expect(container.querySelector(".onboarding-logo")).not.toBeNull();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test src/frontend/components/ui/SecurityWarning.test.tsx`
Expected: FAIL — module not found

**Step 3: Implement SecurityWarning component**

Create `src/frontend/components/ui/SecurityWarning.tsx`:

```tsx
import { useState } from "react";
import faviconUrl from "../../../../favicon.svg";
import "./Onboarding.css";

interface SecurityWarningProps {
  onAccept: () => void;
  onDontShowAgain: () => void;
}

export function SecurityWarning({ onAccept, onDontShowAgain }: SecurityWarningProps) {
  const [dontShow, setDontShow] = useState(false);

  const handleAccept = () => {
    if (dontShow) {
      onDontShowAgain();
    }
    onAccept();
  };

  return (
    <div className="onboarding" role="region" aria-labelledby="security-warning-heading">
      <div className="onboarding-content">
        <img src={faviconUrl} alt="" width="64" height="64" className="onboarding-logo" />
        <h1 id="security-warning-heading" className="onboarding-heading">
          Session Data Notice
        </h1>
        <p>
          Klovi reads AI coding session history from your local machine. Session data may contain
          sensitive information such as API keys, credentials, or private code snippets.
        </p>
        <p>
          Klovi is fully local — your data never leaves your machine. Klovi is open source, so you
          can verify this yourself.
        </p>
        <p className="onboarding-muted">
          Be mindful when screen sharing or using Klovi in public settings.
        </p>
        <label className="onboarding-muted" style={{ display: "block", marginTop: "16px" }}>
          <input
            type="checkbox"
            className="custom-checkbox"
            checked={dontShow}
            onChange={(e) => setDontShow(e.target.checked)}
          />
          {" Don't show this again"}
        </label>
        <button type="button" className="onboarding-button" onClick={handleAccept}>
          Accept & Continue
        </button>
      </div>
    </div>
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `bun test src/frontend/components/ui/SecurityWarning.test.tsx`
Expected: PASS (all 9 tests)

**Step 5: Run full checks**

Run: `bun run check && bun run typecheck && bun test`

**Step 6: Commit**

```bash
git add src/frontend/components/ui/SecurityWarning.tsx src/frontend/components/ui/SecurityWarning.test.tsx
git commit -m "feat: add standalone SecurityWarning component"
```

---

### Task 3: Update AppGate to branch on first launch vs returning user

**Files:**
- Modify: `src/frontend/App.tsx:307-355` (rewrite AppGate logic)
- Modify: `src/frontend/AppGate.test.tsx` (rewrite tests for new flow)

**Step 1: Rewrite AppGate tests**

Replace the content of `src/frontend/AppGate.test.tsx` with:

```tsx
import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { AppGate } from "./App.tsx";
import { setupMockRPC } from "./test-helpers/mock-rpc.ts";

describe("AppGate", () => {
  afterEach(cleanup);

  // --- First launch (isFirstLaunch=true): show full Onboarding ---

  test("shows full onboarding on first launch", async () => {
    setupMockRPC({
      isFirstLaunch: () => Promise.resolve({ firstLaunch: true }),
    });
    const { findByText } = render(<AppGate />);
    expect(await findByText("Session Data Notice")).toBeTruthy();
  });

  test("first launch: completing onboarding shows App", async () => {
    setupMockRPC({
      isFirstLaunch: () => Promise.resolve({ firstLaunch: true }),
      acceptRisks: () => Promise.resolve({ ok: true }),
      getPluginSettings: () => Promise.resolve({ plugins: [] }),
    });
    const { findByRole, findByText } = render(<AppGate />);
    const nextBtn = await findByRole("button", { name: "Next" });
    fireEvent.click(nextBtn);
    const startBtn = await findByRole("button", { name: "Get Started" });
    fireEvent.click(startBtn);
    await findByText("Welcome to Klovi");
  });

  test("first launch: saves showSecurityWarning=false on complete", async () => {
    const updateGeneralSettings = mock(() => Promise.resolve({ showSecurityWarning: false }));
    setupMockRPC({
      isFirstLaunch: () => Promise.resolve({ firstLaunch: true }),
      updateGeneralSettings,
      getPluginSettings: () => Promise.resolve({ plugins: [] }),
    });
    const { findByRole } = render(<AppGate />);
    const nextBtn = await findByRole("button", { name: "Next" });
    fireEvent.click(nextBtn);
    const startBtn = await findByRole("button", { name: "Get Started" });
    fireEvent.click(startBtn);
    expect(updateGeneralSettings).toHaveBeenCalledWith({ showSecurityWarning: false });
  });

  // --- Returning user + showSecurityWarning=true: show SecurityWarning ---

  test("returning user with warning enabled sees security warning", async () => {
    setupMockRPC({
      isFirstLaunch: () => Promise.resolve({ firstLaunch: false }),
      getGeneralSettings: () => Promise.resolve({ showSecurityWarning: true }),
    });
    const { findByRole } = render(<AppGate />);
    expect(await findByRole("button", { name: "Accept & Continue" })).toBeTruthy();
  });

  test("returning user: Accept & Continue shows App", async () => {
    setupMockRPC({
      isFirstLaunch: () => Promise.resolve({ firstLaunch: false }),
      getGeneralSettings: () => Promise.resolve({ showSecurityWarning: true }),
      acceptRisks: () => Promise.resolve({ ok: true }),
    });
    const { findByRole, findByText } = render(<AppGate />);
    const btn = await findByRole("button", { name: "Accept & Continue" });
    fireEvent.click(btn);
    await findByText("Welcome to Klovi");
  });

  test("returning user: checking dont-show saves setting", async () => {
    const updateGeneralSettings = mock(() => Promise.resolve({ showSecurityWarning: false }));
    setupMockRPC({
      isFirstLaunch: () => Promise.resolve({ firstLaunch: false }),
      getGeneralSettings: () => Promise.resolve({ showSecurityWarning: true }),
      acceptRisks: () => Promise.resolve({ ok: true }),
      updateGeneralSettings,
    });
    const { findByRole, findByLabelText } = render(<AppGate />);
    const checkbox = await findByLabelText("Don't show this again");
    fireEvent.click(checkbox);
    const btn = await findByRole("button", { name: "Accept & Continue" });
    fireEvent.click(btn);
    expect(updateGeneralSettings).toHaveBeenCalledWith({ showSecurityWarning: false });
  });

  // --- Returning user + showSecurityWarning=false: skip straight to App ---

  test("returning user with warning disabled skips to App", async () => {
    const acceptRisks = mock(() => Promise.resolve({ ok: true }));
    setupMockRPC({
      isFirstLaunch: () => Promise.resolve({ firstLaunch: false }),
      getGeneralSettings: () => Promise.resolve({ showSecurityWarning: false }),
      acceptRisks,
    });
    const { findByText } = render(<AppGate />);
    await findByText("Welcome to Klovi");
    expect(acceptRisks).toHaveBeenCalledTimes(1);
  });

  // --- Error handling ---

  test("shows onboarding when isFirstLaunch fails", async () => {
    setupMockRPC({
      isFirstLaunch: () => Promise.reject(new Error("RPC failed")),
    });
    const { findByText } = render(<AppGate />);
    expect(await findByText("Session Data Notice")).toBeTruthy();
  });

  test("App renders even if acceptRisks RPC fails", async () => {
    setupMockRPC({
      isFirstLaunch: () => Promise.resolve({ firstLaunch: true }),
      acceptRisks: () => Promise.reject(new Error("RPC failed")),
      getPluginSettings: () => Promise.resolve({ plugins: [] }),
    });
    const { findByRole, findByText } = render(<AppGate />);
    const nextBtn = await findByRole("button", { name: "Next" });
    fireEvent.click(nextBtn);
    const startBtn = await findByRole("button", { name: "Get Started" });
    fireEvent.click(startBtn);
    await findByText("Welcome to Klovi");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test src/frontend/AppGate.test.tsx`
Expected: FAIL — AppGate doesn't call `isFirstLaunch` yet

**Step 3: Update AppGate implementation**

Replace the `AppGate` function in `src/frontend/App.tsx` (lines 307-355) with:

```tsx
export function AppGate() {
  useTheme();
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<"onboarding" | "security-warning" | "none">("onboarding");

  useEffect(() => {
    getRPC()
      .request.isFirstLaunch({} as Record<string, never>)
      .then((data) => {
        if (data.firstLaunch) {
          setScreen("onboarding");
          setLoading(false);
          return;
        }
        return getRPC()
          .request.getGeneralSettings({} as Record<string, never>)
          .then((settings) => {
            if (settings.showSecurityWarning) {
              setScreen("security-warning");
            } else {
              setScreen("none");
              return getRPC()
                .request.acceptRisks({} as Record<string, never>)
                .then(() => setAccepted(true))
                .catch(() => setAccepted(true));
            }
          });
      })
      .catch(() => {
        // On failure, assume first launch (safe fallback)
        setScreen("onboarding");
      })
      .finally(() => setLoading(false));
  }, []);

  const handleOnboardingComplete = useCallback(() => {
    getRPC()
      .request.acceptRisks({} as Record<string, never>)
      .then(() => setAccepted(true))
      .catch(() => setAccepted(true));

    getRPC()
      .request.updateGeneralSettings({ showSecurityWarning: false })
      .catch(() => {});
  }, []);

  const handleSecurityAccept = useCallback(() => {
    getRPC()
      .request.acceptRisks({} as Record<string, never>)
      .then(() => setAccepted(true))
      .catch(() => setAccepted(true));
  }, []);

  const handleDontShowAgain = useCallback(() => {
    getRPC()
      .request.updateGeneralSettings({ showSecurityWarning: false })
      .catch(() => {});
  }, []);

  if (loading) {
    return null;
  }

  if (!accepted && screen === "onboarding") {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  if (!accepted && screen === "security-warning") {
    return <SecurityWarning onAccept={handleSecurityAccept} onDontShowAgain={handleDontShowAgain} />;
  }

  if (!accepted) {
    return null;
  }

  return <App />;
}
```

Add the `SecurityWarning` import at the top of the file:

```ts
import { SecurityWarning } from "./components/ui/SecurityWarning.tsx";
```

**Step 4: Run tests to verify they pass**

Run: `bun test src/frontend/AppGate.test.tsx`
Expected: PASS (all 9 tests)

**Step 5: Run full checks**

Run: `bun run check && bun run typecheck && bun test`

**Step 6: Commit**

```bash
git add src/frontend/App.tsx src/frontend/AppGate.test.tsx
git commit -m "feat: split AppGate into onboarding vs security warning paths"
```

---

### Task 4: Update Settings label and tests

**Files:**
- Modify: `src/frontend/components/settings/SettingsView.tsx:237-241` (rename label + hint)
- Modify: `src/frontend/components/settings/SettingsView.test.tsx` (update label assertions)

**Step 1: Update the test assertions first**

In `src/frontend/components/settings/SettingsView.test.tsx`:

- Change `"Show on-boarding on startup"` to `"Show security warning on startup"` everywhere (2 occurrences: the `findByText` in the first test and the `findByLabelText` in the "reflects persisted value" test).

**Step 2: Run tests to verify they fail**

Run: `bun test src/frontend/components/settings/SettingsView.test.tsx`
Expected: FAIL — label not found

**Step 3: Update SettingsView label and hint**

In `src/frontend/components/settings/SettingsView.tsx`, change line 237:

```
Show on-boarding on startup
```
to:
```
Show security warning on startup
```

Change the hint text (line 239-241):

```
When enabled, the on-boarding wizard is shown the next time Klovi launches.
```
to:
```
When enabled, the security warning is shown each time Klovi launches.
```

**Step 4: Run tests to verify they pass**

Run: `bun test src/frontend/components/settings/SettingsView.test.tsx`
Expected: PASS

**Step 5: Run full checks**

Run: `bun run check && bun run typecheck && bun test`

**Step 6: Commit**

```bash
git add src/frontend/components/settings/SettingsView.tsx src/frontend/components/settings/SettingsView.test.tsx
git commit -m "fix: rename settings label to 'Show security warning on startup'"
```

---

### Task 5: Final verification

**Step 1: Run all checks**

Run: `bun run check && bun run typecheck && bun test`
Expected: All pass, no regressions.

**Step 2: Manual smoke test (optional)**

Run: `bun run dev`

- Delete `settings.json` to simulate first launch → should see full 2-step onboarding
- Complete onboarding → should see App, `settings.json` created
- Restart → should see security warning with "Accept & Continue" + checkbox
- Check "Don't show this again" + accept → restart → should skip to App
- Go to Settings > General → toggle should read "Show security warning on startup"
