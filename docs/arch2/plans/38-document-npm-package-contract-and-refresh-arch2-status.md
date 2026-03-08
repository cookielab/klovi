# 38 Document npm Package Contract And Refresh Arch2 Status

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add npm-facing package documentation and refresh Arch2 status documents so they describe the implemented publish path and public npm contract accurately after Plans 35-37 land.

**Architecture:** The repository root README currently emphasizes desktop/Homebrew usage, while the staged npm artifact copies repository documentation into the publish output. Once the public package contract and release wiring are aligned, documentation must catch up: `apps/package` needs its own npm-focused README, staging must prefer that README, and the Arch2 status documents must stop claiming Plans 31-34 are still the open work.

**Depends on:** Plans 35, 36, and 37

---

## In scope

- Add an npm-facing `apps/package/README.md`
- Make staging prefer the package README for npm publishes
- Document `npx` and `bunx` usage of `@cookielab.io/klovi`
- Document the public `@cookielab.io/klovi/server` contract and `startKloviServer(options)` export
- Refresh Arch2 status docs and root docs so they no longer describe Plans 31-34 as still open

## Out of scope

- Rewriting the whole project documentation set
- Changing the actual npm/runtime contract beyond the work completed in Plans 35-37
- Creating separate docs websites or generated documentation pipelines
- Desktop product documentation unrelated to the npm/browser-served distribution

## Files/directories to create or change

- `apps/package/README.md`
- `apps/package/scripts/stage-npm.ts`
- `README.md`
- `docs/arch2/VISION.md`
- `docs/arch2/README.md`

## Implementation steps

1. **Create the npm-facing package README.**
   - Add `apps/package/README.md` as the source of truth for the npm package publish artifact.
   - Document:
     - `npx @cookielab.io/klovi`
     - `bunx @cookielab.io/klovi`
     - localhost-only default behavior
     - key environment variables that remain part of the contract
     - the public `@cookielab.io/klovi/server` import with `startKloviServer(options)`
   - Keep the README focused on package consumers rather than workspace contributors.

2. **Make staging prefer the package README.**
   - Update `apps/package/scripts/stage-npm.ts` so staging uses `apps/package/README.md` when present.
   - Keep the fallback to the repository root README only if the package README is absent.

3. **Refresh the root README.**
   - Add or update a short npm/browser-served usage section so the repository landing page reflects both desktop and npm distributions.
   - Keep development and desktop guidance intact.

4. **Refresh Arch2 status documents.**
   - Update `docs/arch2/VISION.md` so its current-state section reflects that the staged artifact flow, sanitized manifest flow, packed-artifact verification, and npm publish workflow now exist.
   - Update `docs/arch2/README.md` so plans 31-34 are no longer presented as the sole remaining open publish work.
   - Add a short completed/follow-up alignment framing so plans 35-37 are clearly understood as contract-alignment/documentation cleanup rather than unfinished core publish remediation.

5. **Make the documentation internally consistent.**
   - Ensure the public export name is documented consistently as `startKloviServer`.
   - Ensure npm publish documentation consistently points to the staged artifact flow and single-package publish model.
   - Ensure the docs do not still imply that internal workspace packages are published separately.

## Acceptance criteria

- `apps/package/README.md` exists and is suitable for npm consumers
- Staging prefers `apps/package/README.md` for the publish artifact
- The root README documents npm/browser-served usage alongside desktop usage
- `docs/arch2/VISION.md` and `docs/arch2/README.md` no longer claim Plans 31-34 are still the remaining open work
- npm usage, public server export, and Arch2 status are described consistently across docs

## Verification

- `bun run check`
- `bun run typecheck`
- `bun test`
- `bun run stage:npm`
- Inspect the staged artifact and confirm it contains the package README
- Review `README.md`, `docs/arch2/VISION.md`, and `docs/arch2/README.md` for consistent `npx`/`bunx` usage and `@cookielab.io/klovi/server` documentation
