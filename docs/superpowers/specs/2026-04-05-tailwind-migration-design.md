# Tailwind CSS Migration Design

**Date:** 2026-04-05
**Status:** Approved for implementation planning
**Scope:** Migrate Klovi's styling from CSS Modules + custom properties to Tailwind CSS v4

## Motivation

Migration driven by three goals, in priority order:

1. **Consistency** — Tailwind's constraint-based system enforces design tokens more strictly than free-form CSS custom properties.
2. **Developer velocity** — utility classes shorten the write/edit cycle versus authoring and maintaining `.module.css` files.
3. **Ecosystem alignment** — a Tailwind foundation unlocks Tailwind-first component libraries (shadcn/ui, Headless UI, etc.) if the project adopts one later.

No specific component library is being adopted in this work.

## Current State

- **35 CSS files**, ~2,900 lines, across three packages in the monorepo.
- **CSS Modules** (`.module.css`) in `packages/design-system` and `packages/ui-components`.
- **Plain global `.css`** in `packages/ui/src/app/**` (referenced via `className` strings).
- **Design tokens** (~60 custom properties) in `packages/design-system/src/globals/tokens.css`.
- **Light/dark themes** toggled via `[data-theme="dark"]` attribute on the root element.
- **No PostCSS pipeline** — Bun bundles CSS directly.
- **Storybook** (`packages/design-system`) for primitive components.
- **546 tests** across the codebase, using `bun test` + `happy-dom` + `@testing-library/react`.

## Architecture

### Where Tailwind lives

`packages/design-system` owns the Tailwind theme — it is the single source of truth for colors, typography, spacing, shadows, and the `[data-theme="dark"]` custom variant.

`packages/ui-components` and `packages/ui` consume the compiled Tailwind CSS by importing from `@cookielab.io/klovi-design-system/globals` (the existing entry point).

### File layout

```
packages/design-system/src/globals/
  tailwind.css       # NEW — @import "tailwindcss"; @theme { ... } @custom-variant dark ...
  reset.css          # KEEP — scrollbars, noise grain overlay, base typography, resets
  tokens.css         # REMOVED at end of migration (Phase 4)
  index.ts           # Imports tailwind.css + tokens.css (during migration) + reset.css
```

### Build integration

Tailwind v4 runs as part of the Bun bundle step via `bun-plugin-tailwind` in each package's `bun build` command. No separate CLI step, no PostCSS layer added.

If `bun-plugin-tailwind` is not viable in the current Bun version, fall back to `@tailwindcss/cli` as a pre-build step that emits `dist/globals.css` — consumers import that file instead.

Tailwind's content-scanning config covers all three packages' `src/**/*.{ts,tsx}` so utilities used anywhere are included in the compiled output.

### Coexistence guarantee

Tailwind emits its own stylesheet and CSS Modules remain scoped — the two systems do not collide. An un-migrated component keeps its `.module.css`; a migrated component uses Tailwind classes. Both render correctly side by side throughout the migration.

## Theme Token Mapping

All current CSS custom properties map into Tailwind v4's `@theme` block in `tailwind.css`. Token names are **semantically renamed** to produce clean utility class names (e.g., `bg-surface` instead of `bg-bg-primary`).

### Mapping table

