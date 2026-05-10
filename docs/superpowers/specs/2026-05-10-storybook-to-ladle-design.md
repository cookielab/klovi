# Storybook → Ladle migration

**Date:** 2026-05-10
**Status:** Approved (in-flight)

Replace Storybook 10 with [`@ladle/react`](https://ladle.dev) in `packages/design-system`. Full migration: idiomatic Ladle stories using knob hooks, idiomatic Ladle config, all Storybook traces removed. No transitional shims.

## Goals

- Remove every `@storybook/*` and `storybook` dependency.
- Rewrite all 9 `.stories.tsx` files to idiomatic Ladle (typed `Story` functions + knob hooks where stories were previously controllable).
- Preserve the existing per-story experience: showcase stories (`AllVariants`, `AllRoles`, etc.) stay as fixed renders; previously-`args`-driven stories become knob-driven so the controls UX is preserved.
- Keep light/dark theme switching working in the Ladle UI by binding Ladle's built-in theme toggle to the existing `data-theme` attribute on `<html>`.
- Provide both a dev server (`bun run ladle`) and a static build (`bun run ladle:build`).
- Keep Tailwind v4 working in the dev/build pipeline.

## Non-goals

- No changes to `packages/design-system` source components or types — only `*.stories.tsx`, the `.storybook → .ladle` config swap, and `package.json`.
- No rewrite of historical specs/plans (`docs/superpowers/specs/2026-04-05-tailwind-migration-design.md`, `docs/superpowers/plans/2026-04-05-tailwind-migration.md`); those are records of past work.
- No CI changes (no existing CI step builds Storybook).
- No new visual-regression tooling.

## Architecture

```
packages/design-system/
├── .ladle/
│   ├── config.mjs           # stories glob, port, defaultStory
│   ├── components.tsx       # GlobalProvider: imports `../src/globals`,
│   │                        #   syncs Ladle theme → document.documentElement[data-theme]
│   └── vite.config.ts       # @tailwindcss/vite plugin
├── src/
│   └── stories/
│       ├── *.stories.tsx    # rewritten in idiomatic Ladle
└── package.json             # @ladle/react added; storybook* removed
```

- **Stories glob:** `src/stories/**/*.stories.tsx` (unchanged).
- **Static build output:** `packages/design-system/build/` (Ladle's default; matches existing `.gitignore` `build` rule).
- **Tailwind:** wired via `packages/design-system/vite.config.ts` (Vite's default discovery location) with `tailwindcss()` plugin. Ladle picks it up automatically.
- **Spurious `vite-tsconfig-paths` plugin:** Ladle 5 auto-injects `vite-tsconfig-paths` even when there are no path aliases. The injected plugin emits a confusing parse-error warning at boot. The fix is a noop sentinel plugin in `vite.config.ts` (`{ name: "vite:tsconfig-paths" }`); Ladle detects it by name and skips its own injection.

## Story rewrite strategy

Ladle stories are **typed React function components** (not `StoryObj` objects). Args + argTypes are attached as properties on the function — Ladle does not have separate knob hooks; the `args`/`argTypes` mechanism is the controls system.

**Default export (Storybook `meta` → Ladle `StoryDefault`):**

```ts
// before
export const meta: Meta<typeof Button> = { title: "Components/Button", component: Button };
// after
export default { title: "Components/Button" } satisfies StoryDefault<ButtonProps>;
```

(`component` doesn't exist in Ladle — `title` controls the sidebar tree.)

**Showcase story (Storybook `render`-only, e.g. `AllVariants`, `AllRoles`, `Multiple`, `ColorPalette`):**

```tsx
// before
export const AllVariants: Story = { render: () => <div>...</div> };
// after
export const AllVariants: Story = () => <div>...</div>;
```

A plain typed function — no args.

**Args-driven story (Storybook `args: {...}` → Ladle args + argTypes):**

```tsx
// before
export const Primary: Story = {
  args: { variant: "primary", children: "Primary Button" },
};
// after
export const Primary: Story<ButtonProps> = (props) => <Button {...props} />;
Primary.args = { variant: "primary", children: "Primary Button" };
Primary.argTypes = {
  variant: { options: ["default", "primary"], control: { type: "select" }, defaultValue: "primary" },
  size:    { options: ["md", "sm"],          control: { type: "select" }, defaultValue: "md" },
  icon:    { control: { type: "boolean" },   defaultValue: false },
};
```

The original Storybook `args` become `args` on the function; argTypes describe the control widgets.

**Interactive demo (already a function with `useState`, e.g. `ModalDemo`, `ToggleDemo`):**

The inner demo component stays unchanged. The story export becomes:

```tsx
export const Interactive: Story = () => <ModalDemo />;
```

## Theme integration

Ladle ships a built-in theme toggle (light/dark/auto) in its toolbar; we bind that to `data-theme`.

`.ladle/components.tsx`:

```tsx
import type { GlobalProvider } from "@ladle/react";
import { useLadleContext } from "@ladle/react";
import { useEffect } from "react";
import "../src/globals/index.ts";

export const Provider: GlobalProvider = ({ children, globalState }) => {
  useEffect(() => {
    const resolved =
      globalState.theme === "auto"
        ? matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
        : globalState.theme;
    document.documentElement.dataset["theme"] = resolved;
  }, [globalState.theme]);
  return <>{children}</>;
};
```

This replaces Storybook's `globalTypes.theme` toolbar toggle.

## Scripts

Root `package.json`:

```jsonc
"ladle":       "bun run --filter @cookielab.io/klovi-design-system ladle",
"ladle:build": "bun run --filter @cookielab.io/klovi-design-system ladle:build"
```

(`storybook` script removed.)

`packages/design-system/package.json`:

```jsonc
"ladle":       "ladle serve --port 6006",
"ladle:build": "ladle build"
```

Port kept at 6006 to preserve muscle memory.

## Dependency changes

**Add (devDependencies in `packages/design-system`):**
- `@ladle/react`
- `vite` (declared explicitly so `vite.config.ts`'s `import { defineConfig } from "vite"` satisfies `noUndeclaredDependencies`)

**Remove (devDependencies in `packages/design-system`):**
- `@storybook/react`
- `@storybook/react-vite`
- `storybook`

## Patch: `@cookielab.io/typescript-config`

`@cookielab.io/typescript-config@0.1.0`'s shipped `dist/tsconfig.json` includes literal `null` values for several rebase-able compiler options (`rootDir`, `rootDirs`, `typeRoots`, `paths`, etc.). Vite 6's bundled `tsconfck` calls `path.isAbsolute(null)` while resolving the `extends` chain and crashes during `ladle build`'s esbuild transform step.

`tsc` itself tolerates the null values (so `bun run typecheck` always worked). The fix is a `bun patch` against the dependency that strips the `null` keys; `null` is semantically equivalent to "absent" for these options. The patch lives at `patches/@cookielab.io%2Ftypescript-config@0.1.0.patch` and is referenced via root `package.json`'s `patchedDependencies`.

## Biome overrides

Three Ladle-required patterns conflict with the project's Biome rules. Added overrides in `packages/design-system/biome.json`:

- `vite.config.ts`, `.ladle/config.mjs` — `style/noDefaultExport` off (Vite/Ladle require default exports).
- `src/stories/**/*.stories.tsx` — `style/noDefaultExport`, `style/useComponentExportOnlyModules`, `style/useExportsLast` off (stories export both a default `StoryDefault` object and named `Story` components, with `args`/`argTypes` attached as properties between them).

## Verification

After all changes:

1. `bun install`
2. `bun run lint` — must pass
3. `bun run typecheck` — must pass
4. `bun test` — must pass
5. `bun run ladle` — boots, sidebar lists all components, light/dark toggle flips `data-theme`, knob controls work
6. `bun run ladle:build` — produces `packages/design-system/build/` static output without errors

## Out-of-scope follow-ups

- Adding visual-regression snapshots (Ladle supports this but is out of scope here).
- Publishing the static build site.
- Adding an MSW or theming addon beyond the existing light/dark toggle.
