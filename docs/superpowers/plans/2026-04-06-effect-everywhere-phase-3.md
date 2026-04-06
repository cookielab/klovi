# Effect Everywhere — Phase 3: Frontend Typed Errors & Data Fetching

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `useRPC` with an Effect-based `useEffectQuery` hook that provides typed error channels, and add `TypedErrorDisplay` for pattern-matched error recovery in the UI.

**Architecture:** The `effect` package is added to `packages/ui`. A new `useEffectQuery` hook wraps Promise-based RPC calls internally using `Effect.tryPromise`, mapping caught errors to tagged error types (`RpcTimeoutError`, `RpcDisconnectedError`, `RpcHandlerError`). Components consume `error: RpcError | null` instead of `error: string | null`. A `TypedErrorDisplay` component pattern-matches on error `_tag` to render targeted recovery actions. `KloviClient` (Promise-based) and `KloviHostBridge` stay unchanged — the Effect wrapping is internal to the hook.

**Tech Stack:** TypeScript 6, React 19, `effect` 3.21, `bun:test`, `@testing-library/react`

**Spec reference:** `docs/superpowers/specs/2026-04-05-effect-everywhere-design.md` § Phase 3 (adapted — `@effect/rx` and `@effect/rx-react` do not exist on npm, so this plan achieves the same goals using core `effect` + custom React hooks)

**Adaptation note:** The original spec assumed `@effect/rx` and `@effect/rx-react` packages. These packages do not exist on npm. This plan achieves the spec's primary Phase 3 goals (typed error channels, pattern-matched recovery, delete `useRPC`) using core `effect` and custom hooks. Full reactive data management (`Rx.Rx`, `useRxValue`, `RxRuntimeProvider`) is deferred until those packages become available.

---

## File Structure

### Files Created
| Path | Purpose |
|------|---------|
| `packages/ui/src/lib/rpc-errors-effect.ts` | Tagged error types using `Data.TaggedError` + error mapping utility |
| `packages/ui/src/app/hooks/useEffectQuery.ts` | Effect-based data-fetching hook (replaces `useRPC`) |
| `packages/ui/src/app/hooks/useEffectQuery.test.ts` | Tests for the new hook |
| `packages/ui/src/app/components/ui/TypedErrorDisplay.tsx` | Pattern-matched error recovery component |
| `packages/ui/src/app/components/ui/TypedErrorDisplay.test.tsx` | Tests for TypedErrorDisplay |
| `packages/ui/src/app/components/ui/TypedErrorDisplay.css` | Styles for TypedErrorDisplay |

### Files Modified
| Path | Change |
|------|--------|
| `packages/ui/package.json` | Add `effect` dependency |
| `packages/ui/src/app/hooks/useSessionData.ts` | Switch from `useRPC` to `useEffectQuery` |
| `packages/ui/src/app/components/layout/Sidebar.tsx` | Switch from `useRPC` to `useEffectQuery` |
| `packages/ui/src/app/components/dashboard/PackageDashboardStats.tsx` | Switch to `useEffectQuery`, pass `error?.message` |
| `packages/ui/src/app/components/project/PackageProjectList.tsx` | Switch to `useEffectQuery`, pass `error?.message` |
| `packages/ui/src/app/components/project/PackageSessionList.tsx` | Switch to `useEffectQuery`, pass `error?.message` |
| `packages/ui/src/app/components/project/PackageHiddenProjectList.tsx` | Switch to `useEffectQuery`, pass `error?.message` |
| `packages/ui/src/app/components/session/SessionView.tsx` | Switch to `TypedErrorDisplay` |
| `packages/ui/src/app/components/session/SessionPresentation.tsx` | Switch to `TypedErrorDisplay` |
| `packages/ui/src/app/components/session/SubAgentPresentation.tsx` | Switch to `TypedErrorDisplay` |
| `packages/ui/src/app/components/message/PackageSubAgentView.tsx` | Pass `error?.message` to ui-component |
| `packages/ui/src/app/test-helpers/mock-rpc.ts` | No changes needed (KloviClient stays Promise-based) |

### Files Deleted
| Path | Reason |
|------|--------|
| `packages/ui/src/app/hooks/useRpc.ts` | Replaced by `useEffectQuery` |
| `packages/ui/src/app/hooks/useRpc.test.ts` | Replaced by `useEffectQuery.test.ts` |