| Current | Tailwind v4 token | Utility class examples |
|---|---|---|
| `--bg-primary` | `--color-surface` | `bg-surface` |
| `--bg-secondary` | `--color-surface-muted` | `bg-surface-muted` |
| `--bg-tertiary` | `--color-surface-sunken` | `bg-surface-sunken` |
| `--bg-elevated` | `--color-surface-raised` | `bg-surface-raised` |
| `--bg-card` | `--color-surface-card` | `bg-surface-card` |
| `--bg-system` | `--color-surface-system` | `bg-surface-system` |
| `--bg-thinking` | `--color-surface-thinking` | `bg-surface-thinking` |
| `--bg-code` | `--color-surface-code` | `bg-surface-code` |
| `--text-primary` | `--color-foreground` | `text-foreground` |
| `--text-secondary` | `--color-foreground-muted` | `text-foreground-muted` |
| `--text-muted` | `--color-foreground-subtle` | `text-foreground-subtle` |
| `--text-code` | `--color-foreground-code` | `text-foreground-code` |
| `--text-inverse` | `--color-foreground-inverse` | `text-foreground-inverse` |
| `--role-user` | `--color-role-user` | `text-role-user`, `bg-role-user` |
| `--role-assistant` | `--color-role-assistant` | `text-role-assistant` |
| `--role-tool` | `--color-role-tool` | `text-role-tool` |
| `--role-subagent` | `--color-role-subagent` | `text-role-subagent` |
| `--role-agent` | `--color-role-agent` | `text-role-agent` |
| `--role-user-bg` | `--color-role-user-surface` | `bg-role-user-surface` |
| `--role-assistant-bg` | `--color-role-assistant-surface` | `bg-role-assistant-surface` |
| `--role-agent-bg` | `--color-role-agent-surface` | `bg-role-agent-surface` |
| `--accent` | `--color-accent` | `bg-accent`, `text-accent` |
| `--accent-hover` | `--color-accent-hover` | `hover:bg-accent-hover` |
| `--accent-subtle` | `--color-accent-subtle` | `bg-accent-subtle` |
| `--highlight` | `--color-highlight` | `text-highlight` |
| `--border` | `--color-border` | `border-border` |
| `--border-light` | `--color-border-muted` | `border-border-muted` |
| `--tree-line` | `--color-tree-line` | `border-tree-line` |
| `--plan-color` | `--color-plan` | `text-plan`, `bg-plan` |
| `--plan-subtle` | `--color-plan-subtle` | `bg-plan-subtle` |
| `--impl-color` | `--color-impl` | `text-impl`, `bg-impl` |
| `--impl-subtle` | `--color-impl-subtle` | `bg-impl-subtle` |
| `--error` | `--color-error` | `text-error`, `bg-error` |
| `--success` | `--color-success` | `text-success`, `bg-success` |
| `--shadow-sm` | `--shadow-sm` | `shadow-sm` |
| `--shadow-md` | `--shadow-md` | `shadow-md` |
| `--shadow-lg` | `--shadow-lg` | `shadow-lg` |
| `--font-body` | `--font-sans` | `font-sans` |
| `--font-mono` | `--font-mono` | `font-mono` |
| `--font-size-base` | Tailwind `text-base` override | `text-base` |
| `--radius-sm` / `-md` / `-lg` | `--radius-*: initial` (clears Tailwind defaults so all radii stay 0) | — |
| `--sidebar-width` | `--spacing-sidebar: 320px` | `w-sidebar` |
| `--header-height` | `--spacing-header: 52px` | `h-header` |

### Token value duplication during migration

