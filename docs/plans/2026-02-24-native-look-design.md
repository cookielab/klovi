# Native App Look & Feel Redesign

## Goal

Make Klovi look more like a native macOS desktop app while preserving its identity (turn border colors, role badges, execution tree). Inspired by Codex app's dark, spacious, vibrancy-enabled UI.

## Approach: Targeted Native Polish + Vibrancy Effects

CSS-focused changes to custom properties, sidebar, messages, and typography, plus `backdrop-filter` vibrancy on sidebar and modals.

---

## 1. Color System & Sidebar

### Sidebar (Vibrancy)

The sidebar gets a distinctly darker background than the content area in both themes, plus a semi-transparent vibrancy effect.

**Dark theme:**
- Background: `rgba(8, 10, 16, 0.85)` with `backdrop-filter: blur(20px)`
- Hover items: `rgba(255, 255, 255, 0.06)`
- Active item: `rgba(255, 255, 255, 0.08)` + existing left accent border
- Right border: `1px solid rgba(255, 255, 255, 0.06)`

**Light theme:**
- Background: `rgba(215, 220, 230, 0.75)` with `backdrop-filter: blur(20px)`
- Hover items: `rgba(0, 0, 0, 0.04)`
- Active item: existing accent-subtle + accent left border
- Right border: `1px solid rgba(0, 0, 0, 0.08)`

### Content Area
- No changes to `--bg-primary` / `--bg-elevated` — stays opaque
- Natural contrast: translucent sidebar vs opaque content

### Borders (Global)
- Soften `--border` by ~20% more subtle
- `--border-light` becomes even lighter for dividers

---

## 2. Typography & Spacing

### Font Stack
```css
font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro", system-ui, sans-serif;
```
Keep IBM Plex Mono for code/monospace.

### Font Size
- Base: `15px` → `14px`
- Cascades through all relative sizes

### Spacing
- Message list padding: `20px` → `24px`
- Message card padding: `16px 18px` → `14px 16px`
- Sidebar item padding: unchanged (`10px 12px`)

### Line Height
- Body: `1.6` → `1.55`
- Markdown content: `1.7` → `1.6`

---

## 3. Border Radius & Cards

### Border Radius Values
```css
--radius-sm: 4px;   /* buttons, inputs, badges, inline code */
--radius-md: 6px;   /* message cards, modals, dropdowns, code blocks */
--radius-lg: 10px;  /* large containers, search modal */
```

### Message Cards (Assistant)
- Border-radius: `--radius-md` (6px)
- Left role-color border: preserved (3px solid)
- Add subtle shadow: `0 1px 3px rgba(0,0,0,0.04)`

### Message Cards (User) — Bubble Style
- Max-width: `80%`
- Margin-left: `auto` (pushes right)
- Background: `--role-user-bg` (bump opacity from 10% to 15%)
- Left border: `3px solid --role-user` (preserved)
- Border-radius: `--radius-md` (6px)
- No outer 1px border — fill provides definition

### Modals
- Overlay: `backdrop-filter: blur(8px)`
- Modal border-radius: `--radius-lg` (10px)
- Modal content: `--radius-md` (6px)

### Buttons & Inputs
- All: `--radius-sm` (4px)

---

## 4. Shadows & Vibrancy

### Shadow System

**Light theme:**
```css
--shadow-sm: 0 1px 2px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.02);
--shadow-md: 0 2px 6px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
--shadow-lg: 0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.04);
```

**Dark theme:**
```css
--shadow-sm: 0 1px 2px rgba(0,0,0,0.2);
--shadow-md: 0 2px 8px rgba(0,0,0,0.3);
--shadow-lg: 0 8px 24px rgba(0,0,0,0.4);
```

### Vibrancy Surfaces
1. **Sidebar**: `backdrop-filter: blur(20px)` with semi-transparent bg
2. **Modal overlay**: `backdrop-filter: blur(8px)` on dimming layer
3. **Search modal**: `backdrop-filter: blur(12px)` on dropdown

### Header
- Softer bottom border (more transparent)
- Optional subtle `backdrop-filter: blur(8px)` for scroll overlap

---

## What Stays the Same

- All turn border colors (user=teal, assistant=purple, agent=brown)
- Role badges (colors, typography, layout)
- Execution tree lines and nodes
- Code block backgrounds and styling
- Thinking blocks and system messages
- Overall layout structure (sidebar + content)

---

## Constraints

- Must work in Electrobun's webview (Chromium-based, so `backdrop-filter` should work)
- Both light and dark themes must be updated
- No component restructuring — CSS-only changes where possible, minor component tweaks for user message bubble layout