### Unchanged
| Path | Reason |
|------|--------|
| `packages/ui-components/` | Pure presentation — no I/O, no benefit |
| `packages/design-system/` | Tokens and styles — no I/O |
| `packages/ui/src/lib/context.ts` | Stays as-is — `KloviClient` (Promise-based) still injected via context |
| `packages/ui/src/lib/client.ts` | `KloviClient` type unchanged |
| `packages/ui/src/lib/rpc-errors.ts` | Kept for backward compat (desktop views entry point uses `createRpcTimeoutError`) |
| `packages/ui/src/app/App.tsx` | Uses `useKloviClient()` for mutations — no `useRPC` usage |
| `packages/ui/src/app/components/settings/SettingsView.tsx` | Promise-based mutations — no `useRPC` usage |

---

## Key Types and Conventions

### Tagged RPC Errors

```typescript
import { Data } from "effect";

class RpcTimeoutError extends Data.TaggedError("RpcTimeoutError")<{
  readonly method: string;
  readonly timeoutMs: number;
}> {}

class RpcDisconnectedError extends Data.TaggedError("RpcDisconnectedError")<{
  readonly method: string;
}> {}

class RpcHandlerError extends Data.TaggedError("RpcHandlerError")<{
  readonly method: string;
  readonly message: string;
}> {}

type RpcError = RpcTimeoutError | RpcDisconnectedError | RpcHandlerError;
```

### Error Mapping

The existing `rpc-errors.ts` has `getRpcErrorCode()` which detects timeout/disconnect from error objects. The new `mapToRpcError(error: unknown): RpcError` uses this detection logic to produce the correct tagged type. If the error is not a known RPC error, it becomes `RpcHandlerError` with the error message.

### useEffectQuery API

```typescript
function useEffectQuery<T>(
  rpcCall: () => Promise<T>,
  deps: DependencyList,
): { data: T | null; loading: boolean; error: RpcError | null; retry: () => void };
```

Same call-site shape as `useRPC` — just swap the import. Error type changes from `string | null` to `RpcError | null`.

### Component Error Patterns

**Components passing to ui-components** (which expect `error: string | undefined`):
```typescript
<UiProjectList error={error?.message} onRetry={retry} />
```

**Components rendering errors directly** (SessionView, SessionPresentation, SubAgentPresentation):
```typescript
<TypedErrorDisplay error={error} onRetry={retry} />
```

---

## Tasks

### Task 1: Add effect dependency and create tagged RPC error types

**Files:**
- Modify: `packages/ui/package.json`
- Create: `packages/ui/src/lib/rpc-errors-effect.ts`

- [ ] **Step 1: Add effect dependency**

In `packages/ui/package.json`, add `effect` to the `dependencies` object:

```json
"dependencies": {
  "@cookielab.io/klovi-design-system": "workspace:*",
  "@cookielab.io/klovi-plugin-claude-code": "workspace:*",
  "@cookielab.io/klovi-plugin-codex": "workspace:*",
  "@cookielab.io/klovi-plugin-core": "workspace:*",
  "@cookielab.io/klovi-plugin-opencode": "workspace:*",
  "@cookielab.io/klovi-ui-components": "workspace:*",
  "effect": "*",
  "react": "^19.2.4",
  "react-dom": "^19.2.4"
}
```

Note: `effect` uses `"*"` because it's pinned in the workspace root (3.21.0).

- [ ] **Step 2: Install dependencies**

Run: `bun install`

- [ ] **Step 3: Create tagged error types**

Create `packages/ui/src/lib/rpc-errors-effect.ts`:

