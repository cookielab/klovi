# New Desktop Release Plan Follow-Up 5

## Objective

Address the remaining release-pipeline issues after the channel-only semantics
clarification.

This follow-up is complete only when:

- the top-level release workflow can call the desktop release workflow without
  an invalid interface mismatch
- `stable`, `candidate`, and `beta` are implemented strictly as update-filter
  rules
- release filtering no longer depends on GitHub's mutable `prerelease` flag for
  correctness
- no required compatibility layer is removed prematurely

## Confirmed Remaining Issues

### 1. Workflow-call interface mismatch

[.github/workflows/release.yml](/Users/vrtak-cz/Workspace/Cookielab/Klovi/.github/workflows/release.yml)
still calls
[.github/workflows/release-desktop.yml](/Users/vrtak-cz/Workspace/Cookielab/Klovi/.github/workflows/release-desktop.yml)
with:

- `version`
- `prerelease`

But the called workflow currently declares only:

- `version`

That mismatch should be treated as a release blocker. The desktop workflow does
not need a separate `prerelease` input because it already derives `build_env`
from the version tag.

### 2. Updater filtering still partially depends on GitHub release flags

[apps/desktop/src/bun/updater.ts](/Users/vrtak-cz/Workspace/Cookielab/Klovi/apps/desktop/src/bun/updater.ts)
still uses `release.prerelease` inside `filterReleasesByChannel()`.

That is weaker than the product requirement. The intended behavior is based on
the version tag shape:

- stable users ignore `-beta.N` and `-rc.N`
- candidate users ignore `-beta.N` but accept `-rc.N`
- beta users accept `-beta.N`, `-rc.N`, and stable releases

If a GitHub release is tagged correctly but marked with the wrong prerelease
flag, the current implementation can still make the wrong update decision.

The filter logic should be derived from `tag_name`, not from mutable GitHub UI
metadata.

## Compatibility Layer Assessment

The following files are still required and should not be removed in this
follow-up:

- [patches/electrobun@1.15.1.patch](/Users/vrtak-cz/Workspace/Cookielab/Klovi/patches/electrobun@1.15.1.patch)
- [apps/desktop/vendor/electrobun-cli/index.ts](/Users/vrtak-cz/Workspace/Cookielab/Klovi/apps/desktop/vendor/electrobun-cli/index.ts)
- [apps/desktop/scripts/package-appimage.ts](/Users/vrtak-cz/Workspace/Cookielab/Klovi/apps/desktop/scripts/package-appimage.ts)

### Why the Electrobun patch is still required

The patch still carries behavior that the project depends on:

- arbitrary non-empty `--env` values such as `beta` and `candidate`
- `app.includeReleaseChannelInName`
- `process.execPath` fixes used by installed app/runtime paths

Removing the patch would revert required behavior.

### Why the vendor CLI shim is still required

The published Electrobun package still does not provide a clean direct path for
Klovi's patched source CLI usage:

- the package `bin/electrobun.cjs` downloads and executes a prebuilt external
  CLI binary, which bypasses the patched source path
- the source CLI import path still depends on files that are not shipped in the
  package layout without local bridging
- the current shim creates the missing `src/shared` bridge and the
  `src/cli/templates/embedded.ts` stub before delegating to the patched CLI

The shim may be simplified in the future only if the patch absorbs that bridging
work or Electrobun changes its published package layout.

### Why the AppImage script is still required

The release workflow still depends on a repo-owned conversion step from
Electrobun's normalized Linux tarball to the required user-facing AppImage
assets. There is no equivalent built-in step elsewhere in the repo.

## Required Changes

### 1. Fix the release workflow interface

Update
[.github/workflows/release.yml](/Users/vrtak-cz/Workspace/Cookielab/Klovi/.github/workflows/release.yml)
so the `desktop` workflow call passes only supported inputs.

Preferred fix:

- remove the unused `prerelease` input from the `with:` block entirely

Do not add a dead `prerelease` input to
[.github/workflows/release-desktop.yml](/Users/vrtak-cz/Workspace/Cookielab/Klovi/.github/workflows/release-desktop.yml)
just to satisfy the caller. The desktop workflow already derives the necessary
channel/build behavior from the version tag.

### 2. Make update filtering tag-driven

Update
[apps/desktop/src/bun/updater.ts](/Users/vrtak-cz/Workspace/Cookielab/Klovi/apps/desktop/src/bun/updater.ts)
so `filterReleasesByChannel()` classifies releases from `tag_name` instead of
from `release.prerelease`.

Use these rules:

- `stable`: only tags without `-beta.` and without `-rc.`
- `candidate`: only tags without `-beta.`
- `beta`: allow stable, rc, and beta tags

Keep excluding drafts.

If needed, add a small helper that classifies a release tag into:

- `stable`
- `candidate`
- `beta`
- invalid/unknown

The updater should ignore invalid or malformed tags rather than guessing.

### 3. Expand tests around incorrect GitHub release flags

Update
[apps/desktop/src/bun/updater.test.ts](/Users/vrtak-cz/Workspace/Cookielab/Klovi/apps/desktop/src/bun/updater.test.ts)
to cover cases where GitHub `prerelease` does not match the tag suffix.

Required scenarios:

- a `1.2.3-beta.1` release marked `prerelease: false` must still be excluded
  from `stable`
- a `1.2.3-rc.1` release marked `prerelease: false` must still be excluded from
  `stable`
- a `1.2.3-beta.1` release marked `prerelease: false` must still be excluded
  from `candidate`
- a `1.2.3-rc.1` release marked `prerelease: true` must still be accepted by
  `candidate`
- stable releases should still be accepted even if GitHub metadata is odd,
  provided the tag itself is stable

### 4. Leave the required compatibility layers in place

Do not remove:

- the Electrobun patch
- the vendor CLI shim
- the AppImage packaging script

This follow-up is for correctness and cleanup of the release contract, not for
premature deletion of still-required compatibility code.

## Verification

The future implementation must verify all of the following:

- `bun run check`
- `bun run typecheck`
- `bun test`
- static review of the workflow-call contract between
  [release.yml](/Users/vrtak-cz/Workspace/Cookielab/Klovi/.github/workflows/release.yml)
  and
  [release-desktop.yml](/Users/vrtak-cz/Workspace/Cookielab/Klovi/.github/workflows/release-desktop.yml)
- updater unit tests prove channel selection is driven by tag suffixes even when
  GitHub `prerelease` metadata is wrong

## Acceptance Criteria

- the desktop release workflow is called with only supported inputs
- release channel behavior is implemented as tag-based update filtering only
- stable users cannot receive beta or rc releases due to incorrect GitHub
  `prerelease` flags
- candidate users can receive rc releases regardless of GitHub `prerelease`
  drift
- no required Electrobun compatibility layer is removed

## Non-Goals

- removing `stable`, `candidate`, or `beta` from settings
- replacing the current GitHub Releases storage model
- removing the Electrobun patch, vendor CLI shim, or AppImage script in this
  follow-up
