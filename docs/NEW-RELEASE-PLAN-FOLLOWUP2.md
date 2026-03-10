# New Desktop Release Plan Follow-Up 2

## Objective

Complete the desktop release overhaul by fixing the regressions that remain after the first implementation pass.

This follow-up must make all of the following true at the same time:

- prerelease desktop builds work for `beta` and `candidate`
- stable, candidate, and beta builds keep one installed app identity
- Linux release jobs produce the requested `.AppImage` assets successfully
- updater release selection rejects partial or mismatched GitHub releases before reporting an update as available
- the existing desktop release contract from [docs/NEW-RELEASE-PLAN.md](/Users/vrtak-cz/Workspace/Cookielab/Klovi/docs/NEW-RELEASE-PLAN.md) remains unchanged

## Current Failures

The merged implementation is closer, but it still has five concrete failures:

1. [apps/desktop/package.json](/Users/vrtak-cz/Workspace/Cookielab/Klovi/apps/desktop/package.json) still runs `electrobun build` and `electrobun dev`. That package shim downloads and executes Electrobun's prebuilt CLI binary, so the vendored source patch in [patches/electrobun@1.15.1.patch](/Users/vrtak-cz/Workspace/Cookielab/Klovi/patches/electrobun@1.15.1.patch) is not the code path reliably used by local and CI release builds. The observed symptom is that `bun run build -- --env=candidate` still emits only `stable-*` outputs.
2. [apps/desktop/electrobun.config.ts](/Users/vrtak-cz/Workspace/Cookielab/Klovi/apps/desktop/electrobun.config.ts) sets `includeReleaseChannelInName: !isDev`, which is the opposite of the required release behavior once the patch is active.
3. [apps/desktop/scripts/package-appimage.ts](/Users/vrtak-cz/Workspace/Cookielab/Klovi/apps/desktop/scripts/package-appimage.ts) and [release-desktop.yml](/Users/vrtak-cz/Workspace/Cookielab/Klovi/.github/workflows/release-desktop.yml) do not agree on the script interface. The workflow passes `--appimagetool-arch`, but the script rejects that argument. The script also assumes `bin/zig-zstd` exists at the tarball root, which does not match how Electrobun creates the archive.
4. [apps/desktop/src/bun/updater.ts](/Users/vrtak-cz/Workspace/Cookielab/Klovi/apps/desktop/src/bun/updater.ts) still selects the newest semver release before proving that it has both updater assets, so a newer incomplete GitHub release can still block updates.
5. [apps/desktop/src/bun/updater.ts](/Users/vrtak-cz/Workspace/Cookielab/Klovi/apps/desktop/src/bun/updater.ts) only validates the shape of `update.json`. It does not enforce that `version === tag_name` or that `platform` and `arch` match the running target.

## Chosen Approach

- Stop relying on Electrobun's downloaded CLI binary for desktop `build` and `dev` scripts.
- Run the patched Electrobun TypeScript CLI directly with Bun so the repository patch is the effective code path in local builds and CI.
- Keep channel-specific platform prefixes and build folders, but force release installable names to stay stable with `app.includeReleaseChannelInName = false`.
- Rework Linux AppImage packaging around one script/workflow contract and around the real Electrobun tarball structure.
- Make the updater select only a usable release, not just the newest semver tag.

## Required Changes

### 1. Route desktop builds through the patched Electrobun CLI

Update [apps/desktop/package.json](/Users/vrtak-cz/Workspace/Cookielab/Klovi/apps/desktop/package.json) so the desktop scripts no longer rely on the `electrobun` package shim.

Required implementation:

- replace `electrobun build` with a Bun invocation of the patched Electrobun CLI source entrypoint
- replace `electrobun dev` the same way
- keep the current working-directory behavior intact so the desktop app still resolves `electrobun.config.ts` and project-relative paths correctly
- treat this as the only supported path for desktop CI and release builds

Required verification:

- `cd apps/desktop && bun run build -- --env=stable` must create `apps/desktop/build/stable-*` and `apps/desktop/artifacts/stable-*`
- `cd apps/desktop && bun run build -- --env=candidate` must create `apps/desktop/build/candidate-*` and `apps/desktop/artifacts/candidate-*`
- `cd apps/desktop && bun run build -- --env=beta` must create `apps/desktop/build/beta-*` and `apps/desktop/artifacts/beta-*`

Do not treat a source patch as complete unless those three commands prove the patched CLI path is actually executing.

### 2. Fix release naming so all channels target one installed app

Update [apps/desktop/electrobun.config.ts](/Users/vrtak-cz/Workspace/Cookielab/Klovi/apps/desktop/electrobun.config.ts) to set:

- `app.includeReleaseChannelInName = false`

Do not gate this on `!isDev`. The Electrobun patch already keeps `dev` naming separate by checking `buildEnvironment !== "dev"`, so the config should always express the release requirement directly.

Required outcome:

- stable, candidate, and beta builds all produce the same app/installable base name: `Klovi`
- channel-specific naming remains only in build folder names, platform prefixes, `version.json.channel`, and `update.json`
- macOS app bundle name stays `Klovi.app` for all release channels
- Windows updater tarball base name stays `Klovi.tar.zst`
- Linux updater tarball base name stays `Klovi.tar.zst`

