# New Desktop Release Plan

## Objective

The desktop release pipeline must produce only these user-facing assets:

- macOS arm64: downloadable `.dmg`
- Windows amd64: downloadable `.exe`
- Linux amd64: downloadable `.AppImage`
- Linux arm64: downloadable `.AppImage`

This release overhaul must also preserve the current desktop updater behavior and release-channel semantics:

- macOS `.zip` and downloadable `.app` assets must be removed
- old Linux desktop release artifacts must be removed
- updater metadata and updater bundles remain hosted only on GitHub Releases
- the settings release-channel selector must continue to work as it does today
- the app must not become a separate installed app per release channel
- macOS signing/notarization must continue to work with auto-updates

## Chosen Approach

- Keep Klovi's runtime updater as a thin GitHub Releases adapter.
- Use Electrobun's internal release artifact format as much as possible.
- Do not switch to Electrobun's stock runtime updater because it assumes a fixed `baseUrl` and does not match GitHub Releases plus runtime channel switching.
- Use full-bundle auto-updates only for this change.
- Do not implement delta patch generation or patch consumption in this change.
- Remove legacy desktop distribution paths, including Homebrew and old Linux package outputs.

## Implementation Workstreams

### A. Patch Electrobun naming behavior

Update the vendored patch at [patches/electrobun@1.15.1.patch](/Users/vrtak-cz/Workspace/Cookielab/Klovi/patches/electrobun@1.15.1.patch) so Electrobun supports a new config field:

- `app.includeReleaseChannelInName?: boolean`
- default: `true`

When `app.includeReleaseChannelInName` is set to `false` for non-dev builds:

- app and installer names must stay stable as `Klovi`
- channel-specific naming must remain only in platform prefixes, build folders, `version.json.channel`, and updater metadata
- stable, candidate, and beta builds must all target the same installed app identity
- current `process.execPath` / App Translocation safety fixes must remain intact

The future implementation must apply this naming override at the Electrobun naming layer rather than in Klovi release scripts. The generated installable names, tarball base names, and runtime `version.json.name` value must stay stable across stable, candidate, and beta release builds. Dev builds should keep current dev-specific behavior to avoid collisions with release installs.

### B. Update Electrobun desktop config

Update [apps/desktop/electrobun.config.ts](/Users/vrtak-cz/Workspace/Cookielab/Klovi/apps/desktop/electrobun.config.ts) to align with the new release model:

- set `app.includeReleaseChannelInName = false`
- keep dev behavior unchanged
- enable mac code signing and notarization for non-dev builds
- configure Windows and Linux icon paths
- set `release.generatePatch = false`
- do not rely on a fixed release bucket URL for runtime updating

The future implementation should continue to use Electrobun build environments for artifact prefixes and runtime channel metadata, but not for app identity. The config should remain the source of truth for signing, packaging defaults, and release artifact generation behavior.

### C. Rewrite desktop release workflow

Rewrite [release-desktop.yml](/Users/vrtak-cz/Workspace/Cookielab/Klovi/.github/workflows/release-desktop.yml) around the new artifact contract:

- keep verification job
- keep mac arm64 only
- keep windows x64 only
- keep linux matrix for x64 + arm64
- upload only:
  - user-facing installer for each platform
  - Electrobun-style normalized updater tarball
  - Electrobun-style `update.json`
- remove:
  - mac downloadable `.zip`
  - windows installer zip outputs
  - linux `tar.gz` installer uploads
  - Homebrew cask update job
  - Homebrew-related workflow inputs/comments

Target user-facing asset names:

- `Klovi-${VERSION}-macos-arm64.dmg`
- `Klovi-${VERSION}-windows-amd64.exe`
- `Klovi-${VERSION}-linux-amd64.AppImage`
- `Klovi-${VERSION}-linux-arm64.AppImage`

Updater assets that must still be uploaded to GitHub Releases:

- `${BUILD_ENV}-macos-arm64-Klovi.app.tar.zst`
- `${BUILD_ENV}-macos-arm64-update.json`
- `${BUILD_ENV}-win-x64-Klovi.tar.zst`
- `${BUILD_ENV}-win-x64-update.json`
- `${BUILD_ENV}-linux-x64-Klovi.tar.zst`
- `${BUILD_ENV}-linux-x64-update.json`
- `${BUILD_ENV}-linux-arm64-Klovi.tar.zst`
- `${BUILD_ENV}-linux-arm64-update.json`

