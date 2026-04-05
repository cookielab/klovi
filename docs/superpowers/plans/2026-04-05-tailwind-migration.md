# Tailwind CSS Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Klovi's styling from CSS Modules + CSS custom properties to Tailwind CSS v4, component-by-component with zero runtime regressions.

**Architecture:** Foundation-first leaf-up migration. Tailwind theme lives in `packages/design-system/src/globals/tailwind.css` using `@theme` and a custom `[data-theme="dark"]` variant. Tokens are semantically renamed (e.g., `bg-surface`, `text-foreground`). CSS Modules and Tailwind coexist component-by-component during transition. `tokens.css` holds duplicated hex values until final cleanup.

**Tech Stack:** Tailwind CSS v4, `bun-plugin-tailwind` (Bun bundler), `@tailwindcss/vite` (Storybook), React 19, TypeScript strict mode, Bun runtime.

**Spec:** `docs/superpowers/specs/2026-04-05-tailwind-migration-design.md`

---

## File Structure

**New files (created in Phase 0):**
- `packages/design-system/src/globals/tailwind.css` — Tailwind entry, `@theme` block, dark custom variant

**Modified files (Phase 0):**
- `packages/design-system/src/globals/index.ts` — adds `tailwind.css` import
- `packages/design-system/.storybook/main.ts` — registers `@tailwindcss/vite` plugin
- `packages/ui/src/index.html` or `packages/ui/package.json` — wires `bun-plugin-tailwind` into build
- Root `package.json` — adds `tailwindcss@4`, `bun-plugin-tailwind`, `@tailwindcss/vite` devDependencies

**Deleted files (across migration):**
- 31 component CSS files (see Phase 1–3 tasks for full list)
- `packages/design-system/src/globals/tokens.css` (Phase 4)

**Files unchanged:**
- `packages/design-system/src/globals/reset.css` (kept as-is — scrollbars, noise grain, base typography)
- `packages/design-system/src/globals/fonts.ts` (kept — font loading)

---

## Migration Recipe (reusable reference)

Each component migration task (Tasks 7–37) follows this exact procedure. Steps are listed in each task, but the translation guidance lives here.

### Translating CSS to Tailwind utilities

For each class rule in a `.module.css` file, translate properties to Tailwind utility classes using the semantic token names defined in Phase 0. Apply them via `className="…"` on the matching JSX elements.

**Common translation patterns:**

| CSS property | Tailwind utility | Notes |
|---|---|---|
| `display: flex` | `flex` | |
| `display: inline-block` | `inline-block` | |
| `flex-direction: column` | `flex-col` | |
| `align-items: center` | `items-center` | |
| `justify-content: space-between` | `justify-between` | |
| `padding: 1px 6px` | `px-1.5 py-px` or arbitrary `px-[6px] py-px` | Use arbitrary values only when default scale doesn't match — per spec, opportunistic polish is acceptable |
| `margin-top: 8px` | `mt-2` | |
| `gap: 8px` | `gap-2` | |
| `font-family: var(--font-mono)` | `font-mono` | |
| `font-family: var(--font-body)` | `font-sans` | |
| `font-size: 0.65rem` | `text-[0.65rem]` | Arbitrary — not in default scale |
| `font-weight: 600` | `font-semibold` | |
| `letter-spacing: 0.02em` | `tracking-[0.02em]` | |
| `line-height: 1.4` | `leading-[1.4]` or `leading-snug` | |
| `text-transform: uppercase` | `uppercase` | |
| `vertical-align: middle` | `align-middle` | |
| `color: var(--role-user)` | `text-role-user` | Token rename — see table |
| `background: var(--role-user-bg)` | `bg-role-user-surface` | |
| `color: var(--text-primary)` | `text-foreground` | |
| `background: var(--bg-primary)` | `bg-surface` | |
| `border: 1px solid var(--border)` | `border border-border` | |
| `box-shadow: var(--shadow-md)` | `shadow-md` | |
| `width: var(--sidebar-width)` | `w-sidebar` | 320px via `--spacing-sidebar` |
| `height: var(--header-height)` | `h-header` | 52px via `--spacing-header` |
| `border-radius: 0` | (no utility needed — default is 0) | Radii disabled |
| `transition: all 0.15s` | `transition-all duration-150` | |
| `rgba(122, 88, 136, 0.1)` (inline literal) | `bg-[rgba(122,88,136,0.1)]` or add a new token to `@theme` | Prefer adding a token if reused |

**Full token rename table:** see `docs/superpowers/specs/2026-04-05-tailwind-migration-design.md` § "Theme Token Mapping".

**Hover/focus/active variants:** Use Tailwind variants — `hover:bg-accent-hover`, `focus:outline-accent`, `active:bg-accent-subtle`.

**Pseudo-selectors (`:first-child`, `:not(:last-child)`, etc.):** Use Tailwind variants (`first:`, `last:`, `not-last:` etc.) or arbitrary variants (`[&:not(:last-child)]:mb-2`).

**Media queries / container queries:** Use Tailwind responsive prefixes. If no project breakpoints are established, define them in `@theme` when first needed.

### Class composition in JSX

When multiple classes conditionally apply (e.g., a variant system), use an array-join pattern or a utility like `clsx`. The project already uses inline className strings — keep the same approach:

```tsx
<span className={`inline-block px-1.5 py-px font-semibold ${variantClass}`}>
```

Where `variantClass` is a lookup map:

```tsx
const variantClass = {
  user: "text-role-user bg-role-user-surface",
  assistant: "text-role-assistant bg-role-assistant-surface",
  // ...
}[variant];
```

### Per-component recipe steps

For each component:

1. Read the `.module.css` file.
2. Read the `.tsx` file(s) that import it.
3. For each class in the CSS, translate to Tailwind utilities and apply via `className` in JSX.
4. If a variant map is needed, define it as a `const` at module scope.
5. Delete the `.module.css` file.
6. Remove its import from the `.tsx` file.
7. Run `bun run check && bun run typecheck && bun test`.
8. Manually verify: render the component (Storybook for design-system, running app otherwise); toggle light/dark theme.
9. Commit with a message like `refactor(ui): migrate ComponentName to Tailwind`.

---

# Phase 0 — Foundation (Tasks 1–6)

### Task 1: Install Tailwind v4 dependencies

