# 36 Finish Package Artifact Metadata And Publish Guardrails

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Finish the staged npm artifact metadata flow by wiring version/commit stamping end to end and add guardrails that prevent accidental publish attempts from `apps/package` source instead of `apps/package/.stage/npm`.

**Architecture:** The staged artifact flow already exists, but two packaging details remain weak: commit metadata is parsed but not fully propagated through the staged artifact and publish workflow, and the source `apps/package` workspace can still be mistaken for a valid npm publish directory. The artifact contract must stay centered on `apps/package/.stage/npm` as the sole publish source of truth.

**Depends on:** Plan 35

---

## In scope

- Wire `--version` and `--commit` metadata through staging and publish automation
- Ensure the staged artifact remains the only valid npm publish source
- Add explicit failure behavior for source-tree publish attempts from `apps/package`
- Verify staged artifact metadata and publish guardrails through automation

## Out of scope

- Reworking the public server export contract beyond what Plan 35 already decided
- Replacing the staging directory layout
- Publishing from the workspace root
- Adding caching or reusing stale staged output between runs
- Broader release workflow orchestration beyond the npm publish path

## Files/directories to create or change

- `apps/package/scripts/stage-npm.ts`
- `apps/package/src/cli.ts`
- `apps/package/package.json`
- `.github/workflows/npm-publish.yml`
- `scripts/verify-packed-artifact.ts`
- Any small packaging tests or smoke scripts needed to assert guardrail behavior

## Implementation steps

1. **Define the metadata source of truth.**
   - Treat the release/publish workflow inputs as the source of truth for staged `version` and `commit`.
   - Preserve the runtime behavior where the CLI/server can surface both version and commit metadata.
   - Do not invent a second metadata file or sidecar manifest.

2. **Finish commit stamping in the staging flow.**
   - Update `apps/package/scripts/stage-npm.ts` so `--commit` is not merely parsed; it is written into the staged artifact in the exact place consumed by the runtime.
   - Keep the staged manifest sanitized for npm consumers and do not reintroduce workspace references.
   - Ensure the runtime launched from the staged artifact reads the stamped metadata rather than falling back silently to empty values when a commit was supplied.

3. **Pass commit metadata through publish automation.**
   - Update `.github/workflows/npm-publish.yml` so the staging command receives both the selected version and the current commit hash.
   - Standardize on one commit format, preferably `git rev-parse --short HEAD`, and use that consistently.

4. **Add source-publish guardrails in `apps/package`.**
   - Change `apps/package/package.json` so publish from source is explicitly rejected with a clear error explaining that publish must happen from `apps/package/.stage/npm`.
   - Keep local `build` and `stage:npm` workflows functional.
   - Do not rely on convention alone; the guardrail must fail deterministically.

5. **Verify staged metadata and guardrails.**
   - Extend `scripts/verify-packed-artifact.ts` or a closely related smoke path so it can verify version/commit metadata when provided.
   - Add a packaging-level check that publishing from `apps/package` source fails with the intended guardrail message.
   - Keep the packed-artifact runtime verification focused on the staged tarball users actually install.

6. **Preserve the existing staged artifact contract.**
   - Keep `apps/package/.stage/npm` as the only publishable directory.
   - Keep the staged manifest free of `workspace:*` dependencies and internal package references.

## Acceptance criteria

- `apps/package/scripts/stage-npm.ts --version ... --commit ...` writes the expected runtime metadata into the staged artifact
- `.github/workflows/npm-publish.yml` passes both version and commit into staging
- Publishing from `apps/package` source fails explicitly and directs the user/workflow to `apps/package/.stage/npm`
- Publishing from `apps/package/.stage/npm` remains valid
- Packed-artifact verification can prove the staged artifact contains the expected version/commit metadata

## Verification

- `bun run check`
- `bun run typecheck`
- `bun test`
- `bun run stage:npm`
- Run the staging script with explicit `--version` and `--commit` and inspect the staged artifact metadata
- `bun run verify:packed-artifact`
- Run a source-tree publish guardrail check and confirm it fails explicitly from `apps/package`
