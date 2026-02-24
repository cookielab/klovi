# Native App Look & Feel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Klovi look like a native macOS desktop app with vibrancy effects, rounded corners, system fonts, and user message bubbles — while preserving turn border colors and role badges.

**Architecture:** CSS-first approach. Most changes are to custom properties in `App.css` `:root` and `[data-theme="dark"]` blocks, with sidebar vibrancy, message card refinements, and one small component change for user message bubble layout. Settings modal CSS also updated.

**Tech Stack:** Plain CSS custom properties, `backdrop-filter` for vibrancy, no new dependencies.

---

### Task 1: Update CSS custom properties — typography, radius, shadows

**Files:**
- Modify: `src/frontend/App.css:1-71` (`:root` block)
- Modify: `src/frontend/App.css:73-128` (`[data-theme="dark"]` block)
- Modify: `src/frontend/index.css:15-17` (body line-height)

**Step 1: Update `:root` custom properties in `src/frontend/App.css`**

Change lines 2, 5, 59-66:

```css
/* Line 2 */
--font-size-base: 14px;

/* Line 5 */
--font-body: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro", system-ui, sans-serif;

/* Lines 41-43: soften borders */
--border: #d0d4de;
--border-light: #e2e6ee;

/* Lines 59-61: refined light shadows */
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04), 0 1px 1px rgba(0, 0, 0, 0.02);
--shadow-md: 0 2px 6px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04);
--shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.04);

/* Lines 64-66: add radius */
--radius-sm: 4px;
--radius-md: 6px;
--radius-lg: 10px;
```

**Step 2: Update `[data-theme="dark"]` in `src/frontend/App.css`**

Change lines 108-109 and 125-127:

```css
/* Lines 108-109: soften dark borders */
--border: #1c2230;
--border-light: #252d3c;

/* Lines 125-127: refined dark shadows */
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.2);
--shadow-md: 0 2px 8px rgba(0, 0, 0, 0.3);
--shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.4);
```

**Step 3: Update body line-height in `src/frontend/index.css`**

Change line 17:

```css
line-height: 1.55;
```

**Step 4: Update markdown line-height in `src/frontend/App.css`**

Change line 838:

```css
line-height: 1.6;
```

**Step 5: Run verification**

```bash
bun run check && bun run typecheck && bun test
```

Expected: All pass. No logic changes, only CSS values.

**Step 6: Commit**

```bash
git add src/frontend/App.css src/frontend/index.css
git commit -m "style: update typography, radius, and shadow custom properties for native look"
```

---

### Task 2: Update sidebar styling with vibrancy

**Files:**
- Modify: `src/frontend/App.css:136-199` (sidebar styles)

**Step 1: Update `.sidebar` class (line 136-149)**

Replace the entire `.sidebar` block:

```css
.sidebar {
  width: var(--sidebar-width);
  background: rgba(215, 220, 230, 0.75);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-right: 1px solid rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  height: 100vh;
  position: fixed;
  left: 0;
  top: 0;
  overflow: hidden;
  transition: transform 0.2s ease;
  z-index: 10;
}
```

**Step 2: Add dark theme sidebar override**

After the existing `[data-theme="dark"]` block (after line 128), or at the end of the dark theme section, add:

```css
[data-theme="dark"] .sidebar {
  background: rgba(8, 10, 16, 0.85);
  border-right-color: rgba(255, 255, 255, 0.06);
}
```

**Step 3: Update `.sidebar-header` border (line 158)**

Change the border-bottom to be softer:

```css
border-bottom: 1px solid rgba(0, 0, 0, 0.06);
```

And add dark theme override:

```css
[data-theme="dark"] .sidebar-header {
  border-bottom-color: rgba(255, 255, 255, 0.06);
}
```

**Step 4: Update `.sidebar-footer` border (line 189)**

Change:

```css
border-top: 1px solid rgba(0, 0, 0, 0.06);
```

And add dark theme override:

```css
[data-theme="dark"] .sidebar-footer {
  border-top-color: rgba(255, 255, 255, 0.06);
}
```

**Step 5: Update sidebar hover/active states**

Find the sidebar list item styles that use `--bg-tertiary` for hover. Add overrides for the translucent sidebar:

```css
/* These may need to be added near sidebar session list item hover styles */
[data-theme="dark"] .sidebar .session-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

[data-theme="dark"] .sidebar .session-item.active {
  background: rgba(255, 255, 255, 0.08);
}
```

Note: Check exact class names for sidebar items — they may be `.session-item`, `.sidebar-item`, or similar. Grep for hover styles within sidebar context.

**Step 6: Run verification**

```bash
bun run check && bun run typecheck && bun test
```

**Step 7: Commit**

```bash
git add src/frontend/App.css
git commit -m "style: add vibrancy effect and darker contrast to sidebar"
```

---

### Task 3: Update message card and user bubble styling

**Files:**
- Modify: `src/frontend/App.css:461-468` (message-list)
- Modify: `src/frontend/App.css:558-582` (message cards)
- Modify: `src/frontend/App.css:31` (role-user-bg opacity)
- Modify: `src/frontend/App.css:97` (dark role-user-bg opacity)

**Step 1: Update message-list padding (line 462)**

```css
.message-list {
  padding: 24px;
  max-width: 900px;
  margin: 0 auto;
}
```

**Step 2: Update base `.message` card (lines 558-564)**

```css
.message {
  border-radius: var(--radius-md);
  padding: 14px 16px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-left: 3px solid transparent;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}
```

**Step 3: Add user message bubble styling (after line 568)**

