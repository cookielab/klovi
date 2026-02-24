# Security Warning Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show a full-screen security warning on every app launch that blocks all filesystem access until the user clicks "Continue".

**Architecture:** A new `acceptRisks` RPC endpoint gates registry creation in the main process. The frontend mounts an `AppGate` wrapper that renders either `SecurityWarning` (blocking) or `App` (normal). No session files are read until the user explicitly accepts.

**Tech Stack:** React 19, Electrobun RPC, Bun, plain CSS with CSS custom properties

---

### Task 1: Add `acceptRisks` to RPC type schema

**Files:**
- Modify: `src/shared/rpc-types.ts:16-50`
- Modify: `src/frontend/rpc.ts:9-23`
- Modify: `src/frontend/test-helpers/mock-rpc.ts:1-43`

**Step 1: Add `acceptRisks` request to KloviRPC**

In `src/shared/rpc-types.ts`, add to the `requests` object inside the `bun` schema:

```ts
acceptRisks: { params: {}; response: { ok: boolean } };
```

Add it as the first entry in `requests` (before `getVersion`).

**Step 2: Add `acceptRisks` to RPCClient interface**

In `src/frontend/rpc.ts`, add to the `request` interface:

```ts
acceptRisks: (params: Record<string, never>) => Promise<{ ok: boolean }>;
```

**Step 3: Add `acceptRisks` to mock RPC**

In `src/frontend/test-helpers/mock-rpc.ts`, add to `defaultMock.request`:

```ts
acceptRisks: () => Promise.resolve({ ok: true }),
```

**Step 4: Run typecheck**

Run: `bun run typecheck`
Expected: PASS (types are consistent across all three files)

**Step 5: Commit**

```bash
git add src/shared/rpc-types.ts src/frontend/rpc.ts src/frontend/test-helpers/mock-rpc.ts
git commit -m "feat(rpc): add acceptRisks request type"
```

---

### Task 2: Lazy registry in main process

**Files:**
- Modify: `src/bun/index.ts:1-29`
- Modify: `src/bun/rpc-handlers.ts:21-24`
- Modify: `src/parser/stats.ts:165-169`

**Step 1: Replace eager registry with lazy init in `src/bun/index.ts`**

Replace the top of the file. Remove:

```ts
import { createRegistry } from "../plugins/auto-discover.ts";
// ...
const registry = createRegistry();
```

Replace with a mutable `registry` variable, an `acceptRisks` handler that initializes it, and guard all data handlers:

```ts
import { createRegistry } from "../plugins/auto-discover.ts";
import type { PluginRegistry } from "../plugins/registry.ts";
import type { KloviRPC } from "../shared/rpc-types.ts";
import {
  getProjects,
  getSession,
  getSessions,
  getStats,
  getSubAgent,
  getVersion,
  searchSessions,
} from "./rpc-handlers.ts";

let registry: PluginRegistry | null = null;

function getRegistry(): PluginRegistry {
  if (!registry) throw new Error("Risk not accepted yet");
  return registry;
}

const rpc = BrowserView.defineRPC<KloviRPC>({
  handlers: {
    requests: {
      acceptRisks: () => {
        if (!registry) {
          registry = createRegistry();
        }
        return { ok: true };
      },
      getVersion: () => getVersion(),
      getStats: () => getStats(getRegistry()),
      getProjects: () => getProjects(getRegistry()),
      getSessions: (params) => getSessions(getRegistry(), params),
      getSession: (params) => getSession(getRegistry(), params),
      getSubAgent: (params) => getSubAgent(getRegistry(), params),
      searchSessions: () => searchSessions(getRegistry()),
    },
    messages: {},
  },
});
```

**Step 2: Update `getStats` in `rpc-handlers.ts` to require registry param**

Change the `getStats` function to accept a registry parameter:

```ts
export async function getStats(registry: PluginRegistry) {
  const stats = await scanStats(registry);
  return { stats };
}
```

**Step 3: Update `scanStats` to require registry (no default)**

In `src/parser/stats.ts`, change the signature from:

```ts
export async function scanStats(
  registry: PluginRegistry = createRegistry(),
): Promise<DashboardStats> {
```

To:

```ts
export async function scanStats(registry: PluginRegistry): Promise<DashboardStats> {
```

Remove the unused `createRegistry` import from `src/parser/stats.ts`.

**Step 4: Run typecheck and tests**

Run: `bun run typecheck && bun test`
Expected: PASS — existing tests that call `scanStats()` may need a registry argument. Check and fix if needed.

**Step 5: Commit**

```bash
git add src/bun/index.ts src/bun/rpc-handlers.ts src/parser/stats.ts
git commit -m "feat(main): defer registry creation until acceptRisks RPC"
```

---

### Task 3: Create SecurityWarning component

**Files:**
- Create: `src/frontend/components/ui/SecurityWarning.tsx`
- Create: `src/frontend/components/ui/SecurityWarning.test.tsx`

**Step 1: Write the failing test**

Create `src/frontend/components/ui/SecurityWarning.test.tsx`:

