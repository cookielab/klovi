# New Desktop Release Plan

## Current Contract

- `stable`, `candidate`, and `beta` are updater filters only.
- Desktop releases always build through Electrobun's stable environment.
- GitHub release tags may still be stable, rc, or beta:
  - `1.2.3`
  - `1.2.3-rc.1`
  - `1.2.3-beta.1`
- User-facing release assets stay platform/version based:
  - `Klovi-${VERSION}-macos-arm64.dmg`
  - `Klovi-${VERSION}-windows-amd64.exe`
  - `Klovi-${VERSION}-linux-amd64.AppImage`
  - `Klovi-${VERSION}-linux-arm64.AppImage`
- Updater assets are always stable-prefixed, regardless of tag suffix:
  - `stable-macos-arm64-Klovi.app.tar.zst`
  - `stable-macos-arm64-update.json`
  - `stable-win-x64-Klovi.tar.zst`
  - `stable-win-x64-update.json`
  - `stable-linux-x64-Klovi.tar.zst`
  - `stable-linux-x64-update.json`
  - `stable-linux-arm64-Klovi.tar.zst`
  - `stable-linux-arm64-update.json`

## Semantics

- `stable` accepts only stable tags.
- `candidate` accepts stable and `-rc.N` tags.
- `beta` accepts stable, `-rc.N`, and `-beta.N` tags.
- These values do not create different desktop app identities.
- Changing the setting only changes which GitHub release tags are eligible.

## Notes

- Existing published prerelease updater assets with `beta-*` prefixes are intentionally unsupported after this cleanup.
- The Electrobun patch remains only for runtime path fixes required by the installed desktop app.
- The vendored Electrobun CLI path is no longer part of the supported release flow.
