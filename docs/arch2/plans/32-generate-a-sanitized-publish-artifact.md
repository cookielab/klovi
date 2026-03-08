# 32 Generate A Sanitized Publish Artifact

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Generate a staged publish artifact for `@cookielab.io/klovi` with a sanitized npm-ready manifest instead of using the workspace `apps/package/package.json` directly for npm publishing.

**Architecture:** Workspace manifests should stay optimized for Bun monorepo development. Publishing must stage a separate artifact directory containing the runnable runtime files plus an npm-safe `package.json` with no `workspace:*` dependencies and no references to private internal packages.

**Depends on:** Plan 31

---

## In scope

- Define the exact staged publish directory
- Generate a sanitized `package.json` for npm
- Copy the runtime files and metadata needed for publish
- Encode version and commit stamping rules for the staged artifact
- Define the single source directory used by `npm pack`, `bun pm pack`, and publish

## Out of scope

- CI publish workflow wiring
- Release policy and version bump policy
- Publishing internal workspace packages

## Files/directories to create or change

- `apps/package/` build or staging scripts
- `apps/package/package.json`
- Any helper scripts used to generate the staged manifest
- Root build scripts if needed

## Staged artifact decision

Use this exact staging directory:

`apps/package/.stage/npm`

Expected staged layout:

```text
apps/package/.stage/npm/
  package.json
  README.md
  LICENSE.md
  dist/
    cli.js
    server.js
    web/**
```

This directory is a build artifact, not a cache.

## Implementation steps

1. **Build runtime output first.**
   - Produce the self-contained runtime files required by Plan 31.

2. **Create the staging directory.**
   - Remove and recreate `apps/package/.stage/npm` on each publish build.
   - Do not reuse stale staged content between runs.

3. **Generate the sanitized manifest.**
   - Start from `apps/package/package.json` as input metadata.
   - Write a staged `package.json` into `apps/package/.stage/npm/package.json`.
   - Keep only publish-relevant fields:
     - `name`
     - `version`
     - `description`
     - `type`
     - `license`
     - `author`
     - `repository`
     - `homepage`
     - `bugs`
     - `bin`
     - `exports`
     - `files`
     - `engines`
     - `keywords` if present
     - `dependencies`
   - Remove:
     - `workspace:*` dependencies
     - references to private internal packages
     - development-only scripts
     - monorepo-only metadata that is not part of the public package

4. **Set exact staged manifest fields.**
   - `name`: `@cookielab.io/klovi`
   - `bin.klovi`: `./dist/cli.js`
   - `exports["./server"]`: `./dist/server.js`
   - `files`: `["dist", "package.json", "README.md", "LICENSE.md"]`

5. **Copy staged metadata files.**
   - Copy repository `README.md` or package-specific README, whichever is chosen as the public npm README, into the staging directory.
   - Copy `LICENSE.md` into the staging directory.
   - The implementation should standardize on one source of truth and document it in code comments if non-obvious.

6. **Stamp version and commit.**
   - Version in the staged manifest comes from the release/tag input or explicit staging command input.
   - Commit stamping for runtime display stays embedded into the built runtime files, not as a custom public manifest field unless already required by release tooling.

7. **Publish only from the staged directory.**
   - `npm pack`, `bun pm pack`, and npm publish must all run from `apps/package/.stage/npm`.

## Acceptance criteria

- `npm pack` succeeds from `apps/package/.stage/npm`
- `bun pm pack` succeeds from `apps/package/.stage/npm`
- Unpacked tarball is installable outside the monorepo
- Staged `package.json` has no `workspace:*` dependencies
- Staged `package.json` has no references to internal private workspace packages
- File layout matches the intended public contract

## Verification

- `bun run check`
- `bun run typecheck`
- `bun test`
- Build and inspect `apps/package/.stage/npm/package.json`
- Run `npm pack` from `apps/package/.stage/npm`
- Run `bun pm pack` from `apps/package/.stage/npm`