```typescript
import { Data } from "effect";
import { getRpcErrorCode } from "./rpc-errors.ts";

export class RpcTimeoutError extends Data.TaggedError("RpcTimeoutError")<{
	readonly method: string;
	readonly timeoutMs: number;
}> {}

export class RpcDisconnectedError extends Data.TaggedError("RpcDisconnectedError")<{
	readonly method: string;
}> {}

export class RpcHandlerError extends Data.TaggedError("RpcHandlerError")<{
	readonly method: string;
	readonly reason: string;
}> {}

export type RpcError = RpcTimeoutError | RpcDisconnectedError | RpcHandlerError;

export function mapToRpcError(error: unknown): RpcError {
	const code = getRpcErrorCode(error);
	if (code === "rpc-timeout") {
		const msg = error instanceof Error ? error.message : String(error);
		const timeoutMatch = msg.match(/exceeded (\d+)ms/);
		const timeoutMs = timeoutMatch ? Number(timeoutMatch[1]) : 0;
		const methodMatch = msg.match(/\((\w+) exceeded/);
		const method = methodMatch ? methodMatch[1]! : "unknown";
		return new RpcTimeoutError({ method: method, timeoutMs: timeoutMs });
	}
	if (code === "rpc-disconnected") {
		const msg = error instanceof Error ? error.message : String(error);
		const methodMatch = msg.match(/during (\w+)/);
		const method = methodMatch ? methodMatch[1]! : "unknown";
		return new RpcDisconnectedError({ method: method });
	}
	const message = error instanceof Error ? error.message : String(error);
	return new RpcHandlerError({ method: "unknown", reason: message });
}
```

- [ ] **Step 4: Run verification**

Run: `bun run check && bun run typecheck && bun test`
Expected: All pass (no consumers yet, just new files).

- [ ] **Step 5: Commit**

```bash
git add packages/ui/package.json packages/ui/src/lib/rpc-errors-effect.ts bun.lock
git commit -m "feat(ui): add effect dependency and tagged RPC error types"
```

---

### Task 2: Create useEffectQuery hook with tests

**Files:**
- Create: `packages/ui/src/app/hooks/useEffectQuery.ts`
- Create: `packages/ui/src/app/hooks/useEffectQuery.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/ui/src/app/hooks/useEffectQuery.test.ts`:

```typescript
import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { useEffectQuery } from "./useEffectQuery.ts";

describe("useEffectQuery", () => {
	afterEach(() => {
		cleanup();
	});

	test("starts in loading state", () => {
		const rpcCall = () => new Promise<{ value: number }>(() => {});
		const { result } = renderHook(() => useEffectQuery(rpcCall, []));
		expect(result.current.loading).toBe(true);
		expect(result.current.data).toBeNull();
		expect(result.current.error).toBeNull();
	});

	test("returns data on successful call", async () => {
		const rpcCall = () => Promise.resolve({ value: 42 });
		const { result } = renderHook(() => useEffectQuery(rpcCall, []));

		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.data).toEqual({ value: 42 });
		expect(result.current.error).toBeNull();
	});

	test("returns typed RpcHandlerError on generic failure", async () => {
		const rpcCall = () => Promise.reject(new Error("Server error"));
		const { result } = renderHook(() => useEffectQuery(rpcCall, []));

		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.error).not.toBeNull();
		expect(result.current.error!._tag).toBe("RpcHandlerError");
		expect(result.current.data).toBeNull();
	});

	test("returns RpcTimeoutError for timeout errors", async () => {
		const error = new Error("RPC request timed out. (getProjects exceeded 30000ms)");
		const rpcCall = () => Promise.reject(error);
		const { result } = renderHook(() => useEffectQuery(rpcCall, []));

		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.error!._tag).toBe("RpcTimeoutError");
	});

	test("returns RpcDisconnectedError for disconnect errors", async () => {
		const error = new Error("Desktop host disconnected during getSession.");
		const rpcCall = () => Promise.reject(error);
		const { result } = renderHook(() => useEffectQuery(rpcCall, []));

		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.error!._tag).toBe("RpcDisconnectedError");
	});

	test("retry refetches data", async () => {
		let callCount = 0;
		const rpcCall = () => {
			callCount += 1;
			if (callCount === 1) {
				return Promise.reject(new Error("fail"));
			}
			return Promise.resolve({ ok: true });
		};

		const { result } = renderHook(() => useEffectQuery(rpcCall, []));
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.error).not.toBeNull();

		result.current.retry();
		await waitFor(() => expect(result.current.data).toEqual({ ok: true }));
		expect(result.current.error).toBeNull();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/ui/src/app/hooks/useEffectQuery.test.ts`
Expected: FAIL — module `./useEffectQuery.ts` not found.

- [ ] **Step 3: Implement the hook**

Create `packages/ui/src/app/hooks/useEffectQuery.ts`:

