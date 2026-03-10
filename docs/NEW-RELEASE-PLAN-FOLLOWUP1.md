# New Desktop Release Plan Follow-Up 1

## Objective

Complete the desktop release overhaul that was only partially implemented.

The missing work must bring the desktop release pipeline to this final contract:

- macOS arm64: downloadable `.dmg`
- Windows amd64: downloadable `.exe`
- Linux amd64: downloadable `.AppImage`
- Linux arm64: downloadable `.AppImage`

The follow-up implementation must also ensure:

- prerelease desktop builds work for `beta` and `candidate`
- the installed desktop app keeps one stable identity across release channels
- updater metadata and updater bundles remain hosted only on GitHub Releases
- the settings release-channel selector continues to work as it does now
- updater selection requires valid `update.json` metadata
- Homebrew and old Linux packaging paths are removed

## Current Gaps

The current implementation is incomplete in five concrete ways:

1. Electrobun still rejects `--env=beta` and `--env=candidate`, so prerelease builds fall back to `dev`.
2. The stable cross-channel app identity patch was not added, so prerelease builds still imply separate app naming.
3. Linux release output is still `.tar.gz`, not `.AppImage`.
4. The Klovi updater still selects releases using only the tarball asset and does not validate `update.json`.
5. Homebrew and legacy Linux distribution files are still present.

This follow-up must fix those gaps without changing the intended desktop RPC or UI update contracts.

## Required Changes

### 1. Patch Electrobun build environment handling

Update [patches/electrobun@1.15.1.patch](/Users/vrtak-cz/Workspace/Cookielab/Klovi/patches/electrobun@1.15.1.patch) so Electrobun accepts arbitrary non-empty build environments instead of restricting `--env` to `dev`, `canary`, and `stable`.

Required outcome:

- `bun run build -- --env=beta` builds with `buildEnvironment = "beta"`
- `bun run build -- --env=candidate` builds with `buildEnvironment = "candidate"`
- `dev` remains the fallback only when no env is provided

The implementation must patch the Electrobun source that currently does this validation and regenerate the vendored patch cleanly.

### 2. Patch Electrobun naming to keep one installed app identity

Extend the same Electrobun patch with a new config field:

- `app.includeReleaseChannelInName?: boolean`
- default: `true`

When Klovi sets this field to `false` for non-dev builds:

- app/installable names remain stable as `Klovi`
- channel-specific naming remains only in platform prefixes, build folders, `version.json.channel`, and updater metadata
- stable, candidate, and beta releases target the same installed app identity
- current `process.execPath` / App Translocation fixes remain intact

The implementation must patch the naming layer used by Electrobun rather than trying to rename outputs later in the workflow.

### 3. Update desktop Electrobun config

Update [apps/desktop/electrobun.config.ts](/Users/vrtak-cz/Workspace/Cookielab/Klovi/apps/desktop/electrobun.config.ts) to enable the patched Electrobun behavior.

Required config changes:

- set `app.includeReleaseChannelInName = false`
- keep dev behavior unchanged
- configure Windows icon path
- configure Linux icon path
- set `release.generatePatch = false`
- keep runtime release hosting rooted in GitHub Releases rather than a fixed Electrobun base URL model

This config file should be the source of truth for release naming behavior, not the GitHub workflow.

### 4. Add Linux AppImage packaging

Create a Bun-based AppImage packaging script for future release builds, for example:

- [apps/desktop/scripts/package-appimage.ts](/Users/vrtak-cz/Workspace/Cookielab/Klovi/apps/desktop/scripts/package-appimage.ts)

The script must:

- consume Electrobun's normalized Linux tarball output
- build an AppDir from that tarball
- install launcher wrapper as `usr/bin/klovi`
- place desktop entry and icon in the AppDir
- invoke official `appimagetool` for the matching architecture
- rename the final artifact to:
  - `Klovi-${VERSION}-linux-amd64.AppImage`
  - `Klovi-${VERSION}-linux-arm64.AppImage`

The AppImage output must replace the current Linux `tar.gz` user-facing release assets.

### 5. Update the Klovi updater to require valid `update.json`

Update [apps/desktop/src/bun/updater.ts](/Users/vrtak-cz/Workspace/Cookielab/Klovi/apps/desktop/src/bun/updater.ts) so release selection requires both:

- the normalized updater tarball
- the matching `update.json`

Required behavior:

- preserve current `stable` / `candidate` / `beta` selection semantics
- continue using GitHub Releases discovery
- validate `update.json` before accepting a release
- reject releases with missing or mismatched metadata
- ignore user-facing installer assets during update selection
- continue using full-bundle downloads only
- keep current platform-specific apply logic unless required by the naming fix

