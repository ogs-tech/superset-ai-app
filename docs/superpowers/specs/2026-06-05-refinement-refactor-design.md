# Refinement Refactor — Design

**Status:** Approved for planning (PR 1 first)
**Date:** 2026-06-05
**Author:** Odenir Gomes (with Claude)

## Goal

Pay down accumulated debt on `main` and refine a small number of structural
rough edges — **without** touching the just-landed health/monitoring feature and
**without** mixing concerns into a single pull request. The work is sliced into
independent, sequenced PRs so each one is reviewable in isolation.

This honors the project rule (CLAUDE.md): _"Don't refactor opportunistically
inside a feature or bug PR — separate concerns get separate PRs."_ This spec is
that separate, deliberate refinement pass.

## Context — measured state of `main`

All numbers below were measured on 2026-06-05, not estimated.

| Signal        | State                          | Nature                                                                                     |
| ------------- | ------------------------------ | ------------------------------------------------------------------------------------------ |
| **Format**    | 175 files off Prettier         | Mechanical — `npm run format` fixes all in one shot.                                       |
| **Lint**      | 30 errors                      | Mostly `no-unused-vars` / `no-explicit-any`, almost entirely under `tests/`.               |
| **Typecheck** | 8 errors                       | 7 = stale `copilot` references in test fixtures; 1 = MUI v9 `slotProps` in `DetailDrawer`. |
| **Coverage**  | 72.84% stmts / 62.23% branches | Below the 80/70 gate; **all 1023 tests pass** (153 files). Type errors are type-only.      |
| **Structure** | Hexagonal split intact         | No tangled boundaries. A few heavy files; the "legacy umbrella" has already dissolved.     |

### Key finding: the "legacy umbrella" has already dissolved

CLAUDE.md describes `customization-service` as a "legacy umbrella" whose
`customization.*` IPC namespace _"is retained only for the CustomizationList
screen inside PluginEditor and cross-type search."_ The code has moved past this:

- The **`customization.*` IPC namespace no longer exists.** The live namespaces
  are `skill.*`, `agent.*`, `command.*`, `hook.*`, `global-instruction.*`,
  `marketplace.*`, `plugin.*`, `adapter.*`, `health.*`, etc.
- **`CustomizationService` is a healthy shared engine** (193 lines): validation,
  ID formatting, timestamp stamping, rename handling, adapter sync. Four facades
  (`skill`, `agent`, `command`, `global-instruction`) delegate to it via
  `private readonly base: CustomizationService`. Dissolving it would **duplicate**
  that logic across four facades — strictly worse.
- The `Customization*` components in the renderer (`CustomizationEditor`,
  `CustomizationListScreen`, `use-customization-list`) are a **legitimate
  polymorphic UI abstraction** over the four entity types, not dead code.

Therefore "kill the legacy umbrella" reduces to **(a) fixing the stale docs** and
**(b) renaming the engine** so it stops reading as an umbrella — not a migration.

## Approach — three sequenced PR streams

The ordering is forced by two facts: (1) CLAUDE.md mandates separate PRs per
concern, and (2) with 175 unformatted files, any structural diff would be buried
in formatting noise. So the mechanical baseline must land **first**.

### PR 1 — Tooling baseline (mechanical, deterministic)

Each step is its own commit so the history stays bisectable:

1. **Format** — `npm run format` (175 files). Isolated `style:` commit, zero
   logic change. Lands first so every later diff is clean.
2. **Typecheck (8 errors → 0):**
   - **`copilot` fixtures (7):** commit `1898c64` removed the Copilot adapter from
     production (`AdapterSettings` in `src/shared/settings.ts` now has only
     `claude`) but left test fixtures behind. Remove the `copilot: { … }` key from
     the `Settings` fixtures in: `tests/renderer/bootstrap-router.test.tsx`,
     `tests/renderer/screens/settings.test.tsx` (3 sites),
     `tests/renderer/screens/settings/adapters-section.test.tsx` (2 sites),
     `tests/renderer/screens/settings/linked-repos.test.tsx`.
   - **`DetailDrawer` (1):** MUI v9 tightened `slotProps.paper` so `'data-testid'`
     is no longer accepted at `src/renderer/components/DetailDrawer.tsx:34`. Fix at
     the single site (typed cast on the paper slot props, or relocate the
     attribute) while preserving the rendered `detail-drawer-${testId}` test id
     that `tests/renderer/components/DetailDrawer.test.tsx` asserts.
