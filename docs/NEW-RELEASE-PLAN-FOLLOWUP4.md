# New Desktop Release Plan Follow-Up 4

## Objective

Clarify the intended meaning of the existing `stable`, `candidate`, and `beta`
settings values.

The product requirement is:

- there is exactly one desktop app identity: `Klovi`
- there is exactly one user-facing release contract per platform
- the three settings values remain in the UI
- those three values must affect only update filtering logic

This follow-up is complete only when channel selection changes which GitHub
release tags are eligible for update, and nothing else.

## Clarified Channel Semantics

The settings values must behave as pure release filters:

- `stable`: accept only normal releases such as `1.2.3`
- `candidate`: accept release candidates and stable releases, such as
  `1.2.3-rc.1` and `1.2.3`
- `beta`: accept beta, release candidate, and stable releases, such as
  `1.2.3-beta.1`, `1.2.3-rc.1`, and `1.2.3`

They must not represent different app variants.

## Rules That Must Hold

### 1. Single app identity

All channels must install and update the same app identity:

- same app name: `Klovi`
- same bundle identifier / install identity
- same installed app location semantics
- same updater apply logic

Changing the release-channel setting must never make the app behave like a
separate installable product.

### 2. Single user-facing release contract

User-facing release assets must stay platform-only and version-only:

- `Klovi-${VERSION}-macos-arm64.dmg`
- `Klovi-${VERSION}-windows-amd64.exe`
- `Klovi-${VERSION}-linux-amd64.AppImage`
- `Klovi-${VERSION}-linux-arm64.AppImage`

Channel choice must not create separate downloadable app variants.

### 3. Channel affects only update eligibility

The updater must classify GitHub releases by tag and apply the selected filter.

Examples:

- app on `stable` must ignore a newer `1.3.0-beta.1`
- app on `candidate` may update to `1.3.0-rc.1` but must still ignore
  `1.3.0-beta.1`
- app on `beta` may update to `1.3.0-beta.1`

After the user changes the setting, the next update check may choose a
different eligible release, but the installed app identity must remain the
same.

### 4. Internal channel-specific metadata is optional, not product behavior

If the implementation keeps channel-prefixed updater metadata or normalized
bundles such as:

- `stable-macos-arm64-update.json`
- `candidate-win-x64-Klovi.tar.zst`
- `beta-linux-arm64-update.json`

that is acceptable only as an internal storage/detail of the updater flow.

Those names must not leak into:

- app identity
- installer identity
- user-facing release naming
- user-visible “separate channel app” behavior

If the same behavior can be achieved with less channel-specific artifact
surface, prefer the simpler design.

## Required Implementation Guidance

### 1. Keep the three UI values, but treat them as filters only

Do not remove `stable`, `candidate`, or `beta` from settings.

Do not add channel-specific bundle IDs, app names, install paths, or separate
installer identities.

### 2. Audit the release pipeline for channel leakage

Future implementation or cleanup work must treat the following as bugs if they
depend on channel unnecessarily:

- app name or bundle display name
- executable name when it changes installed identity
- installer base name beyond the final user-facing platform asset names
- install location or lookup path
- updater apply destination

Build folders and internal artifact prefixes may stay channel-specific if they
are only build-time or metadata-routing details.

### 3. Keep GitHub Releases filtering logic explicit

The updater should continue to determine eligibility from GitHub tags and the
selected setting:

- stable release tags have no prerelease suffix
- candidate release tags use `-rc.N`
- beta release tags use `-beta.N`

The updater must not infer “different app variants” from these channels.

### 4. Preserve current update flow shape

This clarification does not require a new updater architecture.

Keep:

- GitHub Releases as the source of release discovery
- one runtime updater implementation
- full-bundle updates

Do not introduce:

- separate channel apps
- per-channel install locations
- per-channel user-facing installers

## Verification

The future implementation or cleanup is complete only when all of the following
are demonstrated:

- installing the stable desktop app yields `Klovi`, not a channel-specific app
- changing the release-channel setting does not create a second installed app
- `stable` ignores beta and rc releases
- `candidate` accepts rc and stable releases but not beta releases
- `beta` accepts beta, rc, and stable releases
- user-facing release assets remain the same four platform assets only
- no user-visible release artifact or install identity changes because of the
  selected channel

## Acceptance Criteria

- `stable`, `candidate`, and `beta` remain available in settings
- those values are used only to filter eligible releases
- app identity remains singular across all three settings
- platform release assets remain singular across all three settings
- GitHub release tag classification drives update behavior

## Non-Goals

- removing the three existing settings values
- creating separate app variants per channel
- turning channels into separate installers or app identities
- changing artifact hosting away from GitHub Releases