`tailwind.css` holds the canonical hex values from day one (enabling Tailwind's full color analysis, including opacity modifiers like `bg-surface/50`). `tokens.css` stays unchanged until Phase 4.

During migration, any *new* color/token **must be added to both files** to prevent drift. This trade-off keeps Tailwind utilities fully featured at the cost of a short duplication window.

## Dark Mode Strategy

```css
@import "tailwindcss";

@custom-variant dark ([data-theme="dark"] &);

@theme {
  /* light-theme values as defaults */
  --color-surface: #f2f4f8;
  --color-foreground: #1a1e2a;
  /* ...all other tokens... */
}

[data-theme="dark"] {
  /* dark-theme overrides for the same tokens */
  --color-surface: #0c0e14;
  --color-foreground: #c0c8d4;
  /* ...all other dark overrides... */
}
```

**How it works:**
- `@custom-variant dark ([data-theme="dark"] &)` tells Tailwind that `dark:` utilities match when `[data-theme="dark"]` is on an ancestor.
- Because tokens are CSS custom properties, `dark:` variants are rarely needed — `bg-surface` reads the active value automatically when the attribute flips.
- `dark:` utilities remain available when something must differ *only* in dark mode (e.g., a different shadow, an image swap).

**No changes required to the theme toggle code.** Whatever flips `data-theme` today continues to work unchanged.

## Migration Strategy

**Approach:** foundation-first, leaf-up, component-by-component.

Tailwind infrastructure is established first; then components migrate in dependency order so each component consumes already-migrated primitives.

### Phases

**Phase 0 — Foundation (1 PR)**

- Install `tailwindcss@4` and `bun-plugin-tailwind` in the appropriate packages.
- Create `packages/design-system/src/globals/tailwind.css` with `@theme`, `@custom-variant dark ([data-theme="dark"] &)`, and all token values under the new semantic names.
- Update `packages/design-system/src/globals/index.ts` to import `tailwind.css` alongside the existing `tokens.css` and `reset.css`.
- Wire `bun-plugin-tailwind` into each package's `bun build` invocation.
- Wire Tailwind into `design-system`'s Storybook preview.
- Verify: existing CSS still renders, new Tailwind utilities work, dark-mode toggle affects both systems.

**Phase 1 — `packages/design-system` primitives (8 migrations, leaf-up within phase)**

Order by complexity — simplest first:
1. Badge
2. Button
3. FormControls
4. Collapsible
5. Modal
6. CodeBox
7. Layout
8. TurnBox

**Phase 2 — `packages/ui-components` (18 migrations, grouped by subdirectory)**

- `utilities/`: ErrorBoundary, FetchError, ImageLightbox
- `messages/`: UserMessage, AssistantMessage, ThinkingBlock, SubAgentView, MessageList, MarkdownRenderer
- `tools/`: ToolCall, DiffView, SmartToolOutput
- `sessions/`: DashboardStats, ProjectList, HiddenProjectList, SessionList
- `presentation/`: PresentationShell
- `search/`: SearchModal

**Phase 3 — `packages/ui` app shell (5 migrations)**

Global `.css` files (not CSS Modules — classes referenced via `className` strings). Migrate innermost outward:
1. UpdateNotification
2. SecurityWarning
3. Onboarding
4. SettingsView
5. App.css (frame, last)

**Phase 4 — Cleanup (1 PR)**

- Delete `packages/design-system/src/globals/tokens.css`.
- Remove its import from `globals/index.ts`.
- Verify no `var(--bg-*)`, `var(--text-*)`, `var(--border*)`, etc. remains anywhere in the codebase.
- Drop any tokens from `@theme` that turned out unused.

## Coexistence Rules

- **Per component, one system only.** A component is either fully Tailwind or fully CSS Modules — never both. Migrating a component is atomic (the `.module.css` file is deleted in the same commit that adds the Tailwind classes).
- **No `@apply` or hybrid patterns.** Don't bridge by using `@apply` inside a `.module.css` file. If you touch a component, convert it fully.
- **Globals stay on plain CSS.** `reset.css` (scrollbars, noise grain overlay, base typography) stays as regular CSS; Tailwind does not replace it.
- **New components start on Tailwind.** Once Phase 0 ships, any new component created during the migration period uses Tailwind from the start — do not add to the CSS Modules pile.

## Per-Component Migration Recipe

Applied to each of the 31 component CSS files:

1. Read the `.module.css` (or `.css`) file and the component `.tsx` file that imports it.
2. For each class in the CSS file, translate to Tailwind utilities applied inline in JSX via `className="…"`.
3. Delete the CSS file and its import statement.
4. Run `bun run check && bun run typecheck && bun test`.
5. Visual check in Storybook (design-system) or the running app (ui-components, ui).
6. Toggle light/dark theme to smoke-test both modes.
7. Commit.

## Visual Fidelity Goal

**Opportunistic polish.** Pixel-identical migration is not required; minor visual drift is acceptable where it tightens inconsistencies or aligns the UI to the new token system. No visual regression tooling is added — the existing 546 unit tests remain the verification baseline, supplemented by manual Storybook/app review during each migration.

## Testing & Verification

- **No new test tooling.** Existing tests already cover component behavior and must stay green through each migration commit.
- **Per-migration verification (mandatory):** `bun run check && bun run typecheck && bun test`, plus manual visual check, plus dark-mode toggle smoke test.
- **No visual regression snapshots** — "opportunistic polish" makes screenshot diffs a source of false positives.

## Completion Criteria

The migration is complete when all of the following hold:

- [ ] Zero `.module.css` files exist in `packages/*/src/**`.
- [ ] Zero `.css` files exist in `packages/ui/src/app/**`.
- [ ] `tokens.css` is deleted.
- [ ] No `var(--bg-*)`, `var(--text-*)`, `var(--border*)`, `var(--role-*)`, `var(--accent*)`, `var(--shadow-*)`, `var(--sidebar-width)`, or `var(--header-height)` references remain in the codebase.
- [ ] `tailwind.css` is the single source of truth for theme tokens.
- [ ] `bun run check && bun run typecheck && bun test` all pass.
- [ ] `bun run build` produces a working desktop app with both light and dark themes rendering correctly.
- [ ] Both `bun run dev` (Electrobun) and `design-system`'s Storybook render the theme correctly in both light and dark modes.

## Out of Scope

- Adopting any specific Tailwind-based component library (shadcn/ui, Headless UI, etc.).
- Adding visual regression testing tooling.
- Refactoring component logic beyond what's required for the styling swap.
- Redesigning color palettes, typography, or layout beyond the naming rename.
- Introducing a PostCSS pipeline.
