# Settings Close Button Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add visible UI affordances to close settings (back buttons in sidebar and header, gear toggle, consistent Escape behavior) that always return to the previous view.

**Architecture:** Store previous ViewState in a ref before navigating to settings. All close paths (sidebar back button, header back button, gear toggle, Escape, Cmd+,) call a single `closeSettings()` that restores the saved view.

**Tech Stack:** React 19, TypeScript strict mode, plain CSS, bun:test + @testing-library/react

---

### Task 1: Add `closeSettings` and `previousView` to useViewState

**Files:**
- Modify: `packages/ui/src/app/hooks/useViewState.ts`

**Step 1: Add previousView ref and closeSettings**

In `useViewState.ts`, add a `useRef` for `previousView` and a `closeSettings` callback. Modify `goSettings` to save the current view before navigating, and to toggle if already in settings.

```ts
// Add to imports:
import { useCallback, useEffect, useRef, useState } from "react";

// Add to interface UseViewStateResult:
closeSettings: () => void;

// Inside useViewState(), add:
const previousView = useRef<ViewState>({ kind: "home" });

// Replace existing goSettings:
const goSettings = useCallback(() => {
  setView((current) => {
    if (current.kind === "settings") {
      return previousView.current;
    }
    previousView.current = current;
    return { kind: "settings" };
  });
}, []);

const closeSettings = useCallback(() => {
  setView(previousView.current);
}, []);

// Add closeSettings to return object
```

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: May fail because `closeSettings` is not used yet in App.tsx — that's OK.

**Step 3: Commit**

```bash
git add packages/ui/src/app/hooks/useViewState.ts
git commit -m "feat: add closeSettings and previous view tracking to useViewState"
```

---

### Task 2: Add back button to SettingsSidebar

**Files:**
- Modify: `packages/ui/src/app/components/settings/SettingsSidebar.tsx`
- Modify: `packages/ui/src/app/components/settings/SettingsView.css`
- Modify: `packages/ui/src/app/components/settings/SettingsView.test.tsx`

**Step 1: Write the failing test**

Add to the `SettingsSidebar` describe block in `SettingsView.test.tsx`:

```tsx
test("renders back button when onBack provided", () => {
  const onBack = mock();
  const { getByRole } = render(
    <SettingsSidebar activeTab="general" onTabChange={() => {}} onBack={onBack} />,
    { wrapper: MockProviders },
  );
  expect(getByRole("button", { name: "Back" })).toBeDefined();
});

test("calls onBack when back button clicked", () => {
  const onBack = mock();
  const { getByRole } = render(
    <SettingsSidebar activeTab="general" onTabChange={() => {}} onBack={onBack} />,
    { wrapper: MockProviders },
  );
  fireEvent.click(getByRole("button", { name: "Back" }));
  expect(onBack).toHaveBeenCalledTimes(1);
});
```

**Step 2: Run test to verify it fails**

Run: `bun test packages/ui/src/app/components/settings/SettingsView.test.tsx`
Expected: FAIL — `onBack` prop doesn't exist yet.

**Step 3: Implement back button in SettingsSidebar**

In `SettingsSidebar.tsx`, add `onBack` prop and render a back arrow button above the tabs:

```tsx
interface SettingsSidebarProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
  onBack?: (() => void) | undefined;
}

export function SettingsSidebar({ activeTab, onTabChange, onBack }: SettingsSidebarProps) {
  return (
    <nav className="settings-nav">
      {onBack && (
        <button type="button" className="settings-nav-back" onClick={onBack}>
          &larr; Back
        </button>
      )}
      <button
        type="button"
        className={`settings-nav-item ${activeTab === "general" ? "active" : ""}`}
        onClick={() => onTabChange("general")}
      >
        General
      </button>
      <button
        type="button"
        className={`settings-nav-item ${activeTab === "plugins" ? "active" : ""}`}
        onClick={() => onTabChange("plugins")}
      >
        Plugins
      </button>
    </nav>
  );
}
```

**Step 4: Add CSS for the back button**

Add to `SettingsView.css`:

```css
.settings-nav-back {
  background: none;
  border: none;
  padding: 8px 12px;
  text-align: left;
  cursor: pointer;
  color: var(--text-muted);
  font-size: 0.85rem;
  margin-bottom: 4px;
}

.settings-nav-back:hover {
  color: var(--text-primary);
}
```

**Step 5: Run tests**