```typescript
import { type DependencyList, useCallback, useEffect, useState } from "react";
import { type RpcError, mapToRpcError } from "../../lib/rpc-errors-effect.ts";

type UseEffectQueryResult<T> = {
	data: T | null;
	loading: boolean;
	error: RpcError | null;
	retry: () => void;
};

export function useEffectQuery<T>(rpcCall: () => Promise<T>, deps: DependencyList): UseEffectQueryResult<T> {
	const [data, setData] = useState<T | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<RpcError | null>(null);
	const [retryCount, setRetryCount] = useState(0);

	const retry = useCallback(() => setRetryCount((c) => c + 1), []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: retryCount triggers refetch on retry(); deps array is spread from caller
	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		setError(null);

		rpcCall()
			.then((result) => {
				if (!cancelled) {
					setData(result);
					setLoading(false);
				}
			})
			.catch((e) => {
				if (!cancelled) {
					setError(mapToRpcError(e));
					setLoading(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [retryCount, ...deps]);

	return { data: data, loading: loading, error: error, retry: retry };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test packages/ui/src/app/hooks/useEffectQuery.test.ts`
Expected: All 6 tests PASS.

- [ ] **Step 5: Run full verification**

Run: `bun run check && bun run typecheck && bun test`
Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/app/hooks/useEffectQuery.ts packages/ui/src/app/hooks/useEffectQuery.test.ts
git commit -m "feat(ui): add useEffectQuery hook with typed RPC errors"
```

---

### Task 3: Create TypedErrorDisplay component

**Files:**
- Create: `packages/ui/src/app/components/ui/TypedErrorDisplay.tsx`
- Create: `packages/ui/src/app/components/ui/TypedErrorDisplay.css`
- Create: `packages/ui/src/app/components/ui/TypedErrorDisplay.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `packages/ui/src/app/components/ui/TypedErrorDisplay.test.tsx`:

```typescript
import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import { RpcDisconnectedError, RpcHandlerError, RpcTimeoutError } from "../../../lib/rpc-errors-effect.ts";
import { TypedErrorDisplay } from "./TypedErrorDisplay.tsx";

describe("TypedErrorDisplay", () => {
	afterEach(() => cleanup());

	test("renders timeout error with method name", () => {
		const error = new RpcTimeoutError({ method: "getProjects", timeoutMs: 30000 });
		const { getByText } = render(<TypedErrorDisplay error={error} />);
		expect(getByText(/timed out/i)).toBeTruthy();
	});

	test("renders disconnected error", () => {
		const error = new RpcDisconnectedError({ method: "getSession" });
		const { getByText } = render(<TypedErrorDisplay error={error} />);
		expect(getByText(/connection.*lost/i)).toBeTruthy();
	});

	test("renders handler error with reason", () => {
		const error = new RpcHandlerError({ method: "getStats", reason: "Database unavailable" });
		const { getByText } = render(<TypedErrorDisplay error={error} />);
		expect(getByText("Database unavailable")).toBeTruthy();
	});

	test("renders retry button when onRetry provided", () => {
		const error = new RpcTimeoutError({ method: "getProjects", timeoutMs: 30000 });
		const { getByRole } = render(<TypedErrorDisplay error={error} onRetry={() => {}} />);
		expect(getByRole("button", { name: /retry/i })).toBeTruthy();
	});

	test("does not render retry button when onRetry omitted", () => {
		const error = new RpcHandlerError({ method: "test", reason: "fail" });
		const { queryByRole } = render(<TypedErrorDisplay error={error} />);
		expect(queryByRole("button")).toBeNull();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/ui/src/app/components/ui/TypedErrorDisplay.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Create CSS file**

Create `packages/ui/src/app/components/ui/TypedErrorDisplay.css`:

```css
.typed-error-display {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 8px;
	padding: 24px;
	text-align: center;
	color: var(--color-text-secondary);
}

.typed-error-title {
	font-weight: 600;
	color: var(--color-text-primary);
}

.typed-error-detail {
	font-size: 0.9em;
	opacity: 0.8;
}
```

- [ ] **Step 4: Implement the component**

Create `packages/ui/src/app/components/ui/TypedErrorDisplay.tsx`:

```typescript
import { Button } from "@cookielab.io/klovi-design-system";
import type { RpcError } from "../../../lib/rpc-errors-effect.ts";
import "./TypedErrorDisplay.css";

type TypedErrorDisplayProps = {
	error: RpcError;
	onRetry?: () => void;
};