The future implementation should keep GitHub Releases as the only storage location for both user-facing installers and updater assets. No parallel artifact host or alternate metadata bucket should be introduced.

### D. Add Linux AppImage packaging step

Add a new Bun-based packaging script in the future implementation, for example [apps/desktop/scripts/package-appimage.ts](/Users/vrtak-cz/Workspace/Cookielab/Klovi/apps/desktop/scripts/package-appimage.ts).

That future script must:

- consume Electrobun's normalized Linux tarball output
- extract it into an AppDir layout
- install launcher wrapper as `usr/bin/klovi`
- place desktop entry and icon in AppDir
- invoke official `appimagetool` for matching architecture
- rename output to the exact user-facing release asset name

The AppImage script should build from the normalized updater tarball rather than from a separate packaging tree. That keeps the Linux installer and updater artifact rooted in the same build output. This current doc-only task must not create that script yet.

### E. Keep Klovi updater as the runtime adapter

Keep the runtime updater implementation in [apps/desktop/src/bun/updater.ts](/Users/vrtak-cz/Workspace/Cookielab/Klovi/apps/desktop/src/bun/updater.ts), but align it with Electrobun-style release metadata.

The future implementation must:

- preserve current `stable` / `candidate` / `beta` settings semantics
- keep GitHub Releases discovery logic
- require both normalized tarball asset and matching `update.json`
- validate `update.json` before accepting a release
- ignore user-facing installer assets during update selection
- download full tarballs only
- keep current platform-specific apply logic unless strictly required to align with naming changes

Runtime updater behavior should remain a Klovi-owned GitHub Releases adapter instead of switching to Electrobun's stock runtime updater. The current RPC and UI contracts should stay unchanged unless required by verification.

### F. Remove legacy release/distribution paths

Future implementation cleanup targets:

- [scripts/build-release.sh](/Users/vrtak-cz/Workspace/Cookielab/Klovi/scripts/build-release.sh)
- [apps/desktop/packaging/linux/nfpm.yaml](/Users/vrtak-cz/Workspace/Cookielab/Klovi/apps/desktop/packaging/linux/nfpm.yaml)
- [apps/desktop/packaging/linux/postinstall.sh](/Users/vrtak-cz/Workspace/Cookielab/Klovi/apps/desktop/packaging/linux/postinstall.sh)
- [apps/desktop/packaging/linux/preremove.sh](/Users/vrtak-cz/Workspace/Cookielab/Klovi/apps/desktop/packaging/linux/preremove.sh)
- [apps/desktop/packaging/aur/PKGBUILD](/Users/vrtak-cz/Workspace/Cookielab/Klovi/apps/desktop/packaging/aur/PKGBUILD)
- Homebrew references in [README.md](/Users/vrtak-cz/Workspace/Cookielab/Klovi/README.md) and workflow/docs

This current doc-only task should only describe this cleanup, not perform it.

### G. Verification and acceptance criteria for the future implementation

The future implementation must verify all of the following:

- only the intended four user-facing assets are published
- updater assets remain present on GitHub Releases
- release channel switching still targets the same installed app
- no mac `.zip` or downloadable `.app` remains
- no old Linux `.tar.gz` release asset remains
- mac signed/notarized app can auto-update successfully
- updater still works on macOS, Windows, and Linux using full bundles

## Interfaces And Type Changes

- new patched Electrobun config field: `app.includeReleaseChannelInName?: boolean`
- no intended public RPC changes in [apps/desktop/src/shared/rpc-types.ts](/Users/vrtak-cz/Workspace/Cookielab/Klovi/apps/desktop/src/shared/rpc-types.ts)
- one new internal updater metadata shape is expected for future implementation:
  - `version`
  - `hash`
  - `platform`
  - `arch`

## Future Test Plan

- updater unit tests for release selection and `update.json` validation
- workflow/release artifact checks
- AppImage packaging script tests
- manual macOS signing/notarization/update validation
- manual Windows/Linux update smoke checks

## Non-Goals

- no release code changes in this task
- no updater refactor to Electrobun stock runtime updater
- no delta patch support in this release overhaul
- no alternative artifact hosting beyond GitHub Releases
