# Update VISION Document

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Update `docs/arch2/VISION.md` to reflect the completed state after all plans (01-29) have been executed.

**Depends on:** Plans 28, 29

---

## In scope

- Update "Current State" section to reflect the completed architecture
- Update or remove "Remaining Work" section
- Verify all contract descriptions still match the actual implementations
- Update any file paths or export names that changed during restructuring
- Update `docs/arch2/README.md` to include plans 24-30 in the plan listing

## Out of scope

- Writing new architectural vision
- Adding new constraints or contracts

## Implementation steps

1. **Read current VISION.md** and compare each section against actual codebase state.

2. **Update "Current State"** to describe the completed three-app split, Effect platform migration, and package restructuring.

3. **Update or remove "Remaining Work"** — if everything is complete, replace with a brief "all planned work is complete" note or remove the section entirely.

4. **Verify contract descriptions.** For each key contract (`mountKloviApp`, `KloviClient`, `KloviHostBridge`, `KloviHostCapabilities`, `startKloviServer`, `POST /api/rpc/:method`):
   - Compare the documented shape against the actual source
   - Update any discrepancies

5. **Update README.md** to list plans 24-30 in the appropriate sections.

6. **Commit.**

## Acceptance criteria

- VISION.md accurately describes the current state of the architecture
- No "Remaining Work" items that have been completed
- All contract descriptions match actual source code
- README.md lists all plans 01-30
- `bun run check` passes (no formatting issues in markdown)

## Verification

- `bun run check`