**Files:**
- Modify: `package.json` (root)

- [ ] **Step 1: Install Tailwind, Bun plugin, and Vite plugin (for Storybook)**

Run:
```bash
bun add -D tailwindcss@^4 bun-plugin-tailwind @tailwindcss/vite
```

- [ ] **Step 2: Verify packages installed**

Run:
```bash
bun pm ls | grep -E "tailwindcss|bun-plugin-tailwind|@tailwindcss/vite"
```
Expected: three matching lines, each showing a resolved version.

- [ ] **Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "chore(deps): add tailwindcss v4, bun plugin, and vite plugin"
```

---

### Task 2: Create `tailwind.css` with `@theme` block and dark variant

**Files:**
- Create: `packages/design-system/src/globals/tailwind.css`

- [ ] **Step 1: Create the Tailwind entry file**

Write `packages/design-system/src/globals/tailwind.css`:

```css
@import "tailwindcss";

@custom-variant dark ([data-theme="dark"] &);

/* User-configurable font size — set at runtime by useFontSize hook.
   Kept as a CSS custom property (not @theme token) because it mutates at runtime. */
:root {
	--font-size-base: 15px;
}

@theme {
	/* Clear Tailwind defaults the project does not use */
	--radius-*: initial;

	/* Typography */
	--font-sans: "DM Sans", system-ui, sans-serif;
	--font-mono: "IBM Plex Mono", "Consolas", monospace;

	/* Spacing tokens for layout */
	--spacing-sidebar: 320px;
	--spacing-header: 52px;

	/* Surfaces (backgrounds) */
	--color-surface: #f2f4f8;
	--color-surface-muted: #e8eaef;
	--color-surface-sunken: #d8dce6;
	--color-surface-raised: #ffffff;
	--color-surface-card: #ffffff;
	--color-surface-system: #f0ede8;
	--color-surface-thinking: #ece9f4;
	--color-surface-code: #eceef4;

	/* Foreground (text) */
	--color-foreground: #1a1e2a;
	--color-foreground-muted: #3a4255;
	--color-foreground-subtle: #7a8499;
	--color-foreground-code: #3a4060;
	--color-foreground-inverse: #f2f4f8;

	/* Role colors */
	--color-role-user: #3a7a96;
	--color-role-assistant: #6a58a0;
	--color-role-tool: #4a6880;
	--color-role-subagent: #7a5888;
	--color-role-agent: #8a6828;
	--color-role-user-surface: rgba(58, 122, 150, 0.1);
	--color-role-assistant-surface: rgba(106, 88, 160, 0.1);
	--color-role-agent-surface: rgba(138, 104, 40, 0.1);

	/* Accent */
	--color-accent: #6a58a0;
	--color-accent-hover: #5a4890;
	--color-accent-subtle: #ede9f8;
	--color-highlight: #3a7a96;

	/* Borders */
	--color-border: #c8ccda;
	--color-border-muted: #dce0ea;
	--color-tree-line: #c0c8d8;

	/* Session types */
	--color-plan: #6a58a0;
	--color-plan-subtle: #ede9f8;
	--color-impl: #8a5830;
	--color-impl-subtle: #f8ede3;

	/* Status */
	--color-error: #985050;
	--color-success: #3a7858;

	/* Shadows */
	--shadow-sm: 0 1px 2px rgba(20, 25, 40, 0.06);
	--shadow-md: 0 2px 8px rgba(20, 25, 40, 0.1);
	--shadow-lg: 0 4px 16px rgba(20, 25, 40, 0.14);
}