```css
.message-user {
  border-left-color: var(--role-user);
  max-width: 80%;
  margin-left: auto;
  background: var(--role-user-bg);
  border-color: transparent;
  border-left-color: var(--role-user);
}
```

**Step 4: Update `--role-user-bg` opacity in both themes**

In `:root` (line 31):
```css
--role-user-bg: rgba(58, 122, 150, 0.15);
```

In `[data-theme="dark"]` (line 97):
```css
--role-user-bg: rgba(74, 144, 168, 0.15);
```

**Step 5: Update turn header for user bubble alignment**

The `.turn-header` is before the message card. For user turns, the header should also align right. Add:

```css
.turn:has(.message-user) .turn-header {
  justify-content: flex-end;
}
```

Note: `:has()` is supported in Chromium 105+ which Electrobun uses. If `:has()` causes issues, we may need a component-level class instead.

**Step 6: Run verification**

```bash
bun run check && bun run typecheck && bun test
```

**Step 7: Commit**

```bash
git add src/frontend/App.css
git commit -m "style: add user message bubble layout and refine message cards"
```

---

### Task 4: Update modals with vibrancy and rounded corners

**Files:**
- Modify: `src/frontend/components/settings/SettingsModal.css:1-20` (overlay and modal)
- Modify: `src/frontend/App.css` (search modal: lines 1509-1532)

**Step 1: Update settings modal overlay (SettingsModal.css line 4)**

```css
.settings-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}
```

**Step 2: Update settings modal container (SettingsModal.css line 11-20)**

```css
.settings-modal {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  width: 640px;
  max-width: 90vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
```

**Step 3: Add radius to settings tabs and plugin rows**

In `SettingsModal.css`, add border-radius to `.settings-tab` (line 66-74):

```css
.settings-tab {
  background: none;
  border: none;
  padding: 8px 12px;
  text-align: left;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 0.9rem;
  border-radius: var(--radius-sm);
}
```

Add border-radius to `.settings-plugin-row` (line 116-120):

```css
.settings-plugin-row {
  padding: 12px;
  border: 1px solid var(--border-light);
  background: var(--bg-primary);
  border-radius: var(--radius-sm);
}
```

Add border-radius to `.settings-general-row` (line 186-190):

```css
.settings-general-row {
  padding: 12px;
  border: 1px solid var(--border-light);
  background: var(--bg-primary);
  border-radius: var(--radius-sm);
}
```

Add border-radius to `.settings-path-input` (line 148-156):

```css
.settings-path-input {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 0.85rem;
}
```

**Step 4: Update search modal overlay in App.css (lines 1509-1532)**

```css
.search-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 15vh;
  z-index: 200;
}

.search-modal {
  width: 560px;
  max-height: 480px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
```

**Step 5: Run verification**

```bash
bun run check && bun run typecheck && bun test
```

**Step 6: Commit**

```bash
git add src/frontend/App.css src/frontend/components/settings/SettingsModal.css
git commit -m "style: add vibrancy and rounded corners to modals"
```

---

### Task 5: Update buttons, inputs, scrollbars, and remaining elements

**Files:**
- Modify: `src/frontend/App.css` (buttons: ~272-314, inputs, scrollbars)
- Modify: `src/frontend/index.css:52-68` (scrollbar)

**Step 1: Add border-radius to `.btn` (line 272-286)**

The `.btn` already uses `--radius-sm` if referenced, but check if `border-radius` is explicitly set. If it uses `var(--radius-sm)` it's already handled by Task 1. If it's hardcoded to `0px`, change to `var(--radius-sm)`.

Grep for `border-radius` in `.btn` and `.input` classes and ensure they use the CSS variables.

**Step 2: Update turn badges to have subtle rounding**

In `.turn-badge` (line 480-488), add:

```css
border-radius: var(--radius-sm);
```

**Step 3: Update scrollbar thumb radius (index.css line 63)**

```css
::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: var(--radius-sm);
}
```

**Step 4: Update tooltip radius**

In `[data-tooltip]:hover::after` (line 536-551), add:

```css
border-radius: var(--radius-sm);
```

**Step 5: Update code block wrappers**

Find the code block wrapper class and add `border-radius: var(--radius-md)` if not already using the variable.

**Step 6: Run verification**

```bash
bun run check && bun run typecheck && bun test
```

**Step 7: Commit**

```bash
git add src/frontend/App.css src/frontend/index.css
git commit -m "style: apply border radius to buttons, badges, scrollbars, and remaining elements"
```

---

### Task 6: Visual review and final adjustments

**Step 1: Start dev server**

```bash
bun run dev
```

**Step 2: Check both themes**

- Toggle between light and dark themes
- Verify sidebar vibrancy effect is visible
- Verify user messages appear as right-aligned bubbles
- Verify modal blur overlay works
- Verify all role border colors are preserved
- Verify execution tree is unchanged
- Check that no visual regressions exist

**Step 3: Fine-tune any values that look off**

Adjust CSS values as needed based on visual inspection.

**Step 4: Run final verification**

```bash
bun run check && bun run typecheck && bun test
```

**Step 5: Commit any adjustments**

```bash
git add -A
git commit -m "style: fine-tune native look visual adjustments"
```

---

## Files Changed Summary

| File | Changes |
|------|---------|
| `src/frontend/App.css` | Custom properties, sidebar, messages, modals, buttons, badges |
| `src/frontend/index.css` | Body line-height, scrollbar radius |
| `src/frontend/components/settings/SettingsModal.css` | Modal vibrancy, rounded corners |

**No component (.tsx) files need changes** — the user bubble is achieved purely via CSS using `:has()` selector and existing `.message-user` class.

**No test files need changes** — all class names are preserved.