Run: `bun test packages/ui/src/app/components/settings/SettingsView.test.tsx`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/ui/src/app/components/settings/SettingsSidebar.tsx packages/ui/src/app/components/settings/SettingsView.css packages/ui/src/app/components/settings/SettingsView.test.tsx
git commit -m "feat: add back button to SettingsSidebar"
```

---

### Task 3: Add onBack prop to Header component

**Files:**
- Modify: `packages/ui/src/app/components/layout/Header.tsx`

**Step 1: Add onBack prop to Header**

The Header already has `backHref` for hash-based links. Add an `onBack` callback prop that renders a back button (same arrow style) when provided. `onBack` takes priority over `backHref` since they serve the same purpose in different ways.

```tsx
interface HeaderProps {
  title: string;
  breadcrumb?: string | undefined;
  copyCommand?: string | undefined;
  backHref?: string | undefined;
  onBack?: (() => void) | undefined;
  sessionType?: "plan" | "implementation" | undefined;
  presentationActive: boolean;
  onTogglePresentation: () => void;
  showPresentationToggle: boolean;
}
```

In the JSX, add before the existing `backHref` block:

```tsx
{onBack && (
  <button type="button" className="back-btn" onClick={onBack}>
    &larr; Back
  </button>
)}
{!onBack && backHref && (
  <a className="back-btn" href={backHref}>
    &larr; Back to session
  </a>
)}
```

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/ui/src/app/components/layout/Header.tsx
git commit -m "feat: add onBack callback prop to Header"
```

---

### Task 4: Wire everything together in App.tsx and sidebar-content.tsx

**Files:**
- Modify: `packages/ui/src/app/App.tsx`
- Modify: `packages/ui/src/app/sidebar-content.tsx`

**Step 1: Update sidebar-content.tsx to pass closeSettings to SettingsSidebar**

Add `closeSettings` to `SidebarActions` interface and pass it as `onBack`:

```tsx
interface SidebarActions {
  selectProject: (p: Project) => void;
  selectSession: (s: SessionSummary) => void;
  goHome: () => void;
  goHidden: () => void;
  hide: (id: string) => void;
  settingsTab: SettingsTab;
  setSettingsTab: (tab: SettingsTab) => void;
  closeSettings: () => void;
}
```

In the settings branch:

```tsx
if (view.kind === "settings") {
  return (
    <SettingsSidebar
      activeTab={actions.settingsTab}
      onTabChange={actions.setSettingsTab}
      onBack={actions.closeSettings}
    />
  );
}
```

**Step 2: Update App.tsx to use closeSettings**

Destructure `closeSettings` from `useViewState()`.

Pass `closeSettings` to `getSidebarContent`:

```tsx
const sidebarContent = getSidebarContent(view, hiddenIds, {
  selectProject,
  selectSession,
  goHome,
  goHidden,
  hide,
  settingsTab,
  setSettingsTab,
  closeSettings,
});
```

Pass `onBack` to `Header` when in settings view:

```tsx
<Header
  title={headerTitle}
  breadcrumb={breadcrumb}
  // ... existing props ...
  onBack={view.kind === "settings" ? closeSettings : undefined}
  backHref={
    view.kind === "subagent" ? `#/${view.project.encodedPath}/${view.sessionId}` : undefined
  }
  // ... rest of props ...
/>
```

Replace `onNavigateHome={goHome}` with `onNavigateHome={closeSettings}` on SettingsView:

```tsx
{view.kind === "settings" && (
  <SettingsView
    activeTab={settingsTab}
    onNavigateHome={closeSettings}
    theme={themeHook}
    fontSize={fontSizeHook}
    presentationTheme={presentationThemeHook}
    presentationFontSize={presentationFontSizeHook}
  />
)}
```

Update the `Cmd+,` handler to use `closeSettings`:

```tsx
useEffect(() => {
  function handleCmdComma(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === ",") {
      e.preventDefault();
      if (view.kind === "settings") {
        closeSettings();
      } else {
        goSettings();
      }
    }
  }
  window.addEventListener("keydown", handleCmdComma);
  return () => window.removeEventListener("keydown", handleCmdComma);
}, [view.kind, goSettings, closeSettings]);
```

**Step 3: Run typecheck and tests**

Run: `bun run typecheck && bun test`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/ui/src/app/App.tsx packages/ui/src/app/sidebar-content.tsx
git commit -m "feat: wire closeSettings through App, sidebar, and header"
```

---

### Task 5: Simplify SettingsView Escape handler

**Files:**
- Modify: `packages/ui/src/app/components/settings/SettingsView.tsx`

**Step 1: Remove the changed/not-changed split in the Escape handler**

Replace the existing Escape effect (lines 309-322) with:

```tsx
useEffect(() => {
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onNavigateHome();
    }
  }
  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, [onNavigateHome]);
```

This now always calls `onNavigateHome` (which is `closeSettings`), regardless of whether settings were changed.

Also remove the `changed` state from the dependency — but keep the `changed` state itself since it's used by the reset-to-defaults flow and update settings.

**Step 2: Run all checks**

Run: `bun run check && bun run typecheck && bun test`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/ui/src/app/components/settings/SettingsView.tsx
git commit -m "feat: simplify settings Escape handler to always use closeSettings"
```

---

### Task 6: Final verification

**Step 1: Run full check suite**

Run: `bun run check && bun run typecheck && bun test`
Expected: All PASS

**Step 2: Manual smoke test**

Run: `bun run dev`

Test these scenarios:
1. From home, open settings via gear icon → back button in sidebar returns to home
2. From a session, open settings via Cmd+, → Escape returns to that session
3. Click gear again while in settings → returns to previous view
4. Header shows back button in settings view → clicking it returns to previous view
5. Open settings, change a setting, press Escape → returns to previous view (not home)