3. **Lint (30 errors → 0):** remove unused imports/vars and replace `any` with
   precise types. Almost all under `tests/`. No production behavior change.
4. **Coverage:** **measure and record only** (~72.84% stmts / 62.23% branches).
   Do **not** chase the 80/70 gate in this PR — see Deferred work.

**Risk:** near-zero. The type errors are type-only (tests already pass at
runtime), so fixing them cannot break green tests.

### PR 2 — Docs + engine rename (the reframed "kill the umbrella")

1. **Fix the stale CLAUDE.md** "Per-entity facades vs deprecated umbrella"
   section: state that the `customization.*` IPC namespace has been removed and
   that `CustomizationService` is a shared persistence engine the typed facades
   delegate to (not an umbrella to migrate off).
2. **Rename `CustomizationService` → `CustomizationEngine`.** Rationale: keep the
   established `Customization` domain vocabulary (already used by `src/shared`
   types and the renderer), while the `Engine` suffix signals "shared engine, not
   a facade." Rename the file `customization-service.ts` →
   `customization-engine.ts` and update the four consuming facades
   (`skill-service`, `agent-service`, `command-service`,
   `global-instruction-service`), the composition root `src/main/index.ts`, the
   `DomainError` re-export, and the corresponding tests. Pure rename — behavior
   unchanged.

**Risk:** near-zero (mechanical rename, covered by existing tests).

### PR 3+ — God-file breakups (behavior-preserving, one file per PR)

Split the genuinely heavy files into focused units behind a stable public
surface. Tests must be green before and after each split (no behavior change).
Prioritized by size and blast radius:

1. `src/main/application/services/plugin-service.ts` (606) — core logic, highest value.
2. `src/renderer/screens/starter-pack/StarterPackScreen.tsx` (669).
3. `src/renderer/screens/Settings.tsx` (545).
4. `src/renderer/screens/global-instructions/GlobalInstructionScreen.tsx` (427).

The exact decomposition of each file is deferred to that file's own
implementation plan — this spec sets the strategy (extract cohesive sub-units,
keep the imported surface stable, prove equivalence via the existing suite), not
line-by-line cuts.

**Risk:** this is the only stream with real regression risk (moving code can
break subtle behavior). The 1023 green tests are the safety net; any split that
can't keep them green is rejected.

## Scope of the first implementation plan

The `writing-plans` step that follows produces a plan for **PR 1 only** — it is
executable immediately and risk-free. PR 2 and each PR 3+ file get their own
plans later, drafted against this design doc as the source of truth.

## Out of scope / deferred

- **Coverage gate remediation** (reaching 80/70). Deferred deliberately: closing
  ~250 statements / ~155 branches is open-ended test-writing of a different
  nature than the mechanical baseline, and chasing a coverage number tends to
  produce low-value tests. Revisit **after** the god-file splits, which usually
  lift coverage for free (smaller units + tests added while splitting).
- **`hook-service` asymmetry.** `hook-service` is autonomous (it does not delegate
  to the shared engine) while the other four facades do. This is recorded as an
  observation only; normalizing it was explicitly not chosen for this pass.
- **Dissolving the shared engine.** Rejected — it would duplicate
  validation/rename/sync across four facades.
- **Other large-but-acceptable files** (`adapter-manager.ts` 362,
  `plugin-publisher.ts` 340, `Sidebar.tsx` 447). Not split unless a need surfaces
  while working the prioritized four.

## Success criteria

- **PR 1:** `npx prettier --check .` clean · `npm run typecheck` green ·
  `npm run lint` green · all 1023 tests still pass · coverage measured and
  recorded in the PR description.
- **PR 2:** CLAUDE.md accurately describes the IPC namespaces and the shared
  engine · rename complete with no dangling `CustomizationService` references ·
  typecheck/lint/tests green · no behavior change.
- **PR 3+ (per file):** the file is split into focused units · the imported
  surface is unchanged · all tests green before and after · no public API change.
