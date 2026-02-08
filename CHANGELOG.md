# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security

- Replace regex-based path traversal prevention with `path.resolve()` + prefix check in static file serving

### Changed

- Move `@types/*` packages to `devDependencies`
- Pin `@types/bun` to `^1.3.8` instead of `latest`
- Add `prepublishOnly` script to prevent incomplete publishes

### Added

- Code of Conduct (Contributor Covenant v2.1)
- `.editorconfig` for consistent editor settings
- Dependabot configuration for automated dependency updates
- Unit tests for `shortModel()`, `projectDisplayName()`, `usePresentationMode()`, `useTheme()`, `useFontSize()`