The updater must skip an incomplete newer release and continue scanning for the newest valid release instead of failing immediately.

### 6. Expand updater tests

Update [apps/desktop/src/bun/updater.test.ts](/Users/vrtak-cz/Workspace/Cookielab/Klovi/apps/desktop/src/bun/updater.test.ts) to cover the missing release validation rules.

Required test coverage:

- `update.json` asset naming helper
- missing `update.json` causes a release to be rejected
- malformed `update.json` causes a release to be rejected
- mismatched `platform` or `arch` causes a release to be rejected
- updater skips incomplete newer releases and picks the newest valid one
- user-facing installer assets are ignored for updater selection

### 7. Rewrite the desktop workflow around the real artifact contract

Update [release-desktop.yml](/Users/vrtak-cz/Workspace/Cookielab/Klovi/.github/workflows/release-desktop.yml) so it matches the requested release contract exactly.

Keep:

- verification job
- macOS arm64 only
- Windows x64 only
- Linux x64 and arm64 matrix

Upload only:

- `Klovi-${VERSION}-macos-arm64.dmg`
- `Klovi-${VERSION}-windows-amd64.exe`
- `Klovi-${VERSION}-linux-amd64.AppImage`
- `Klovi-${VERSION}-linux-arm64.AppImage`
- `${BUILD_ENV}-macos-arm64-Klovi.app.tar.zst`
- `${BUILD_ENV}-macos-arm64-update.json`
- `${BUILD_ENV}-win-x64-Klovi.tar.zst`
- `${BUILD_ENV}-win-x64-update.json`
- `${BUILD_ENV}-linux-x64-Klovi.tar.zst`
- `${BUILD_ENV}-linux-x64-update.json`
- `${BUILD_ENV}-linux-arm64-Klovi.tar.zst`
- `${BUILD_ENV}-linux-arm64-update.json`

Remove:

- `prerelease` workflow inputs
- Homebrew cask job
- Homebrew-related comments and wording
- Windows installer zip assumptions
- Linux `tar.gz` installer upload logic

The Linux workflow must call the new AppImage packaging script instead of copying Electrobun's old Linux installer archive.

### 8. Remove legacy release and distribution paths

Delete the stale release/distribution files that are no longer part of the supported release model:

- [scripts/build-release.sh](/Users/vrtak-cz/Workspace/Cookielab/Klovi/scripts/build-release.sh)
- [apps/desktop/packaging/linux/nfpm.yaml](/Users/vrtak-cz/Workspace/Cookielab/Klovi/apps/desktop/packaging/linux/nfpm.yaml)
- [apps/desktop/packaging/linux/postinstall.sh](/Users/vrtak-cz/Workspace/Cookielab/Klovi/apps/desktop/packaging/linux/postinstall.sh)
- [apps/desktop/packaging/linux/preremove.sh](/Users/vrtak-cz/Workspace/Cookielab/Klovi/apps/desktop/packaging/linux/preremove.sh)
- [apps/desktop/packaging/linux/klovi.desktop](/Users/vrtak-cz/Workspace/Cookielab/Klovi/apps/desktop/packaging/linux/klovi.desktop) if its contents are moved into the AppImage packaging flow
- [apps/desktop/packaging/aur/PKGBUILD](/Users/vrtak-cz/Workspace/Cookielab/Klovi/apps/desktop/packaging/aur/PKGBUILD)

Also remove Homebrew install references from:

- [README.md](/Users/vrtak-cz/Workspace/Cookielab/Klovi/README.md)
- [release-desktop.yml](/Users/vrtak-cz/Workspace/Cookielab/Klovi/.github/workflows/release-desktop.yml)

## Acceptance Criteria

The follow-up implementation is complete only when all of the following are true:

- `beta` and `candidate` desktop builds no longer fall back to `dev`
- stable, candidate, and beta builds share one installed app identity
- Linux releases publish `.AppImage` assets instead of `.tar.gz`
- updater release selection requires valid `update.json`
- updater still works using full bundles from GitHub Releases
- Homebrew workflow/docs are removed
- old Linux distro packaging files are removed
- only the intended user-facing release assets remain

## Verification

Run all required project checks after implementation:

```sh
bun run check
bun run typecheck
bun test
```

Then verify the release workflow statically:

- no Linux `.tar.gz` user-facing release assets remain
- no macOS downloadable `.zip` or `.app` release asset remains
- no Homebrew cask job or input remains
- Linux workflow now produces AppImage outputs
- prerelease workflow paths resolve to `beta-*` and `candidate-*` build folders rather than `dev-*`

## Non-Goals

- no migration to Electrobun's stock runtime updater
- no delta patch support
- no alternate artifact hosting beyond GitHub Releases
- no changes to the browser/npm distribution flow
