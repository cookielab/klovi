# New Desktop Release Plan Follow-Up 3

## Objective

Fix the new blocker introduced by the previous follow-up implementation: the desktop build entrypoint no longer works through the same command path the release workflow uses.

This follow-up is complete only when all of the following are true:

- `bun run build -- --env=stable` works from the repository root
- `bun run build -- --env=candidate` works from the repository root
- `bun run build -- --env=beta` works from the repository root
- the same three commands also work from `apps/desktop`
- those builds produce the expected `stable-*`, `candidate-*`, and `beta-*` build and artifact folders
- the release workflow can keep using `bun run build -- --env="$BUILD_ENV"` without any special-case wrapper logic

## Current Blocking Failure

The current implementation changed [apps/desktop/package.json](/Users/vrtak-cz/Workspace/Cookielab/Klovi/apps/desktop/package.json) to run:

- `bun node_modules/electrobun/src/cli/index.ts dev`
- `bun node_modules/electrobun/src/cli/index.ts build`

That entrypoint is not runnable in the published Electrobun package used by this repo. The package does not ship the full source tree required by `src/cli/index.ts`, so the real workflow build command now fails immediately with a module-resolution error instead of producing release artifacts.

Observed failure from the real workflow path:

```text
Cannot find module '../shared/platform' from '.../electrobun/src/cli/index.ts'
```

This means the current branch still does not satisfy the release plan, even though `bun run check`, `bun run typecheck`, and `bun test` pass.

## Chosen Approach

- Do not keep pointing the desktop scripts at `node_modules/electrobun/src/cli/index.ts`.
- Do not rely on the published Electrobun package source tree being executable as-is.
- Create a repo-controlled, self-contained Electrobun CLI entrypoint for Klovi release builds and dev builds.
- Keep using the published Electrobun package for its runtime binaries and packaged resources under `dist-*` and `dist/api/*`.
- Preserve the previously implemented release semantics in that self-contained CLI path:
  - arbitrary non-empty `--env`
  - `app.includeReleaseChannelInName`
  - current `process.execPath` fixes already carried in the package patch

## Required Changes

### 1. Replace the broken desktop script entrypoint

Update [apps/desktop/package.json](/Users/vrtak-cz/Workspace/Cookielab/Klovi/apps/desktop/package.json) so the `dev` and `build` scripts no longer invoke the published package's incomplete `src/cli/index.ts`.

Use a repo-owned entrypoint instead, for example:

- `apps/desktop/vendor/electrobun-cli/index.ts`

That entrypoint must be self-contained and runnable by Bun in this repository without depending on missing files from the published Electrobun source tree.

### 2. Vendor the minimum Electrobun CLI surface needed for Klovi

Add a repo-controlled copy of the Electrobun CLI code required for Klovi builds.

The vendored CLI must include the patched behavior already needed by this project:

- support arbitrary non-empty `--env` values such as `beta` and `candidate`
- respect `app.includeReleaseChannelInName`
- preserve the current artifact prefix behavior based on channel/platform/arch
- keep Klovi's release builds on stable app identity naming while still emitting channel-specific updater metadata

Do not vendor unrelated Electrobun runtime binaries. Keep using the package-provided `dist-*` assets already downloaded by the dependency.

### 3. Keep the vendored CLI aligned with the current package layout

The vendored CLI must still resolve Electrobun package assets from the installed dependency tree:

- `dist-*` platform directories
- `dist/api/*` runtime modules
- packaged templates and other non-source assets the build process depends on

The vendored CLI should treat the installed Electrobun dependency as a resource bundle, not as the source of executable CLI logic.

### 4. Remove the assumption that repo checks are enough

Add explicit release-build smoke verification to the implementation workflow.

After the build entrypoint is fixed, the implementation must verify all of the following locally:

```sh
bun run build -- --env=stable
bun run build -- --env=candidate
bun run build -- --env=beta
cd apps/desktop && bun run build -- --env=stable
cd apps/desktop && bun run build -- --env=candidate
cd apps/desktop && bun run build -- --env=beta
```

For each successful build, verify:

- the expected build folder exists
- the expected artifacts folder entries exist
- non-dev builds keep stable app base names such as `Klovi.app` and `Klovi.tar.zst`
- channel-specific naming remains only in build folder names, artifact prefixes, and updater metadata

### 5. Re-run the previous release-overhaul verification only after builds work

Once the real build entrypoint works again, re-run the release checks from the previous follow-ups:

- AppImage packaging path
- updater usable-release selection
- `update.json` exact validation
- release asset naming contract
- single installed app identity across channels

Do not treat those areas as re-verified until the actual build commands above pass.

## Acceptance Criteria

This follow-up is complete only when:

- the root build command used by [release-desktop.yml](/Users/vrtak-cz/Workspace/Cookielab/Klovi/.github/workflows/release-desktop.yml) works for `stable`, `candidate`, and `beta`
- the `apps/desktop` build command works for `stable`, `candidate`, and `beta`
- the build path no longer throws missing-module errors from Electrobun package internals
- the previous release-overhaul fixes still hold after the build entrypoint is repaired
- `bun run check`, `bun run typecheck`, and `bun test` still pass

## Non-Goals

- no revert of the release-overhaul design back to old asset types
- no migration to Electrobun's stock runtime updater
- no delta patch support
- no alternative artifact hosting beyond GitHub Releases