```tsx
import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { SecurityWarning } from "./SecurityWarning.tsx";

describe("SecurityWarning", () => {
  afterEach(cleanup);

  test("renders warning heading and text", () => {
    const { getByText } = render(<SecurityWarning onAccept={() => {}} />);
    expect(getByText("Session Data Notice")).toBeTruthy();
    expect(getByText(/sensitive information/)).toBeTruthy();
    expect(getByText(/fully local/)).toBeTruthy();
    expect(getByText(/open source/)).toBeTruthy();
  });

  test("renders Continue button", () => {
    const { getByRole } = render(<SecurityWarning onAccept={() => {}} />);
    expect(getByRole("button", { name: "Continue" })).toBeTruthy();
  });

  test("calls onAccept when Continue is clicked", () => {
    let called = false;
    const { getByRole } = render(<SecurityWarning onAccept={() => { called = true; }} />);
    fireEvent.click(getByRole("button", { name: "Continue" }));
    expect(called).toBe(true);
  });

  test("renders Klovi logo", () => {
    const { container } = render(<SecurityWarning onAccept={() => {}} />);
    const img = container.querySelector(".security-warning-logo");
    expect(img).not.toBeNull();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test src/frontend/components/ui/SecurityWarning.test.tsx`
Expected: FAIL — module not found

**Step 3: Implement SecurityWarning component**

Create `src/frontend/components/ui/SecurityWarning.tsx`:

```tsx
import faviconUrl from "../../../../favicon.svg";

interface SecurityWarningProps {
  onAccept: () => void;
}

export function SecurityWarning({ onAccept }: SecurityWarningProps) {
  return (
    <div className="security-warning">
      <div className="security-warning-content">
        <img
          src={faviconUrl}
          alt=""
          width="64"
          height="64"
          className="security-warning-logo"
        />
        <h1 className="security-warning-heading">Session Data Notice</h1>
        <p>
          Klovi reads AI coding session history from your local machine. Session
          data may contain sensitive information such as API keys, credentials,
          or private code snippets.
        </p>
        <p>
          Klovi is fully local — your data never leaves your machine. Klovi is
          open source, so you can verify this yourself.
        </p>
        <p className="security-warning-muted">
          Be mindful when screen sharing or using Klovi in public settings.
        </p>
        <button
          type="button"
          className="security-warning-button"
          onClick={onAccept}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `bun test src/frontend/components/ui/SecurityWarning.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/frontend/components/ui/SecurityWarning.tsx src/frontend/components/ui/SecurityWarning.test.tsx
git commit -m "feat(ui): add SecurityWarning component"
```

---

### Task 4: Add CSS styles for SecurityWarning

**Files:**
- Modify: `src/frontend/App.css` (append after `.empty-state-title` block, around line 1176)

**Step 1: Add warning page styles**

Append these styles to `src/frontend/App.css` after the `.empty-state-title` rule (around line 1176):

```css
/* Security warning gate */
.security-warning {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: var(--bg-primary);
  padding: 20px;
}

.security-warning-content {
  max-width: 480px;
  text-align: center;
  color: var(--text-secondary);
  line-height: 1.6;
}

.security-warning-logo {
  margin-bottom: 20px;
  opacity: 0.8;
}

.security-warning-heading {
  font-size: 1.3rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 16px;
}

.security-warning-muted {
  color: var(--text-muted);
  font-size: 0.85rem;
}

.security-warning-button {
  margin-top: 24px;
  padding: 10px 32px;
  font-size: 0.95rem;
  font-weight: 500;
  font-family: var(--font-body);
  color: var(--text-inverse);
  background: var(--accent);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}

.security-warning-button:hover {
  background: var(--accent-hover);
}
```

**Step 2: Run lint/format check**

Run: `bun run check`
Expected: PASS

**Step 3: Commit**

```bash
git add src/frontend/App.css
git commit -m "style: add SecurityWarning page styles"
```

---

### Task 5: Create AppGate wrapper and wire up entry point

**Files:**
- Modify: `src/frontend/App.tsx:1-234` (add `AppGate` export)
- Modify: `src/views/main/index.ts:48-49` (mount `AppGate`)

**Step 1: Add AppGate to App.tsx**

At the top of `src/frontend/App.tsx`, add the import:

```ts
import { SecurityWarning } from "./components/ui/SecurityWarning.tsx";
import { getRPC } from "./rpc.ts";
```

Note: `getRPC` is already imported, so just add the `SecurityWarning` import.

At the bottom of the file (after the `App` function), add:

```tsx
export function AppGate() {
  const [accepted, setAccepted] = useState(false);

  const handleAccept = useCallback(() => {
    getRPC()
      .request.acceptRisks({} as Record<string, never>)
      .then(() => setAccepted(true))
      .catch(() => setAccepted(true));
  }, []);

  if (!accepted) {
    return <SecurityWarning onAccept={handleAccept} />;
  }

  return <App />;
}
```

Note: The `.catch(() => setAccepted(true))` ensures the app still works if RPC fails (e.g., in dev/test scenarios).

**Step 2: Update entry point to mount AppGate**

In `src/views/main/index.ts`, change:

```ts
import { App } from "../../frontend/App.tsx";
```

To:

```ts
import { AppGate } from "../../frontend/App.tsx";
```

And change:

```ts
root.render(createElement(App));
```

To:

```ts
root.render(createElement(AppGate));
```

**Step 3: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 4: Run all tests**

Run: `bun test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/frontend/App.tsx src/views/main/index.ts
git commit -m "feat: add AppGate wrapper to block UI until risk acceptance"
```

---

### Task 6: Final verification

**Step 1: Run full check suite**

Run: `bun run check && bun run typecheck && bun test`
Expected: All PASS

**Step 2: Manual smoke test**

Run: `bun run dev`

Verify:
1. App opens showing the security warning page (not the main UI)
2. Warning shows the Klovi logo, heading, privacy text, and Continue button
3. Clicking Continue loads the normal app with sidebar and projects
4. Closing and reopening the app shows the warning again

**Step 3: Commit any remaining fixes, then squash or keep as-is**
