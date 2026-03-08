# 37 Wire Release Flow To Single-Package npm Publish

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire the release flow to the dedicated npm publish workflow so desktop release tagging and single-package npm publishing share the same version source without requiring manual re-entry.

**Architecture:** The repository already has a dedicated npm publish workflow and a separate release workflow. The remaining gap is orchestration: the release flow does not yet drive the npm publish path automatically with the same resolved version. The solution should keep the dedicated npm publish workflow, make it reusable from the release flow, and preserve the staged-artifact verification gates before publish.

**Depends on:** Plans 35 and 36

---

## In scope

- Keep a dedicated npm publish workflow
- Make the npm publish workflow reusable from the release flow
- Pass the release version into npm publish without manual re-entry
- Preserve verification gates and staged-artifact-only publishing
- Document the chosen npm authentication mode inline in workflow comments

## Out of scope

- Replacing desktop release packaging
- Changing semver or tagging policy
- Publishing internal workspace packages
- Reworking the staged artifact layout from Plans 31-36
- Enabling trusted publishing unless the repository is already configured for it

## Files/directories to create or change

- `.github/workflows/npm-publish.yml`
- `.github/workflows/release.yml`
- Any small helper scripts only if they are strictly required to avoid duplicating fragile shell logic

## Implementation steps

1. **Lock the workflow topology.**
   - Keep `.github/workflows/npm-publish.yml` as the focused npm publish workflow.
   - Convert it into a reusable workflow, or add a reusable entry path, so `release.yml` can invoke it directly.
   - Preserve manual `workflow_dispatch` usage if practical, but the release flow must no longer depend on manual version re-entry.

2. **Make release metadata the shared source of truth.**
   - Use the version resolved in `release.yml` as the exact version passed to npm publish.
   - Do not require operators to retype the version into a second workflow.
   - Keep prerelease/stable distinctions compatible with the existing release metadata logic.

3. **Preserve verification gates before publish.**
   - Ensure the reusable npm publish path still runs:
     - `bun run check`
     - `bun run typecheck`
     - `bun test`
     - packed-artifact verification
   - Ensure publish only happens if those gates pass.

4. **Publish only from the staged artifact.**
   - Keep `apps/package/.stage/npm` as the only working directory used for `npm publish`.
   - Preserve the staged-artifact build and verification steps added in Plans 31-36.
   - Do not publish from workspace root or `apps/package` source.

5. **Choose and document authentication explicitly.**
   - Use secret-based npm auth as the default for this plan unless trusted publishing is already configured and proven to work in the repository.
   - Add concise workflow comments explaining that choice and what would need to change to adopt trusted publishing later.
   - Keep the workflow decision explicit rather than implied.

6. **Validate the release-to-publish handoff.**
   - Ensure `release.yml` triggers or calls the npm publish workflow after the release version is known.
   - Make the dependency ordering explicit so publish cannot race ahead of release metadata generation.

## Acceptance criteria

- The release flow can invoke the dedicated npm publish workflow without manual version re-entry
- npm publish still runs the required verification gates before publishing
- npm publish still publishes only from `apps/package/.stage/npm`
- The publish workflow documents the current secret-based auth choice inline
- The version published to npm is the same version resolved by the release flow

## Verification

- `bun run check`
- `bun run typecheck`
- `bun test`
- `bun run stage:npm`
- `bun run verify:packed-artifact`
- Run a workflow-level dry-run or equivalent validation showing that `release.yml` can invoke the npm publish path with the same version source
- Inspect both workflows and confirm npm publish still runs only from `apps/package/.stage/npm`
