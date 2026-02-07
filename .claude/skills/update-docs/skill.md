# update-docs

Review and update project documentation after code changes.

## When to use

Run after feature additions, significant modifications, or when documentation may have drifted from the codebase.

## Process

1. **Identify what changed** — check `git diff` or recent work context to understand what was added/modified
2. **Check each doc file** against the current codebase:
   - `README.md` — API endpoints, scripts, features list, quick start
   - `docs/architecture.md` — project structure tree, server routes, frontend routes, component hierarchy, localStorage keys
   - `docs/components.md` — component props, hooks, tool summary mapping table
   - `docs/testing.md` — test count (run `bun test`), test files table
   - `CONTENT_TYPES.md` — tool rendering status, priority lists
3. **Update outdated sections** — edit only what needs changing, keep the existing style
4. **Run `/verify`** afterward to ensure no accidental breakage

## What to check per doc file

### README.md
- API table matches routes in `index.ts`
- Scripts table matches `package.json` scripts
- Features section covers all user-facing functionality
- Quick start is accurate

### docs/architecture.md
- Project structure tree matches actual `src/` file layout
- Server routes table matches `Bun.serve()` routes in `index.ts`
- Frontend router table matches hash parsing in `App.tsx`
- Component hierarchy reflects actual component tree
- localStorage keys are all listed

### docs/components.md
- All components in `src/frontend/components/` are documented
- All hooks in `src/frontend/hooks/` are documented
- Tool summary mapping table matches `getToolSummary()` in `ToolCall.tsx`
- Component props match actual interfaces

### docs/testing.md
- Test count matches `bun test` output
- Test files table lists all `*.test.ts` / `*.test.tsx` files

### CONTENT_TYPES.md
- Tool status reflects actual `SUMMARY_EXTRACTORS` in `ToolCall.tsx`
- Priority/opportunity lists are up to date