/* Dark theme overrides — same tokens, different values */
[data-theme="dark"] {
	--color-surface: #0c0e14;
	--color-surface-muted: #11141c;
	--color-surface-sunken: #161a24;
	--color-surface-raised: #1c2130;
	--color-surface-card: #161a24;
	--color-surface-system: #15120e;
	--color-surface-thinking: #12101c;
	--color-surface-code: #12151e;

	--color-foreground: #c0c8d4;
	--color-foreground-muted: #8890a0;
	--color-foreground-subtle: #555e70;
	--color-foreground-code: #a8b4c4;
	--color-foreground-inverse: #0c0e14;

	--color-role-user: #4a90a8;
	--color-role-assistant: #7c68b0;
	--color-role-tool: #5a7890;
	--color-role-subagent: #8a6898;
	--color-role-agent: #a08840;
	--color-role-user-surface: rgba(74, 144, 168, 0.1);
	--color-role-assistant-surface: rgba(124, 104, 176, 0.1);
	--color-role-agent-surface: rgba(160, 136, 64, 0.1);

	--color-accent: #7c68b0;
	--color-accent-hover: #9080c0;
	--color-accent-subtle: #1a1630;
	--color-highlight: #4a90a8;

	--color-border: #1e2430;
	--color-border-muted: #2a3040;
	--color-tree-line: #2a3040;

	--color-plan: #9080c0;
	--color-plan-subtle: #1a1530;
	--color-impl: #c09060;
	--color-impl-subtle: #1e1510;

	--color-error: #a85050;
	--color-success: #508868;

	--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
	--shadow-md: 0 2px 8px rgba(0, 0, 0, 0.4);
	--shadow-lg: 0 4px 16px rgba(0, 0, 0, 0.55);
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/design-system/src/globals/tailwind.css
git commit -m "feat(design-system): add tailwind v4 entry with theme and dark variant"
```

---

### Task 3: Wire `tailwind.css` into the globals entry point

**Files:**
- Modify: `packages/design-system/src/globals/index.ts`

- [ ] **Step 1: Add the import**

Replace the contents of `packages/design-system/src/globals/index.ts` with:

```ts
import "./tokens.css";
import "./tailwind.css";
import "./reset.css";
import "./fonts.ts";
```

Order matters: `tokens.css` first (legacy custom properties), then `tailwind.css` (new theme tokens), then `reset.css` (global resets), then `fonts.ts` (font loading).

- [ ] **Step 2: Run typecheck to confirm nothing broke**

Run:
```bash
bun run typecheck
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/design-system/src/globals/index.ts
git commit -m "feat(design-system): import tailwind.css in globals entry"
```

---

### Task 4: Wire `bun-plugin-tailwind` into the UI build

**Files:**
- Create: `packages/ui/build.ts`
- Modify: `packages/ui/package.json`

- [ ] **Step 1: Create a Bun build script that registers the Tailwind plugin**

Write `packages/ui/build.ts`:

```ts
import tailwindPlugin from "bun-plugin-tailwind";

const isWatch = process.argv.includes("--watch");
const isMinify = process.argv.includes("--minify");

await Bun.build({
	entrypoints: ["src/index.html"],
	outdir: "dist",
	plugins: [tailwindPlugin],
	minify: isMinify,
	...(isWatch ? { watch: true } : {}),
});
```

- [ ] **Step 2: Update `packages/ui/package.json` scripts**

Modify the `scripts` section of `packages/ui/package.json`:

```json
"scripts": {
	"dev": "bun run build.ts --watch",
	"build": "bun run build.ts --minify",
	"typecheck": "tsc --noEmit -p tsconfig.json"
}
```

- [ ] **Step 3: Run a dev build to verify Tailwind compiles**

Run:
```bash
cd packages/ui && bun run build
```
Expected: build completes; `dist/` contains a CSS bundle that includes Tailwind's base layer (search output for `@layer` or a Tailwind utility to confirm).

- [ ] **Step 4: Commit**

```bash
git add packages/ui/build.ts packages/ui/package.json
git commit -m "feat(ui): wire bun-plugin-tailwind into build"
```

---

### Task 5: Wire `@tailwindcss/vite` into Storybook

**Files:**
- Modify: `packages/design-system/.storybook/main.ts`

- [ ] **Step 1: Register the Tailwind Vite plugin in Storybook**

Replace the contents of `packages/design-system/.storybook/main.ts` with:

```ts
import type { StorybookConfig } from "@storybook/react-vite";
import tailwindcss from "@tailwindcss/vite";

const config: StorybookConfig = {
	stories: ["../src/stories/**/*.stories.tsx"],
	framework: "@storybook/react-vite",
	viteFinal: async (viteConfig) => {
		viteConfig.plugins = [...(viteConfig.plugins ?? []), tailwindcss()];
		return viteConfig;
	},
};

export default config;
```

- [ ] **Step 2: Start Storybook to verify it boots**

Run:
```bash
bun run storybook
```
Expected: Storybook starts on port 6006 without Vite plugin errors. Visit `http://localhost:6006` and confirm existing stories render with their original CSS Module styling. Stop with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add packages/design-system/.storybook/main.ts
git commit -m "feat(design-system): wire tailwindcss vite plugin into storybook"
```

---

### Task 6: Foundation verification

**Files:** (no files modified — verification only)

- [ ] **Step 1: Add a temporary Tailwind utility to a test location**

In `packages/ui/src/app/App.tsx` (or wherever the root app element lives), temporarily add `data-tw-test="1" className="bg-surface text-foreground"` to the outermost element. (If you can't find it, search with: `rg "data-theme" packages/ui/src --type tsx`.)

- [ ] **Step 2: Run the dev app and inspect the element**

Run:
```bash
bun run dev:desktop
```
Expected: Electrobun app starts. In the running app, open DevTools and inspect the element with `data-tw-test="1"`. Confirm:
- It has `background-color` resolving to the light-theme surface value (`#f2f4f8`).
- Its text color resolves to `#1a1e2a`.

- [ ] **Step 3: Toggle dark theme and re-inspect**

In the app, switch to dark theme via the existing toggle. Confirm the same element now resolves to:
- `background-color`: `#0c0e14`
- `color`: `#c0c8d4`

This confirms the `@custom-variant dark ([data-theme="dark"] &)` is wired correctly and that tokens override as expected.

- [ ] **Step 4: Remove the temporary test attribute**

Undo the addition from Step 1 — remove `data-tw-test="1"` and the Tailwind classes.

- [ ] **Step 5: Run full verification**

Run:
```bash
bun run check && bun run typecheck && bun test
```
Expected: all pass.

- [ ] **Step 6: Commit (if anything actually changed; should be empty)**

If Step 4 left no changes, skip. Otherwise:
```bash
git add -A
git commit -m "chore: clean up foundation verification"
```

---

# Phase 1 — `packages/design-system` components (Tasks 7–14)

Each task migrates one component following the **Migration Recipe** above.

### Task 7: Migrate Badge

**Files:**
- Read: `packages/design-system/src/components/Badge/Badge.module.css`
- Modify: `packages/design-system/src/components/Badge/Badge.tsx` (and any siblings that import the module)
- Delete: `packages/design-system/src/components/Badge/Badge.module.css`

- [ ] **Step 1: Read current files**

Run:
```bash
cat packages/design-system/src/components/Badge/Badge.module.css
cat packages/design-system/src/components/Badge/Badge.tsx
```

- [ ] **Step 2: Translate classes to Tailwind utilities**

Apply the procedure in **Migration Recipe** to produce the Tailwind equivalent. For Badge, each variant (`user`, `assistant`, `tool`, `plan`, etc.) becomes an entry in a variant-class lookup map. Apply via `className` in JSX.

- [ ] **Step 3: Delete `Badge.module.css` and remove its import**

Run:
```bash
rm packages/design-system/src/components/Badge/Badge.module.css
```
Then remove the `import` statement from `Badge.tsx`.

- [ ] **Step 4: Verify**

Run:
```bash
bun run check && bun run typecheck && bun test
```
Expected: all pass.

- [ ] **Step 5: Visual check in Storybook**

Run:
```bash
bun run storybook
```
Open the Badge story, verify each variant renders identically in light theme, then toggle dark theme and confirm the same.

- [ ] **Step 6: Commit**

```bash
git add packages/design-system/src/components/Badge/
git commit -m "refactor(design-system): migrate Badge to Tailwind"
```

---

### Task 8: Migrate Button

**Files:**
- Read: `packages/design-system/src/components/Button/Button.module.css`
- Modify: `packages/design-system/src/components/Button/Button.tsx`
- Delete: `packages/design-system/src/components/Button/Button.module.css`

- [ ] **Step 1: Read current files**
  Run `cat` on the two files above.
- [ ] **Step 2: Translate classes** (per **Migration Recipe**).
- [ ] **Step 3: Delete CSS file + remove import.**
- [ ] **Step 4: Verify** — `bun run check && bun run typecheck && bun test` must pass.
- [ ] **Step 5: Visual check in Storybook** (all variants, both themes).
- [ ] **Step 6: Commit** — `git add packages/design-system/src/components/Button/ && git commit -m "refactor(design-system): migrate Button to Tailwind"`.

---

### Task 9: Migrate FormControls

**Files:**
- Read: `packages/design-system/src/components/FormControls/FormControls.module.css`
- Modify: `packages/design-system/src/components/FormControls/FormControls.tsx`
- Delete: `packages/design-system/src/components/FormControls/FormControls.module.css`

- [ ] **Step 1: Read current files.**
- [ ] **Step 2: Translate classes** (per **Migration Recipe**). FormControls likely contains multiple elements (inputs, labels, checkboxes); each may need its own className string.
- [ ] **Step 3: Delete CSS file + remove import.**
- [ ] **Step 4: Verify** — `bun run check && bun run typecheck && bun test` must pass.
- [ ] **Step 5: Visual check in Storybook** (all states: default, focused, disabled, checked; both themes).
- [ ] **Step 6: Commit** — `git add packages/design-system/src/components/FormControls/ && git commit -m "refactor(design-system): migrate FormControls to Tailwind"`.

---

### Task 10: Migrate Collapsible

**Files:**
- Read: `packages/design-system/src/components/Collapsible/Collapsible.module.css`
- Modify: `packages/design-system/src/components/Collapsible/Collapsible.tsx`
- Delete: `packages/design-system/src/components/Collapsible/Collapsible.module.css`

- [ ] **Step 1: Read current files.**
- [ ] **Step 2: Translate classes** (per **Migration Recipe**). For transition timing, use Tailwind's `transition`, `duration-*`, `ease-*` utilities.
- [ ] **Step 3: Delete CSS file + remove import.**
- [ ] **Step 4: Verify** — `bun run check && bun run typecheck && bun test` must pass.
- [ ] **Step 5: Visual check in Storybook** (open/closed states, both themes).
- [ ] **Step 6: Commit** — `git add packages/design-system/src/components/Collapsible/ && git commit -m "refactor(design-system): migrate Collapsible to Tailwind"`.

---

### Task 11: Migrate Modal

**Files:**
- Read: `packages/design-system/src/components/Modal/Modal.module.css`
- Modify: `packages/design-system/src/components/Modal/Modal.tsx`
- Delete: `packages/design-system/src/components/Modal/Modal.module.css`

- [ ] **Step 1: Read current files.**
- [ ] **Step 2: Translate classes** (per **Migration Recipe**). Modal typically has overlay + dialog + close button — translate each.
- [ ] **Step 3: Delete CSS file + remove import.**
- [ ] **Step 4: Verify** — `bun run check && bun run typecheck && bun test` must pass.
- [ ] **Step 5: Visual check in Storybook** (open state, backdrop behavior, both themes).
- [ ] **Step 6: Commit** — `git add packages/design-system/src/components/Modal/ && git commit -m "refactor(design-system): migrate Modal to Tailwind"`.

---

### Task 12: Migrate CodeBox

**Files:**
- Read: `packages/design-system/src/components/CodeBox/CodeBox.module.css`
- Modify: `packages/design-system/src/components/CodeBox/CodeBox.tsx`
- Delete: `packages/design-system/src/components/CodeBox/CodeBox.module.css`

- [ ] **Step 1: Read current files.**
- [ ] **Step 2: Translate classes** (per **Migration Recipe**). CodeBox uses `--font-mono`, `--bg-code`, `--text-code` — these map to `font-mono`, `bg-surface-code`, `text-foreground-code`.
- [ ] **Step 3: Delete CSS file + remove import.**
- [ ] **Step 4: Verify** — `bun run check && bun run typecheck && bun test` must pass.
- [ ] **Step 5: Visual check in Storybook** (code rendering, both themes).
- [ ] **Step 6: Commit** — `git add packages/design-system/src/components/CodeBox/ && git commit -m "refactor(design-system): migrate CodeBox to Tailwind"`.

---

### Task 13: Migrate Layout

**Files:**
- Read: `packages/design-system/src/components/Layout/Layout.module.css`
- Modify: `packages/design-system/src/components/Layout/Layout.tsx`
- Delete: `packages/design-system/src/components/Layout/Layout.module.css`

- [ ] **Step 1: Read current files.**
- [ ] **Step 2: Translate classes** (per **Migration Recipe**). Layout primitives likely use flex/gap — map these directly (`flex`, `flex-col`, `gap-2`, etc.).
- [ ] **Step 3: Delete CSS file + remove import.**
- [ ] **Step 4: Verify** — `bun run check && bun run typecheck && bun test` must pass.
- [ ] **Step 5: Visual check in Storybook** (all layout variants, both themes).
- [ ] **Step 6: Commit** — `git add packages/design-system/src/components/Layout/ && git commit -m "refactor(design-system): migrate Layout to Tailwind"`.

---

### Task 14: Migrate TurnBox

**Files:**
- Read: `packages/design-system/src/components/TurnBox/TurnBox.module.css`
- Modify: `packages/design-system/src/components/TurnBox/TurnBox.tsx`
- Delete: `packages/design-system/src/components/TurnBox/TurnBox.module.css`

- [ ] **Step 1: Read current files.**
- [ ] **Step 2: Translate classes** (per **Migration Recipe**). TurnBox uses role-specific backgrounds — map to `bg-role-{user,assistant,tool,…}-surface` and `text-role-{…}`.
- [ ] **Step 3: Delete CSS file + remove import.**
- [ ] **Step 4: Verify** — `bun run check && bun run typecheck && bun test` must pass.
- [ ] **Step 5: Visual check in Storybook** (all role variants, both themes).
- [ ] **Step 6: Commit** — `git add packages/design-system/src/components/TurnBox/ && git commit -m "refactor(design-system): migrate TurnBox to Tailwind"`.

---

# Phase 2 — `packages/ui-components` (Tasks 15–32)

### Task 15: Migrate ErrorBoundary

**Files:**
- Read: `packages/ui-components/src/utilities/ErrorBoundary.module.css`
- Modify: `packages/ui-components/src/utilities/ErrorBoundary.tsx`
- Delete: `packages/ui-components/src/utilities/ErrorBoundary.module.css`

- [ ] **Step 1: Read current files.**
- [ ] **Step 2: Translate classes** (per **Migration Recipe**).
- [ ] **Step 3: Delete CSS file + remove import.**
- [ ] **Step 4: Verify** — `bun run check && bun run typecheck && bun test` must pass.
- [ ] **Step 5: Visual check** — trigger an error in dev and confirm fallback renders; toggle dark theme.
- [ ] **Step 6: Commit** — `git add packages/ui-components/src/utilities/ErrorBoundary* && git commit -m "refactor(ui-components): migrate ErrorBoundary to Tailwind"`.

---

### Task 16: Migrate FetchError

**Files:**
- Read: `packages/ui-components/src/utilities/FetchError.module.css`
- Modify: `packages/ui-components/src/utilities/FetchError.tsx`
- Delete: `packages/ui-components/src/utilities/FetchError.module.css`

- [ ] **Step 1: Read current files.**
- [ ] **Step 2: Translate classes** (per **Migration Recipe**). Uses `--color-error` → `text-error`.
- [ ] **Step 3: Delete CSS file + remove import.**
- [ ] **Step 4: Verify** — `bun run check && bun run typecheck && bun test` must pass.
- [ ] **Step 5: Visual check** — trigger a fetch error in dev; toggle dark theme.
- [ ] **Step 6: Commit** — `git add packages/ui-components/src/utilities/FetchError* && git commit -m "refactor(ui-components): migrate FetchError to Tailwind"`.

---

### Task 17: Migrate ImageLightbox

**Files:**
- Read: `packages/ui-components/src/utilities/ImageLightbox.module.css`
- Modify: `packages/ui-components/src/utilities/ImageLightbox.tsx`
- Delete: `packages/ui-components/src/utilities/ImageLightbox.module.css`

- [ ] **Step 1: Read current files.**
- [ ] **Step 2: Translate classes** (per **Migration Recipe**). Lightbox likely has `position: fixed` overlay — translate to `fixed inset-0 bg-surface/80` or similar.
- [ ] **Step 3: Delete CSS file + remove import.**
- [ ] **Step 4: Verify** — `bun run check && bun run typecheck && bun test` must pass.
- [ ] **Step 5: Visual check** — click an image in dev to open lightbox; confirm overlay + close behavior; toggle dark theme.
- [ ] **Step 6: Commit** — `git add packages/ui-components/src/utilities/ImageLightbox* && git commit -m "refactor(ui-components): migrate ImageLightbox to Tailwind"`.

---

### Task 18: Migrate UserMessage

**Files:**
- Read: `packages/ui-components/src/messages/UserMessage.module.css`
- Modify: `packages/ui-components/src/messages/UserMessage.tsx`
- Delete: `packages/ui-components/src/messages/UserMessage.module.css`

- [ ] **Step 1: Read current files.**
- [ ] **Step 2: Translate classes** (per **Migration Recipe**). Uses `--role-user`, `--role-user-bg` → `text-role-user`, `bg-role-user-surface`.
- [ ] **Step 3: Delete CSS file + remove import.**
- [ ] **Step 4: Verify** — `bun run check && bun run typecheck && bun test` must pass.
- [ ] **Step 5: Visual check** — render a session with user messages; toggle dark theme.
- [ ] **Step 6: Commit** — `git add packages/ui-components/src/messages/UserMessage* && git commit -m "refactor(ui-components): migrate UserMessage to Tailwind"`.

---

### Task 19: Migrate AssistantMessage

**Files:**
- Read: `packages/ui-components/src/messages/AssistantMessage.module.css`
- Modify: `packages/ui-components/src/messages/AssistantMessage.tsx`
- Delete: `packages/ui-components/src/messages/AssistantMessage.module.css`

- [ ] **Step 1: Read current files.**
- [ ] **Step 2: Translate classes** (per **Migration Recipe**). Uses `--role-assistant`, `--role-assistant-bg`.
- [ ] **Step 3: Delete CSS file + remove import.**
- [ ] **Step 4: Verify** — `bun run check && bun run typecheck && bun test` must pass.
- [ ] **Step 5: Visual check** — render a session with assistant messages; toggle dark theme.
- [ ] **Step 6: Commit** — `git add packages/ui-components/src/messages/AssistantMessage* && git commit -m "refactor(ui-components): migrate AssistantMessage to Tailwind"`.

---

### Task 20: Migrate ThinkingBlock

**Files:**
- Read: `packages/ui-components/src/messages/ThinkingBlock.module.css`
- Modify: `packages/ui-components/src/messages/ThinkingBlock.tsx`
- Delete: `packages/ui-components/src/messages/ThinkingBlock.module.css`

- [ ] **Step 1: Read current files.**
- [ ] **Step 2: Translate classes** (per **Migration Recipe**). Uses `--bg-thinking` → `bg-surface-thinking`.
- [ ] **Step 3: Delete CSS file + remove import.**
- [ ] **Step 4: Verify** — `bun run check && bun run typecheck && bun test` must pass.
- [ ] **Step 5: Visual check** — find a session with thinking blocks; expand/collapse; toggle dark theme.
- [ ] **Step 6: Commit** — `git add packages/ui-components/src/messages/ThinkingBlock* && git commit -m "refactor(ui-components): migrate ThinkingBlock to Tailwind"`.

---

### Task 21: Migrate SubAgentView

**Files:**
- Read: `packages/ui-components/src/messages/SubAgentView.module.css`
- Modify: `packages/ui-components/src/messages/SubAgentView.tsx`
- Delete: `packages/ui-components/src/messages/SubAgentView.module.css`

- [ ] **Step 1: Read current files.**
- [ ] **Step 2: Translate classes** (per **Migration Recipe**). Uses `--role-subagent`.
- [ ] **Step 3: Delete CSS file + remove import.**
- [ ] **Step 4: Verify** — `bun run check && bun run typecheck && bun test` must pass.
- [ ] **Step 5: Visual check** — find a session with subagent turns; toggle dark theme.
- [ ] **Step 6: Commit** — `git add packages/ui-components/src/messages/SubAgentView* && git commit -m "refactor(ui-components): migrate SubAgentView to Tailwind"`.

---

### Task 22: Migrate MessageList

**Files:**
- Read: `packages/ui-components/src/messages/MessageList.module.css`
- Modify: `packages/ui-components/src/messages/MessageList.tsx`
- Delete: `packages/ui-components/src/messages/MessageList.module.css`

- [ ] **Step 1: Read current files.**
- [ ] **Step 2: Translate classes** (per **Migration Recipe**). Container-level layout (flex/gap/padding).
- [ ] **Step 3: Delete CSS file + remove import.**
- [ ] **Step 4: Verify** — `bun run check && bun run typecheck && bun test` must pass.
- [ ] **Step 5: Visual check** — open any session; toggle dark theme; confirm message spacing.
- [ ] **Step 6: Commit** — `git add packages/ui-components/src/messages/MessageList* && git commit -m "refactor(ui-components): migrate MessageList to Tailwind"`.

---

### Task 23: Migrate MarkdownRenderer

**Files:**
- Read: `packages/ui-components/src/messages/MarkdownRenderer.module.css`
- Modify: `packages/ui-components/src/messages/MarkdownRenderer.tsx`
- Delete: `packages/ui-components/src/messages/MarkdownRenderer.module.css`

- [ ] **Step 1: Read current files.**
- [ ] **Step 2: Translate classes** (per **Migration Recipe**). Markdown styling spans h1–h6, p, ul, ol, blockquote, code, pre, a, strong, em — each needs Tailwind utilities. For element-scoped styling, use Tailwind's arbitrary descendant variants (e.g., `[&_h1]:text-2xl`) applied to a wrapper `div`.
- [ ] **Step 3: Delete CSS file + remove import.**
- [ ] **Step 4: Verify** — `bun run check && bun run typecheck && bun test` must pass.
- [ ] **Step 5: Visual check** — render a message containing varied markdown (headers, lists, code, links, blockquote); toggle dark theme.
- [ ] **Step 6: Commit** — `git add packages/ui-components/src/messages/MarkdownRenderer* && git commit -m "refactor(ui-components): migrate MarkdownRenderer to Tailwind"`.

---

### Task 24: Migrate ToolCall

**Files:**
- Read: `packages/ui-components/src/tools/ToolCall.module.css`
- Modify: `packages/ui-components/src/tools/ToolCall.tsx`
- Delete: `packages/ui-components/src/tools/ToolCall.module.css`

- [ ] **Step 1: Read current files.**
- [ ] **Step 2: Translate classes** (per **Migration Recipe**). Uses `--role-tool`.
- [ ] **Step 3: Delete CSS file + remove import.**
- [ ] **Step 4: Verify** — `bun run check && bun run typecheck && bun test` must pass.
- [ ] **Step 5: Visual check** — find a session with tool calls; expand/collapse; toggle dark theme.
- [ ] **Step 6: Commit** — `git add packages/ui-components/src/tools/ToolCall* && git commit -m "refactor(ui-components): migrate ToolCall to Tailwind"`.

---

### Task 25: Migrate DiffView

**Files:**
- Read: `packages/ui-components/src/tools/DiffView.module.css`
- Modify: `packages/ui-components/src/tools/DiffView.tsx`
- Delete: `packages/ui-components/src/tools/DiffView.module.css`

- [ ] **Step 1: Read current files.**
- [ ] **Step 2: Translate classes** (per **Migration Recipe**). DiffView likely has add/remove row colors — may need new tokens if those aren't already in `@theme` (check `--color-success`, `--color-error` — likely reuse these).
- [ ] **Step 3: Delete CSS file + remove import.**
- [ ] **Step 4: Verify** — `bun run check && bun run typecheck && bun test` must pass.
- [ ] **Step 5: Visual check** — find a session with file edits producing diffs; toggle dark theme.
- [ ] **Step 6: Commit** — `git add packages/ui-components/src/tools/DiffView* && git commit -m "refactor(ui-components): migrate DiffView to Tailwind"`.

---

### Task 26: Migrate SmartToolOutput

**Files:**
- Read: `packages/ui-components/src/tools/SmartToolOutput.module.css`
- Modify: `packages/ui-components/src/tools/SmartToolOutput.tsx`
- Delete: `packages/ui-components/src/tools/SmartToolOutput.module.css`

- [ ] **Step 1: Read current files.**
- [ ] **Step 2: Translate classes** (per **Migration Recipe**).
- [ ] **Step 3: Delete CSS file + remove import.**
- [ ] **Step 4: Verify** — `bun run check && bun run typecheck && bun test` must pass.
- [ ] **Step 5: Visual check** — find a session with tool outputs; toggle dark theme.
- [ ] **Step 6: Commit** — `git add packages/ui-components/src/tools/SmartToolOutput* && git commit -m "refactor(ui-components): migrate SmartToolOutput to Tailwind"`.

---

### Task 27: Migrate DashboardStats

**Files:**
- Read: `packages/ui-components/src/sessions/DashboardStats.module.css`
- Modify: `packages/ui-components/src/sessions/DashboardStats.tsx`
- Delete: `packages/ui-components/src/sessions/DashboardStats.module.css`

- [ ] **Step 1: Read current files.**
- [ ] **Step 2: Translate classes** (per **Migration Recipe**).
- [ ] **Step 3: Delete CSS file + remove import.**
- [ ] **Step 4: Verify** — `bun run check && bun run typecheck && bun test` must pass.
- [ ] **Step 5: Visual check** — open dashboard/home view; toggle dark theme.
- [ ] **Step 6: Commit** — `git add packages/ui-components/src/sessions/DashboardStats* && git commit -m "refactor(ui-components): migrate DashboardStats to Tailwind"`.

---

### Task 28: Migrate ProjectList

**Files:**
- Read: `packages/ui-components/src/sessions/ProjectList.module.css`
- Modify: `packages/ui-components/src/sessions/ProjectList.tsx`
- Delete: `packages/ui-components/src/sessions/ProjectList.module.css`

- [ ] **Step 1: Read current files.**
- [ ] **Step 2: Translate classes** (per **Migration Recipe**).
- [ ] **Step 3: Delete CSS file + remove import.**
- [ ] **Step 4: Verify** — `bun run check && bun run typecheck && bun test` must pass.
- [ ] **Step 5: Visual check** — open project list in sidebar; hover states; toggle dark theme.
- [ ] **Step 6: Commit** — `git add packages/ui-components/src/sessions/ProjectList* && git commit -m "refactor(ui-components): migrate ProjectList to Tailwind"`.

---

### Task 29: Migrate HiddenProjectList

**Files:**
- Read: `packages/ui-components/src/sessions/HiddenProjectList.module.css`
- Modify: `packages/ui-components/src/sessions/HiddenProjectList.tsx`
- Delete: `packages/ui-components/src/sessions/HiddenProjectList.module.css`

- [ ] **Step 1: Read current files.**
- [ ] **Step 2: Translate classes** (per **Migration Recipe**).
- [ ] **Step 3: Delete CSS file + remove import.**
- [ ] **Step 4: Verify** — `bun run check && bun run typecheck && bun test` must pass.
- [ ] **Step 5: Visual check** — hide a project, open hidden-projects view, toggle dark theme.
- [ ] **Step 6: Commit** — `git add packages/ui-components/src/sessions/HiddenProjectList* && git commit -m "refactor(ui-components): migrate HiddenProjectList to Tailwind"`.

---

### Task 30: Migrate SessionList

**Files:**
- Read: `packages/ui-components/src/sessions/SessionList.module.css`
- Modify: `packages/ui-components/src/sessions/SessionList.tsx`
- Delete: `packages/ui-components/src/sessions/SessionList.module.css`

- [ ] **Step 1: Read current files.**
- [ ] **Step 2: Translate classes** (per **Migration Recipe**). Uses tree lines (`--tree-line` → `border-tree-line`).
- [ ] **Step 3: Delete CSS file + remove import.**
- [ ] **Step 4: Verify** — `bun run check && bun run typecheck && bun test` must pass.
- [ ] **Step 5: Visual check** — open a project's session list, hover and select, toggle dark theme.
- [ ] **Step 6: Commit** — `git add packages/ui-components/src/sessions/SessionList* && git commit -m "refactor(ui-components): migrate SessionList to Tailwind"`.

---

### Task 31: Migrate PresentationShell

**Files:**
- Read: `packages/ui-components/src/presentation/PresentationShell.module.css`
- Modify: `packages/ui-components/src/presentation/PresentationShell.tsx`
- Delete: `packages/ui-components/src/presentation/PresentationShell.module.css`

- [ ] **Step 1: Read current files.**
- [ ] **Step 2: Translate classes** (per **Migration Recipe**).
- [ ] **Step 3: Delete CSS file + remove import.**
- [ ] **Step 4: Verify** — `bun run check && bun run typecheck && bun test` must pass.
- [ ] **Step 5: Visual check** — open presentation mode; toggle dark theme.
- [ ] **Step 6: Commit** — `git add packages/ui-components/src/presentation/PresentationShell* && git commit -m "refactor(ui-components): migrate PresentationShell to Tailwind"`.

---

### Task 32: Migrate SearchModal

**Files:**
- Read: `packages/ui-components/src/search/SearchModal.module.css`
- Modify: `packages/ui-components/src/search/SearchModal.tsx`
- Delete: `packages/ui-components/src/search/SearchModal.module.css`

- [ ] **Step 1: Read current files.**
- [ ] **Step 2: Translate classes** (per **Migration Recipe**).
- [ ] **Step 3: Delete CSS file + remove import.**
- [ ] **Step 4: Verify** — `bun run check && bun run typecheck && bun test` must pass.
- [ ] **Step 5: Visual check** — open search modal; navigate with keyboard; toggle dark theme.
- [ ] **Step 6: Commit** — `git add packages/ui-components/src/search/SearchModal* && git commit -m "refactor(ui-components): migrate SearchModal to Tailwind"`.

---

# Phase 3 — `packages/ui` app shell (Tasks 33–37)

These are **plain `.css` files** (not CSS Modules). Classes are referenced via `className` strings in JSX. Migration replaces those `className` strings with Tailwind utilities.

### Task 33: Migrate UpdateNotification

**Files:**
- Read: `packages/ui/src/app/components/UpdateNotification.css`
- Read: `packages/ui/src/app/components/UpdateNotification.tsx`
- Modify: `packages/ui/src/app/components/UpdateNotification.tsx`
- Delete: `packages/ui/src/app/components/UpdateNotification.css`

- [ ] **Step 1: Read current files.**
- [ ] **Step 2: For each class used in JSX, translate to Tailwind utilities** (per **Migration Recipe**). Replace `className="update-notification"` etc. with the Tailwind equivalent. Remove the CSS import statement.
- [ ] **Step 3: Delete the CSS file.**
- [ ] **Step 4: Verify** — `bun run check && bun run typecheck && bun test` must pass.
- [ ] **Step 5: Visual check** — trigger an update notification in dev; toggle dark theme.
- [ ] **Step 6: Commit** — `git add packages/ui/src/app/components/UpdateNotification* && git commit -m "refactor(ui): migrate UpdateNotification to Tailwind"`.

---

### Task 34: Migrate SecurityWarning

**Files:**
- Read: `packages/ui/src/app/components/ui/SecurityWarning.css`
- Read: `packages/ui/src/app/components/ui/SecurityWarning.tsx`
- Modify: `packages/ui/src/app/components/ui/SecurityWarning.tsx`
- Delete: `packages/ui/src/app/components/ui/SecurityWarning.css`

- [ ] **Step 1: Read current files.**
- [ ] **Step 2: Translate classes in JSX + remove CSS import** (per **Migration Recipe**).
- [ ] **Step 3: Delete the CSS file.**
- [ ] **Step 4: Verify** — `bun run check && bun run typecheck && bun test` must pass.
- [ ] **Step 5: Visual check** — trigger the security warning state in dev; toggle dark theme.
- [ ] **Step 6: Commit** — `git add packages/ui/src/app/components/ui/SecurityWarning* && git commit -m "refactor(ui): migrate SecurityWarning to Tailwind"`.

---

### Task 35: Migrate Onboarding

**Files:**
- Read: `packages/ui/src/app/components/ui/Onboarding.css`
- Read: `packages/ui/src/app/components/ui/Onboarding.tsx`
- Modify: `packages/ui/src/app/components/ui/Onboarding.tsx`
- Delete: `packages/ui/src/app/components/ui/Onboarding.css`

- [ ] **Step 1: Read current files.**
- [ ] **Step 2: Translate classes in JSX + remove CSS import** (per **Migration Recipe**).
- [ ] **Step 3: Delete the CSS file.**
- [ ] **Step 4: Verify** — `bun run check && bun run typecheck && bun test` must pass.
- [ ] **Step 5: Visual check** — clear onboarding state (or simulate first run) to see the flow; step through each screen; toggle dark theme.
- [ ] **Step 6: Commit** — `git add packages/ui/src/app/components/ui/Onboarding* && git commit -m "refactor(ui): migrate Onboarding to Tailwind"`.

---

### Task 36: Migrate SettingsView

**Files:**
- Read: `packages/ui/src/app/components/settings/SettingsView.css`
- Read: `packages/ui/src/app/components/settings/SettingsView.tsx` (and any sub-components in the settings dir)
- Modify: `packages/ui/src/app/components/settings/SettingsView.tsx` (+ subs)
- Delete: `packages/ui/src/app/components/settings/SettingsView.css`

- [ ] **Step 1: Read current files, including any settings sub-components that reference the same CSS classes.**
- [ ] **Step 2: Translate classes in JSX + remove CSS import** (per **Migration Recipe**).
- [ ] **Step 3: Delete the CSS file.**
- [ ] **Step 4: Verify** — `bun run check && bun run typecheck && bun test` must pass.
- [ ] **Step 5: Visual check** — open Settings; navigate every section (theme, font size, etc.); change values; toggle dark theme.
- [ ] **Step 6: Commit** — `git add packages/ui/src/app/components/settings/ && git commit -m "refactor(ui): migrate SettingsView to Tailwind"`.

---

### Task 37: Migrate App.css (frame, last)

**Files:**
- Read: `packages/ui/src/app/App.css`
- Read: `packages/ui/src/app/App.tsx` (and Sidebar / Header / MainContent / any components still using global classes from App.css)
- Modify: `packages/ui/src/app/App.tsx` + any components referencing App.css classes
- Delete: `packages/ui/src/app/App.css`

- [ ] **Step 1: Read `App.css` and identify every class it defines. Then grep for each class across `packages/ui/src/app/**` to find all usages.**

Run:
```bash
rg "className" packages/ui/src/app --type tsx
```
List every `className` string that references classes from `App.css`.

- [ ] **Step 2: Translate classes to Tailwind utilities in every consuming file.**

Important: `App.css` holds the overall frame (layout, sidebar, header, main-content) and may use `var(--sidebar-width)` / `var(--header-height)` — these map to `w-sidebar` / `h-header`.

- [ ] **Step 3: Delete `App.css` and remove its import from `App.tsx`.**

- [ ] **Step 4: Verify** — `bun run check && bun run typecheck && bun test` must pass.

- [ ] **Step 5: Visual check** — `bun run dev:desktop`; confirm the entire app shell (sidebar, header, main content, responsive sidebar toggle) looks correct; toggle dark theme.

- [ ] **Step 6: Commit** — `git add packages/ui/src/app/ && git commit -m "refactor(ui): migrate App.css frame to Tailwind"`.

---

# Phase 4 — Cleanup (Task 38)

### Task 38: Delete `tokens.css` and verify completion

**Files:**
- Delete: `packages/design-system/src/globals/tokens.css`
- Modify: `packages/design-system/src/globals/index.ts`

- [ ] **Step 1: Verify zero `.module.css` files remain**

Run:
```bash
find packages -name "*.module.css"
```
Expected: empty output.

- [ ] **Step 2: Verify zero plain `.css` files remain in `packages/ui/src/app/`**

Run:
```bash
find packages/ui/src/app -name "*.css"
```
Expected: empty output.

- [ ] **Step 3: Verify no legacy token references remain anywhere in the codebase**

The only legitimate surviving `var(--…)` token is `--font-size-base`, which is user-runtime-mutable and kept as a CSS custom property. All other tokens should be gone.

Run:
```bash
rg "var\(--(bg|text|border|role|accent|shadow|sidebar-width|header-height|plan|impl|tree-line|highlight|error|success|font-body|font-mono)" packages/
```
Expected: empty output.

Then verify `--font-size-base` IS still used (sanity check):
```bash
rg "var\(--font-size-base\)" packages/
```
Expected: exactly one match in `packages/design-system/src/globals/reset.css`.

- [ ] **Step 4: If Step 3 found matches, fix them and re-run.**

Any remaining `var(--…)` references (other than `--font-size-base`) mean a component was missed or a token rename was incomplete. Re-open the relevant task.

- [ ] **Step 5: Delete `tokens.css`**

Run:
```bash
rm packages/design-system/src/globals/tokens.css
```

- [ ] **Step 6: Remove the `tokens.css` import from `globals/index.ts`**

Replace the contents of `packages/design-system/src/globals/index.ts` with:

```ts
import "./tailwind.css";
import "./reset.css";
import "./fonts.ts";
```

- [ ] **Step 7: Drop any tokens from `@theme` that turned out unused**

For each token defined in `tailwind.css`'s `@theme` block, grep the codebase to confirm it is used:

```bash
# For each token name (e.g., color-plan-subtle), search for usage in className strings:
rg "(bg|text|border)-plan-subtle" packages/
```

Delete tokens with zero usages from both the light `@theme` block and the `[data-theme="dark"]` override block in `tailwind.css`.

- [ ] **Step 8: Final verification**

Run:
```bash
bun run check && bun run typecheck && bun test
```
Expected: all pass.

Run:
```bash
bun run build
```
Expected: build completes successfully.

Run:
```bash
bun run dev:desktop
```
Expected: the Electrobun app starts, renders correctly in light mode, toggles to dark mode correctly, and every previously-migrated view renders without regression.

- [ ] **Step 9: Commit**

```bash
git add packages/design-system/src/globals/
git commit -m "refactor(design-system): remove tokens.css; tailwind is single source of truth"
```

---

## Post-Completion

After Task 38, verify the completion criteria from the spec are all met:

- [ ] Zero `.module.css` files in `packages/*/src/**`
- [ ] Zero `.css` files in `packages/ui/src/app/**`
- [ ] `tokens.css` deleted
- [ ] No legacy `var(--…)` token references remain
- [ ] `tailwind.css` is the single source of truth
- [ ] `bun run check && bun run typecheck && bun test` pass
- [ ] `bun run build` produces a working app
- [ ] Both light and dark themes render correctly in `bun run dev:desktop` and Storybook