### 3. Repair the Linux AppImage packaging contract

Update [apps/desktop/scripts/package-appimage.ts](/Users/vrtak-cz/Workspace/Cookielab/Klovi/apps/desktop/scripts/package-appimage.ts) and [release-desktop.yml](/Users/vrtak-cz/Workspace/Cookielab/Klovi/.github/workflows/release-desktop.yml) so the script interface and workflow invocation match exactly.

Use this script contract:

- `--tarball`
- `--arch`
- `--version`
- `--output`

Do not pass `--appimagetool-arch` from the workflow. The script must derive the AppImage architecture internally from `--arch`.

Rework the packaging flow so it matches Electrobun's actual tarball layout:

- do not try to bootstrap by extracting `bin/zig-zstd` from the archive root
- decompress the normalized `.tar.zst` with a deterministic CI dependency such as `zstd` or `tar --zstd`
- extract the resulting tar and read the first top-level bundle directory from the extracted output
- place the extracted bundle under `AppDir/usr/lib/klovi`
- create `AppDir/usr/bin/klovi` as the launcher wrapper
- create `AppDir/AppRun` pointing at that wrapper
- place `klovi.desktop`, `klovi.png`, and `.DirIcon` at the AppDir root
- emit exactly:
  - `Klovi-${VERSION}-linux-amd64.AppImage`
  - `Klovi-${VERSION}-linux-arm64.AppImage`

The Linux workflow must only upload the AppImage plus the normalized updater tarball and `update.json`.

### 4. Make updater release selection choose only usable releases

Refactor [apps/desktop/src/bun/updater.ts](/Users/vrtak-cz/Workspace/Cookielab/Klovi/apps/desktop/src/bun/updater.ts) so `check()` no longer accepts the newest semver release blindly.

Required implementation:

- scan filtered GitHub releases newest-first
- treat a release as usable only if it contains both the normalized updater tarball and the matching `update.json`
- fetch and validate `update.json` before setting `latestRelease` or emitting `status: "available"`
- skip incomplete newer releases and continue scanning until a usable release is found
- keep full-bundle download behavior only
- keep current RPC and UI update contracts unchanged

This change must move validation earlier in the flow. `download()` should remain defensive, but `check()` is where release usability must be decided.

### 5. Strengthen `update.json` validation

Extend the existing update metadata validation in [apps/desktop/src/bun/updater.ts](/Users/vrtak-cz/Workspace/Cookielab/Klovi/apps/desktop/src/bun/updater.ts).

Required validation rules:

- `version` must equal the GitHub release `tag_name`
- `platform` must equal the current target platform
- `arch` must equal the current target arch
- `hash` must remain a non-empty string

Reject the release if any of those checks fail. Do not mark the update as available and do not download the tarball for that release.

### 6. Expand tests around the real failure cases

Update [apps/desktop/src/bun/updater.test.ts](/Users/vrtak-cz/Workspace/Cookielab/Klovi/apps/desktop/src/bun/updater.test.ts) and add focused tests for the AppImage script.

Required updater test coverage:

- incomplete newer release is skipped in favor of the newest usable release
- missing normalized tarball rejects a release
- missing `update.json` rejects a release
- mismatched `version` rejects a release
- mismatched `platform` rejects a release
- mismatched `arch` rejects a release
- user-facing installer assets are ignored for updater selection

Required AppImage test coverage:

- accepted CLI arguments match the workflow invocation
- `x64 -> amd64 / x86_64` mapping
- `arm64 -> arm64 / aarch64` mapping
- expected AppDir paths are created
- exact output filename is produced

### 7. Add release-specific verification beyond the standard project checks

The standard repository checks remain mandatory:

```sh
bun run check
bun run typecheck
bun test
```

They are not sufficient for this release work. Add explicit release smoke verification:

```sh
cd apps/desktop && bun run build -- --env=stable
cd apps/desktop && bun run build -- --env=candidate
cd apps/desktop && bun run build -- --env=beta
```

After those builds, verify all of the following:

- `stable-*`, `candidate-*`, and `beta-*` build folders exist
- `stable-*`, `candidate-*`, and `beta-*` artifact prefixes exist
- release-channel builds keep `Klovi.app` and `Klovi.tar.zst` base names instead of `Klovi-candidate` or `Klovi-beta`
- Linux workflow arguments match the AppImage script exactly
- no release workflow path still expects `.tar.gz` user-facing Linux assets

## Acceptance Criteria

This follow-up is complete only when all of the following are true:

- prerelease builds no longer collapse to `stable` output when invoked through the actual desktop build scripts
- stable, candidate, and beta releases all target the same installed app identity
- Linux AppImage packaging runs successfully without unsupported arguments or invalid tarball assumptions
- updater selection skips incomplete newer releases
- `update.json` validation enforces version, platform, and arch matching
- the mandatory repository checks still pass
- the release-specific smoke builds above pass

## Non-Goals

- no migration to Electrobun's stock runtime updater
- no delta patch support
- no alternative artifact hosting beyond GitHub Releases
- no changes to the browser/npm distribution flow
