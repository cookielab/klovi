# 34 Restore Single-Package npm Publish Workflow

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restore npm publishing for `@cookielab.io/klovi` only, using the staged artifact defined by Plans 31-33.

**Architecture:** The publish workflow must ship exactly one npm package: `@cookielab.io/klovi`. Internal workspace packages remain unpublished implementation modules. The publish job must publish the same staged artifact that was packed and verified in CI.

**Depends on:** Plans 32 and 33

---

## In scope

- Dedicated npm publish workflow or explicit publish job in the release workflow
- Version propagation into the staged artifact
- Verification gates before publish
- Trusted publishing or documented fallback authentication

## Out of scope

- Publishing internal workspace packages
- Desktop artifact release changes beyond coordination with shared versioning
- Semver policy changes

## Files/directories to create or change

- `.github/workflows/release.yml`
- `.github/workflows/npm-publish.yml` or equivalent publish workflow
- Publish/staging scripts used by the workflow
- `apps/package` staging/build scripts where required

## Implementation steps

1. **Choose a dedicated npm publish path.**
   - Prefer a dedicated `.github/workflows/npm-publish.yml`.
   - The release workflow may trigger it, but the npm publish logic should live in one focused workflow.

2. **Publish only from the staged artifact.**
   - Build and stage `apps/package/.stage/npm`.
   - Publish from that directory only.
   - Never publish from the workspace root or directly from `apps/package` source.

3. **Run verification gates before publish.**
   - Required gates:
     - `bun run check`
     - `bun run typecheck`
     - `bun test`
     - packed-artifact verification from Plan 33

4. **Set version from release input or tag.**
   - Release/tag version is the source of truth.
   - The workflow must stamp that version into the staged `package.json` before packing and publishing.

5. **Use trusted publishing by default.**
   - Prefer npm trusted publishing / OIDC if repository and npm org support it.
   - If that is not available, document the required fallback secret-based publish configuration in the workflow comments and project docs.

6. **Preserve the public package contract.**
   - Publish only `@cookielab.io/klovi`.
   - Ensure the published package includes:
     - `klovi` bin
     - `./server` export
     - runtime files from the staged artifact

7. **Keep desktop release separate.**
   - Desktop packaging remains its own release path.
   - Shared version tagging may be coordinated, but npm publish must not require publishing internal packages or desktop artifacts first.

## Historical references

Use prior v1/v2 npm publish support only as workflow reference material:

- old `.github/workflows/npm-publish.yml`
- old release workflow trigger pattern
- old version stamping/build scripts

Do not use them as a reason to revert the current multi-package source architecture.

## Acceptance criteria

- Release pipeline can publish `@cookielab.io/klovi`
- Internal packages are never published
- Published package matches the verified staged tarball
- Publish job uses the staged artifact from Plan 32
- Publish job is blocked on the packed-artifact verification from Plan 33

## Verification

- `bun run check`
- `bun run typecheck`
- `bun test`
- Run packed-artifact verification
- Dry-run or equivalent validation of the npm publish workflow
