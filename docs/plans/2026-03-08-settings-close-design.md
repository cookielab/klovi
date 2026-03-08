# Settings Close Button Design

## Problem

When the user opens settings, there is no visible UI affordance to close it. The only ways to exit are keyboard shortcuts (Escape, Cmd+,) which are not discoverable.

## Decision

- Store the previous ViewState before navigating to settings
- Provide close/back buttons in both the sidebar and main header
- Make the settings gear icon act as a toggle
- Always return to the previous view (not home)

## Approach: Store Previous ViewState

When `goSettings()` is called, save the current view in a ref (unless already in settings). A `closeSettings()` function restores the saved view, defaulting to home if none exists. `goSettings` becomes a toggle: if already in settings, it calls `closeSettings()`.

## UI Changes

### Sidebar (SettingsSidebar)
- Add `onBack` prop
- Render a back arrow button above the General/Plugins tabs

### Header (App.tsx)
- When in settings view, pass `onBack={closeSettings}` to the Header component

### Settings gear icon (Sidebar)
- No changes needed — `onSettingsClick` already calls `goSettings()`, which now toggles

### Escape key & Cmd+, (App.tsx, SettingsView.tsx)
- Both use `closeSettings()` uniformly
- Remove the changed/not-changed split in SettingsView's Escape handler

## Files Changed

| File | Change |
|------|--------|
| `useViewState.ts` | Add `previousView` ref, `closeSettings()`, make `goSettings` toggle |
| `App.tsx` | Pass `closeSettings`; update Cmd+, handler; pass `onBack` to Header in settings |
| `SettingsSidebar.tsx` | Add `onBack` prop, render back arrow button |
| `SettingsView.tsx` | Escape handler uses `onNavigateHome` uniformly (remove changed/not-changed split) |
| `sidebar-content.tsx` | Pass `closeSettings` through to SettingsSidebar |