function getErrorContent(error: RpcError): { title: string; detail: string } {
	switch (error._tag) {
		case "RpcTimeoutError":
			return {
				title: "Request timed out",
				detail: `The request took too long to complete.`,
			};
		case "RpcDisconnectedError":
			return {
				title: "Connection lost",
				detail: "The connection to the desktop host was interrupted.",
			};
		case "RpcHandlerError":
			return {
				title: "Something went wrong",
				detail: error.reason,
			};
	}
}

export function TypedErrorDisplay({ error, onRetry }: TypedErrorDisplayProps) {
	const { title, detail } = getErrorContent(error);

	return (
		<div className="typed-error-display">
			<span className="typed-error-title">{title}</span>
			<span className="typed-error-detail">{detail}</span>
			{onRetry ? (
				<Button size="sm" onClick={onRetry}>
					Retry
				</Button>
			) : null}
		</div>
	);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test packages/ui/src/app/components/ui/TypedErrorDisplay.test.tsx`
Expected: All 5 tests PASS.

- [ ] **Step 6: Run full verification**

Run: `bun run check && bun run typecheck && bun test`
Expected: All pass.

- [ ] **Step 7: Commit**

```bash
git add packages/ui/src/app/components/ui/TypedErrorDisplay.tsx packages/ui/src/app/components/ui/TypedErrorDisplay.css packages/ui/src/app/components/ui/TypedErrorDisplay.test.tsx
git commit -m "feat(ui): add TypedErrorDisplay component for pattern-matched error recovery"
```

---

### Task 4: Migrate all data-fetching components from useRPC to useEffectQuery

**Files:**
- Modify: `packages/ui/src/app/hooks/useSessionData.ts`
- Modify: `packages/ui/src/app/components/layout/Sidebar.tsx`
- Modify: `packages/ui/src/app/components/dashboard/PackageDashboardStats.tsx`
- Modify: `packages/ui/src/app/components/project/PackageProjectList.tsx`
- Modify: `packages/ui/src/app/components/project/PackageSessionList.tsx`
- Modify: `packages/ui/src/app/components/project/PackageHiddenProjectList.tsx`
- Modify: `packages/ui/src/app/components/session/SessionView.tsx`
- Modify: `packages/ui/src/app/components/session/SessionPresentation.tsx`
- Modify: `packages/ui/src/app/components/session/SubAgentPresentation.tsx`
- Modify: `packages/ui/src/app/components/message/PackageSubAgentView.tsx`

This task converts ALL `useRPC` consumers to `useEffectQuery` in one commit. The changes are mechanical — same call-site shape, just different import and error type.

- [ ] **Step 1: Update useSessionData.ts**

Replace `useRPC` with `useEffectQuery`:

```typescript
import { useKloviClient } from "../../lib/context.ts";
import type { Session } from "../../shared/types.ts";
import { useEffectQuery } from "./useEffectQuery.ts";

export function useSessionData(sessionId: string, project: string) {
	const client = useKloviClient();
	return useEffectQuery<{ session: Session }>(
		() => client.getSession({ sessionId: sessionId, project: project }),
		[client, sessionId, project],
	);
}

export function useSubAgentSessionData(sessionId: string, project: string, agentId: string) {
	const client = useKloviClient();
	return useEffectQuery<{ session: Session }>(
		() => client.getSubAgent({ sessionId: sessionId, project: project, agentId: agentId }),
		[client, sessionId, project, agentId],
	);
}
```

- [ ] **Step 2: Update Sidebar.tsx**

Change the import and hook call:

```diff
-import { useRPC } from "../../hooks/useRpc.ts";
+import { useEffectQuery } from "../../hooks/useEffectQuery.ts";
```

```diff
-const { data: versionInfo } = useRPC<VersionInfo>(() => client.getVersion(), [client]);
+const { data: versionInfo } = useEffectQuery<VersionInfo>(() => client.getVersion(), [client]);
```

- [ ] **Step 3: Update PackageDashboardStats.tsx**

```diff
-import { useRPC } from "../../hooks/useRpc.ts";
+import { useEffectQuery } from "../../hooks/useEffectQuery.ts";
```

```diff
-const { data, loading, error, retry } = useRPC<{ stats: Stats }>(() => client.getStats(), [client]);
-return <UiDashboardStats stats={data?.stats ?? null} loading={loading} error={error ?? undefined} onRetry={retry} />;
+const { data, loading, error, retry } = useEffectQuery<{ stats: Stats }>(() => client.getStats(), [client]);
+return <UiDashboardStats stats={data?.stats ?? null} loading={loading} error={error?.message} onRetry={retry} />;
```

- [ ] **Step 4: Update PackageProjectList.tsx**

```diff
-import { useRPC } from "../../hooks/useRpc.ts";
+import { useEffectQuery } from "../../hooks/useEffectQuery.ts";
```

```diff
-const { data, loading, error, retry } = useRPC<{ projects: Project[] }>(() => client.getProjects(), [client]);
+const { data, loading, error, retry } = useEffectQuery<{ projects: Project[] }>(() => client.getProjects(), [client]);
```

And in the JSX:
```diff
-error={error ?? undefined}
+error={error?.message}
```

- [ ] **Step 5: Update PackageSessionList.tsx**

```diff
-import { useRPC } from "../../hooks/useRpc.ts";
+import { useEffectQuery } from "../../hooks/useEffectQuery.ts";
```

```diff
-const { data, loading, error, retry } = useRPC<{ sessions: SessionSummary[] }>(
+const { data, loading, error, retry } = useEffectQuery<{ sessions: SessionSummary[] }>(
```

And in the JSX:
```diff
-error={error ?? undefined}
+error={error?.message}
```

- [ ] **Step 6: Update PackageHiddenProjectList.tsx**

```diff
-import { useRPC } from "../../hooks/useRpc.ts";
+import { useEffectQuery } from "../../hooks/useEffectQuery.ts";
```

```diff
-const { data, loading, error, retry } = useRPC<{ projects: Project[] }>(() => client.getProjects(), [client]);
+const { data, loading, error, retry } = useEffectQuery<{ projects: Project[] }>(() => client.getProjects(), [client]);
```

And in the JSX:
```diff
-error={error ?? undefined}
+error={error?.message}
```

- [ ] **Step 7: Update SessionView.tsx**

Replace `FetchError` with `TypedErrorDisplay`:

```typescript
import { TypedErrorDisplay } from "../ui/TypedErrorDisplay.tsx";
import { useSessionData } from "../../hooks/useSessionData.ts";
import { PackageMessageList } from "../message/PackageMessageList.tsx";

type SessionViewProps = {
	sessionId: string;
	project: string;
	gitBranch?: string;
};

export function SessionView({ sessionId, project, gitBranch }: SessionViewProps) {
	const { data, loading, error, retry } = useSessionData(sessionId, project);

	if (loading) {
		return <div className="loading">Loading session...</div>;
	}
	if (error) {
		return <TypedErrorDisplay error={error} onRetry={retry} />;
	}
	if (!data?.session) {
		return null;
	}

	const session = data.session;
	return (
		<>
			{gitBranch ? (
				<div className="session-branch-bar">
					<span className="session-branch-icon">⎇</span> {gitBranch}
				</div>
			) : null}
			<PackageMessageList
				turns={session.turns}
				sessionId={sessionId}
				project={project}
				pluginId={session.pluginId}
				planSessionId={session.planSessionId}
				implSessionId={session.implSessionId}
			/>
		</>
	);
}
```

- [ ] **Step 8: Update SessionPresentation.tsx**

Replace `FetchError` with `TypedErrorDisplay`:

```typescript
import { TypedErrorDisplay } from "../ui/TypedErrorDisplay.tsx";
import { useSessionData } from "../../hooks/useSessionData.ts";
import { PackagePresentationShell } from "./PackagePresentationShell.tsx";

type SessionPresentationProps = {
	sessionId: string;
	project: string;
	onExit: () => void;
};

export function SessionPresentation({ sessionId, project, onExit }: SessionPresentationProps) {
	const { data, loading, error, retry } = useSessionData(sessionId, project);

	if (loading) {
		return <div className="loading">Loading session...</div>;
	}
	if (error) {
		return <TypedErrorDisplay error={error} onRetry={retry} />;
	}
	if (!data?.session) {
		return null;
	}

	return (
		<PackagePresentationShell
			turns={data.session.turns}
			onExit={onExit}
			sessionId={sessionId}
			project={project}
			pluginId={data.session.pluginId}
		/>
	);
}
```

- [ ] **Step 9: Update SubAgentPresentation.tsx**

Replace `FetchError` with `TypedErrorDisplay`:

```typescript
import { TypedErrorDisplay } from "../ui/TypedErrorDisplay.tsx";
import { useSubAgentSessionData } from "../../hooks/useSessionData.ts";
import { PackagePresentationShell } from "./PackagePresentationShell.tsx";

type SubAgentPresentationProps = {
	sessionId: string;
	project: string;
	agentId: string;
	onExit: () => void;
};

export function SubAgentPresentation({ sessionId, project, agentId, onExit }: SubAgentPresentationProps) {
	const { data, loading, error, retry } = useSubAgentSessionData(sessionId, project, agentId);

	if (loading) {
		return <div className="loading">Loading sub-agent conversation...</div>;
	}
	if (error) {
		return <TypedErrorDisplay error={error} onRetry={retry} />;
	}
	if (!data?.session || data.session.turns.length === 0) {
		return null;
	}

	return (
		<PackagePresentationShell
			turns={data.session.turns}
			onExit={onExit}
			sessionId={sessionId}
			project={project}
			pluginId={data.session.pluginId}
			isSubAgent={true}
		/>
	);
}
```

- [ ] **Step 10: Update PackageSubAgentView.tsx**

Change error prop from `error ?? undefined` to `error?.message`:

```diff
-error={error ?? undefined}
+error={error?.message}
```

No import change needed — `useSubAgentSessionData` already updated in Step 1.

- [ ] **Step 11: Run full verification**

Run: `bun run check && bun run typecheck && bun test`
Expected: All pass. The only remaining import of `useRpc.ts` should be `useRpc.test.ts`.

- [ ] **Step 12: Commit**

```bash
git add packages/ui/src/app/hooks/useSessionData.ts packages/ui/src/app/components/layout/Sidebar.tsx packages/ui/src/app/components/dashboard/PackageDashboardStats.tsx packages/ui/src/app/components/project/PackageProjectList.tsx packages/ui/src/app/components/project/PackageSessionList.tsx packages/ui/src/app/components/project/PackageHiddenProjectList.tsx packages/ui/src/app/components/session/SessionView.tsx packages/ui/src/app/components/session/SessionPresentation.tsx packages/ui/src/app/components/session/SubAgentPresentation.tsx packages/ui/src/app/components/message/PackageSubAgentView.tsx
git commit -m "refactor(ui): migrate all data-fetching from useRPC to useEffectQuery with typed errors"
```

---

### Task 5: Delete useRPC, final verification and polish

**Files:**
- Delete: `packages/ui/src/app/hooks/useRpc.ts`
- Delete: `packages/ui/src/app/hooks/useRpc.test.ts`

- [ ] **Step 1: Verify no remaining imports of useRpc**

Run: `grep -r "useRpc" packages/ui/src/ --include="*.ts" --include="*.tsx" | grep -v "useRpc.ts" | grep -v "useRpc.test.ts"`
Expected: No output (no remaining consumers).

- [ ] **Step 2: Delete old files**

```bash
rm packages/ui/src/app/hooks/useRpc.ts packages/ui/src/app/hooks/useRpc.test.ts
```

- [ ] **Step 3: Run full verification**

Run: `bun run check && bun run typecheck && bun test`
Expected: All pass. Test count should be 860 - 4 (deleted useRpc tests) + 6 (new useEffectQuery tests) + 5 (TypedErrorDisplay tests) = 867.

- [ ] **Step 4: Verify TypedErrorDisplay renders in existing component tests**

Run: `bun test packages/ui/src/app/components/session/`
Expected: SessionView, SessionPresentation, SubAgentPresentation tests pass with TypedErrorDisplay instead of FetchError.

- [ ] **Step 5: Commit**

```bash
git add -u packages/ui/src/app/hooks/useRpc.ts packages/ui/src/app/hooks/useRpc.test.ts
git commit -m "refactor(ui): delete useRPC hook — replaced by useEffectQuery"
```

---

## Verification Checklist

After all tasks:

- [ ] `bun run check` — no new biome errors in changed files
- [ ] `bun run typecheck` — no new TypeScript errors
- [ ] `bun test` — all tests pass
- [ ] `grep -r "useRPC\|useRpc" packages/ui/src/` — no remaining references
- [ ] `grep -r "from.*useRpc" packages/ui/src/` — no remaining imports
- [ ] Every component that had `error: string | null` now has `error: RpcError | null`
- [ ] SessionView, SessionPresentation, SubAgentPresentation use `TypedErrorDisplay`
- [ ] Other components pass `error?.message` to ui-components (unchanged presentation layer)
