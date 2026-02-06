---
name: verify
description: Run lint, typecheck, and tests to verify code quality. Use AUTOMATICALLY after every code contribution — do not wait for the user to ask.
allowed-tools: Bash(bun run check*), Bash(bun run typecheck*), Bash(bun test*)
---

# Verify Skill

Run all quality checks after every code change. This skill should be invoked **automatically** after making any code contribution — never skip it.

## Commands

Run all three checks in parallel:

1. `bun run check` — Biome lint + format
2. `bun run typecheck` — TypeScript type checking (`tsc --noEmit`)
3. `bun test` — Unit tests

## Process

1. Run all three commands in parallel
2. If any check fails:
   - Fix the issues
   - Re-run the failing check(s) to confirm the fix
   - Repeat until all checks pass
3. Report the results to the user

## Auto-fix

- For Biome lint/format issues, run `bun run check:fix` first, then re-check
- For TypeScript errors, fix the source code manually
- For test failures, investigate and fix the root cause

## Rules

- NEVER skip verification after a code change
- NEVER tell the user "everything looks good" without actually running the checks
- Fix all new errors you introduced — pre-existing warnings are acceptable
- Run checks from the project root: `/Users/vrtak-cz/Workspace/Cookielab/CCvie`
