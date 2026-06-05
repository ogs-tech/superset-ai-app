# PR 1 — Tooling Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `main` to a clean tooling baseline — Prettier-formatted, `typecheck` green, `lint` green, all 1023 tests still passing — in isolated, bisectable commits, with coverage measured (not chased).

**Architecture:** Three sequenced commits on one branch (`style:` format → `fix(types):` typecheck → `fix(lint):` lint), each independently green. No production behavior change: the only production edits are a type-narrowing refactor on one MUI prop, two dead `catch` bindings removed, one dead destructured var removed, one dead import removed. The 3 `react-hooks/set-state-in-effect` findings are **deferred** via a scoped ESLint `warn` override (decided 2026-06-05) — the real effect refactor is its own later PR.

**Tech Stack:** Prettier, TypeScript (`tsc`, dual `tsconfig.node.json` + `tsconfig.web.json`), ESLint flat config (`typescript-eslint` + `eslint-plugin-react-hooks`), Vitest (node + jsdom projects).

**Source of truth:** `docs/superpowers/specs/2026-06-05-refinement-refactor-design.md` (PR 1 section).

---

## Deviation from the spec (read first)

The spec characterised lint as "30 errors … almost entirely under `tests/`". The **measured** reality on 2026-06-05 is:

- **30 lint errors total**, but **17 are in production `src/`** (not "almost entirely tests").
- **3 of those are `react-hooks/set-state-in-effect`** (`PublishPluginDialog.tsx:75,91`, `PluginInstallPreviewDialog.tsx:67`) — **not** the `no-unused-vars` / `no-explicit-any` the spec anticipated, and **not** mechanically removable.

**Decision (2026-06-05):** the 3 `set-state-in-effect` errors are deferred via a **scoped `warn` override** in `eslint.config.js` (only those two files; the rule stays `error` everywhere else). `npm run lint` is `eslint .` with no `--max-warnings`, so warnings do not fail the gate. The proper effect refactor (derive state / remount via `key`) is a behavior-affecting change that belongs to its own PR — this keeps PR 1 purely mechanical, honoring CLAUDE.md ("don't refactor inside a baseline PR") and the global "band-aid only with a tracked follow-up" rule.

**Tracked follow-up created by this plan:** _"Refactor form-init effects in `PublishPluginDialog` / `PluginInstallPreviewDialog` to satisfy `react-hooks/set-state-in-effect` and remove the scoped warn override."_ (See Task 5, final step.)

---

## File Structure

Files touched in PR 1, grouped by the commit that touches them:

**Commit 1 — format (mechanical, whole tree):**

- All ~176 Prettier-dirty files via `npm run format`. No manual edits.

**Commit 2 — typecheck → 0:**

- Modify: `src/renderer/components/DetailDrawer.tsx` — extract paper slot props to a `const` (kills the MUI v9 `slotProps.paper` `data-testid` type error without a cast).
- Modify (remove stale `copilot` fixture key): `tests/renderer/bootstrap-router.test.tsx`, `tests/renderer/screens/settings.test.tsx` (3 sites), `tests/renderer/screens/settings/adapters-section.test.tsx` (2 sites), `tests/renderer/screens/settings/linked-repos.test.tsx` (1 site).

**Commit 3 — lint → 0:**

- Modify: `eslint.config.js` — add `no-unused-vars` ignore patterns (`^_`) + scoped `set-state-in-effect` warn override.
- Modify (production, dead bindings/import): `src/main/application/schemas/plugin-manifest.schema.ts`, `src/main/application/services/plugin-manifest-parser.ts`, `src/main/application/services/plugin-publisher.ts`, `src/renderer/screens/plugins/PublishPluginDialog.tsx`.
- Modify (tests, dead imports/vars + `any`): `tests/main/application/schemas/meta-file.schema.test.ts`, `tests/main/application/schemas/plugin-manifest.schema.test.ts`, `tests/main/application/services/customization-service.test.ts`, `tests/main/application/services/plugin-installer.test.ts`, `tests/main/application/services/plugin-publisher.test.ts`, `tests/main/domain/plugin-id.test.ts`, `tests/main/domain/plugin-ref.test.ts`.

> **No source edits needed** for the `_`-prefixed unused vars in `src/main/application/services/__fixtures__/fake-git-port.ts` (10), `tests/main/application/schemas/meta-file.schema.test.ts:142` (`_id`), `tests/main/application/services/plugin-author-service.test.ts:38` (`_scope`), `tests/main/application/services/plugin-service.test.ts:109` (`_dir`) — the ESLint config change in Task 3 clears all of them at once.

---

## Task 0: Branch and capture the baseline

**Files:** none (git + measurement only).

- [ ] **Step 1: Create the working branch**

We are on `main`; CLAUDE.md requires branching before committing.

```bash
git checkout -b chore/tooling-baseline
```

- [ ] **Step 2: Confirm the starting state (these are the numbers we will drive to zero)**

```bash
npx prettier --check . 2>&1 | tail -1
npm run typecheck 2>&1 | grep -c "error TS"
npm run lint 2>&1 | tail -1
npm test 2>&1 | tail -3
```

Expected:

- Prettier: `Code style issues found in 176 files.` (number may be 175–176)
- Typecheck: `8`
- Lint: `✖ 30 problems (30 errors, 0 warnings)`
- Tests: all pass (1023 tests, 153 files) — e.g. `Test Files  153 passed (153)`

> If tests are **not** all green here, STOP — the baseline assumption is broken and the rest of this plan (which relies on tests as the safety net) is invalid. Investigate before continuing.

---

## Task 1: Format the entire tree (`style:` commit)

**Files:** ~176 files rewritten by Prettier. No manual edits.

This lands first so every later diff is free of formatting noise.

- [ ] **Step 1: Run Prettier write**

```bash
npm run format
```

Expected: a list of files ending with a summary; exit code 0.

- [ ] **Step 2: Verify the tree is now Prettier-clean**

```bash
npx prettier --check .
```

Expected: `All matched files use Prettier code style!`

- [ ] **Step 3: Verify nothing else moved (tests still green, no logic touched)**

```bash
npm test 2>&1 | tail -3
```

Expected: all tests pass (same 1023). Formatting cannot change behavior; this is a sanity check.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
style: format entire tree with prettier

Mechanical, zero logic change. Lands first so later structural diffs are
free of formatting noise.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Typecheck → 0 (`fix(types):` commit)

**Files:**

- Modify: `src/renderer/components/DetailDrawer.tsx`
- Modify: `tests/renderer/bootstrap-router.test.tsx`
- Modify: `tests/renderer/screens/settings.test.tsx`
- Modify: `tests/renderer/screens/settings/adapters-section.test.tsx`
- Modify: `tests/renderer/screens/settings/linked-repos.test.tsx`

All 8 typecheck errors live in the **web** project (`tsconfig.web.json`); the node project is already green.

- [ ] **Step 1: Fix `DetailDrawer` — extract paper slot props to a `const`**

In `src/renderer/components/DetailDrawer.tsx`, replace the inline `slotProps` object literal. MUI v9 tightened `SlotProps` so a `data-testid` on a _fresh literal_ is rejected; extracting to a `const` removes the literal's excess-property check while still rendering the attribute on the `Paper`.

Replace:

```tsx
}: DetailDrawerProps): React.ReactElement {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: { width: { xs: '100%', sm: width } },
          'data-testid': `detail-drawer-${testId}`,
        },
      }}
    >
```

with:

```tsx
}: DetailDrawerProps): React.ReactElement {
  // Extracted to a const so it is no longer a "fresh" object literal: TS excess-property
  // checks only apply to literals passed directly, so `data-testid` (not in MUI v9's
  // tightened SlotProps) is accepted while still rendering on the Paper element.
  const paperSlotProps = {
    sx: { width: { xs: '100%', sm: width } },
    'data-testid': `detail-drawer-${testId}`,
  };
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ paper: paperSlotProps }}
    >
```

- [ ] **Step 2: Remove the stale `copilot` fixture key from all 4 test files**

Commit `1898c64` removed the Copilot adapter from production (`AdapterSettings` now only has `claude`), but these `Settings` fixtures still set a `copilot` key whose shape (`{ enabled, exclusiveSkillsWithClaude }`) no longer exists in the type. In each file below, **delete the entire `copilot: { … },` line** from every `adapters: { … }` object. (After Task 1's format, the exact line layout may differ slightly; the property to delete is unambiguous.)

`tests/renderer/bootstrap-router.test.tsx` — 1 site (the `validSettings.adapters` object). Delete:

```tsx
    copilot: { enabled: false, exclusiveSkillsWithClaude: false },
```

`tests/renderer/screens/settings.test.tsx` — 3 sites (`baseSettings.adapters` near line 11, plus two inline `adapters:` overrides near lines 64 and 94). Delete the `copilot:` entry from each:

```tsx
    copilot: { enabled: false, exclusiveSkillsWithClaude: false },
```

and the two inline forms:

```tsx
adapters: { claude: { enabled: false }, copilot: { enabled: false, exclusiveSkillsWithClaude: false } },
```

become:

```tsx
adapters: { claude: { enabled: false } },
```

`tests/renderer/screens/settings/adapters-section.test.tsx` — 2 sites (`baseSettings.adapters` near line 10, and the inline override near line 41). Both are the single-line form; remove the `copilot:` entry so each reads:

```tsx
adapters: { claude: { enabled: true } },
```

and

```tsx
adapters: { claude: { enabled: false } },
```

`tests/renderer/screens/settings/linked-repos.test.tsx` — 1 site (`baseSettings.adapters` near line 11). Delete:

```tsx
    copilot: { enabled: false, exclusiveSkillsWithClaude: false },
```

- [ ] **Step 3: Run typecheck to verify it is green**

```bash
npm run typecheck
```

Expected: no output, exit code 0 (both `tsconfig.node.json` and `tsconfig.web.json` pass).

- [ ] **Step 4: Run the test suite (behavior unchanged)**

```bash
npm test 2>&1 | tail -3
```

Expected: all tests still pass. The `copilot` key was dead data (the Settings screen only renders `claude`), so removing it changes nothing at runtime.

- [ ] **Step 5: Confirm still Prettier-clean (small edits must not reintroduce drift)**

```bash
npx prettier --check .
```

Expected: `All matched files use Prettier code style!` (If it reports a file, run `npm run format` and re-stage — the edit was off-style.)

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/DetailDrawer.tsx \
        tests/renderer/bootstrap-router.test.tsx \
        tests/renderer/screens/settings.test.tsx \
        tests/renderer/screens/settings/adapters-section.test.tsx \
        tests/renderer/screens/settings/linked-repos.test.tsx
git commit -m "$(cat <<'EOF'
fix(types): clear typecheck errors (copilot fixtures + DetailDrawer slotProps)

- Drop stale `copilot` keys from Settings test fixtures (adapter removed in 1898c64).
- Extract DetailDrawer paper slotProps to a const so MUI v9's tightened SlotProps
  accepts the rendered data-testid without a cast.

No production behavior change; type-only fixes — tests were already green at runtime.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Lint → 0 (`fix(lint):` commit)

**Files:**

- Modify: `eslint.config.js`
- Modify: `src/main/application/schemas/plugin-manifest.schema.ts`
- Modify: `src/main/application/services/plugin-manifest-parser.ts`
- Modify: `src/main/application/services/plugin-publisher.ts`
- Modify: `src/renderer/screens/plugins/PublishPluginDialog.tsx`
- Modify: `tests/main/application/schemas/meta-file.schema.test.ts`
- Modify: `tests/main/application/schemas/plugin-manifest.schema.test.ts`
- Modify: `tests/main/application/services/customization-service.test.ts`
- Modify: `tests/main/application/services/plugin-installer.test.ts`
- Modify: `tests/main/application/services/plugin-publisher.test.ts`
- Modify: `tests/main/domain/plugin-id.test.ts`
- Modify: `tests/main/domain/plugin-ref.test.ts`

- [ ] **Step 1: Update `eslint.config.js` — honor the `^_` convention + scope-defer `set-state-in-effect`**

Two additions. First, insert a global rules block **immediately after** `...tseslint.configs.recommended,` so it overrides the recommended `no-unused-vars`. Second, insert the scoped `set-state-in-effect` warn block **after** the `src/renderer/**` block (so it wins for those two files) and **before** `prettier`.

Replace the whole file body:

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['out/**', 'node_modules/**', 'coverage/**', 'dist/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Honor the `_`-prefixed "intentionally unused" convention already used across
      // the codebase (interface-required params, key-omitting destructures, etc.).
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    ...react.configs.flat.recommended,
    languageOptions: {
      ...react.configs.flat.recommended.languageOptions,
      globals: {
        window: 'readonly',
        document: 'readonly',
      },
    },
    settings: { react: { version: 'detect' } },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
    },
  },
  {
    // DEFERRED (tracked follow-up): these dialogs initialize/reset form state inside an
    // effect on open. The correct fix (derive state, or remount via a `key`) is a
    // behavior-affecting refactor scheduled for its own PR. Downgraded to `warn` so the
    // mechanical tooling-baseline PR stays green without weakening the rule project-wide.
    files: [
      'src/renderer/screens/plugins/PublishPluginDialog.tsx',
      'src/renderer/screens/marketplaces/PluginInstallPreviewDialog.tsx',
    ],
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  prettier,
);
```

- [ ] **Step 2: Remove the dead `PluginManifest` import in `plugin-manifest.schema.ts`**

In `src/main/application/schemas/plugin-manifest.schema.ts`, delete line 4 entirely:

```ts
import type { PluginManifest } from '../../domain/plugin-manifest.js';
```

- [ ] **Step 3: Drop the unused caught binding in `plugin-manifest-parser.ts`**

In `src/main/application/services/plugin-manifest-parser.ts`, the `catch (err)` at the first try block (around line 16) does not use `err`. Use an optional catch binding. Replace:

```ts
    try {
      content = await this.fs.readFile(manifestPath);
    } catch (err) {
      throw new ManifestInvalidError(
```

with:

```ts
    try {
      content = await this.fs.readFile(manifestPath);
    } catch {
      throw new ManifestInvalidError(
```

> Leave the **second** `catch (err)` (the JSON.parse block, ~line 27) untouched — it uses `err`.

- [ ] **Step 4: Remove the dead `pat` destructure in `plugin-publisher.ts`**

In `src/main/application/services/plugin-publisher.ts`, the `ctx` destructuring (around line 232) binds `pat` but never uses it. Delete the `pat,` line from the destructure. Replace:

```ts
const { pluginDir, entry, meta, scope, version, commitMessage, pat, cache, git, githubApi, clock } =
  ctx;
```

with:

```ts
const { pluginDir, entry, meta, scope, version, commitMessage, cache, git, githubApi, clock } = ctx;
```

- [ ] **Step 5: Drop the unused caught binding in `PublishPluginDialog.tsx`**

In `src/renderer/screens/plugins/PublishPluginDialog.tsx`, the `checkGithubToken` catch (around line 60) does not use `err`. Replace:

```tsx
        const result = await callIpc<{ hasToken: boolean }>('credentials.hasGithubToken', {});
        setGithubTokenMissing(!result.hasToken);
      } catch (err) {
        // If check fails, assume token is missing for safety
        setGithubTokenMissing(true);
      }
```

with:

```tsx
        const result = await callIpc<{ hasToken: boolean }>('credentials.hasGithubToken', {});
        setGithubTokenMissing(!result.hasToken);
      } catch {
        // If check fails, assume token is missing for safety
        setGithubTokenMissing(true);
      }
```

> The two `set-state-in-effect` findings in this file (and the one in `PluginInstallPreviewDialog.tsx`) are handled by the scoped `warn` override from Step 1 — **do not** edit those effects here.

- [ ] **Step 6: Fix `meta-file.schema.test.ts` — replace two `any` casts**

In `tests/main/application/schemas/meta-file.schema.test.ts`, replace the two `as any` casts (around lines 180 and 193) with `Record<string, unknown>`. Replace:

```ts
expect((result.data as any)._comment).toBe('managed by plugin-registry');
```

with:

```ts
expect((result.data as Record<string, unknown>)._comment).toBe('managed by plugin-registry');
```

and replace:

```ts
expect((result.data.plugins.at(0) as any)?._extra).toBe(42);
```

with:

```ts
expect((result.data.plugins.at(0) as Record<string, unknown> | undefined)?._extra).toBe(42);
```

> The `_id` destructure at line 142 needs **no** edit — Step 1's `varsIgnorePattern: '^_'` covers it.

- [ ] **Step 7: Fix `plugin-manifest.schema.test.ts` — dead import + two `any` casts**

In `tests/main/application/schemas/plugin-manifest.schema.test.ts`, delete line 3:

```ts
import { PluginIdInvalidError } from '../../../../src/main/domain/plugin-errors.js';
```

Then replace the two `as any` casts (around lines 82–83):

```ts
expect((result.data as any).extra_field).toBe('value');
expect((result.data as any).another).toBe(42);
```

with:

```ts
expect((result.data as Record<string, unknown>).extra_field).toBe('value');
expect((result.data as Record<string, unknown>).another).toBe(42);
```

- [ ] **Step 8: Remove the dead `join` import in `customization-service.test.ts`**

In `tests/main/application/services/customization-service.test.ts`, delete line 1:

```ts
import { join } from 'node:path';
```

- [ ] **Step 9: Remove the dead `PluginId` type import in `plugin-installer.test.ts`**

In `tests/main/application/services/plugin-installer.test.ts`, delete line 6 (the value import `pluginId` on line 5 stays):

```ts
import type { PluginId } from '../../../../src/main/domain/plugin-id.js';
```

- [ ] **Step 10: Remove the dead `originalPush` assignment in `plugin-publisher.test.ts`**

In `tests/main/application/services/plugin-publisher.test.ts`, the `originalPush` binding (around line 247) is captured but never used (the test never restores `git.push`). Delete the line:

```ts
const originalPush = git.push.bind(git);
```

(Keep the `vi.spyOn(git, 'push').mockRejectedValue(...)` line that follows.)

- [ ] **Step 11: Remove the dead `PluginId` type import in `plugin-id.test.ts`**

In `tests/main/domain/plugin-id.test.ts`, delete line 2:

```ts
import type { PluginId } from '../../../src/main/domain/plugin-id.js';
```

- [ ] **Step 12: Remove the dead `PluginRef` type from the import in `plugin-ref.test.ts`**

In `tests/main/domain/plugin-ref.test.ts`, the import block starts:

```ts
import {
  type PluginRef,
  PluginRefInvalidError,
  pluginRefBranch,
  pluginRefTag,
```

Delete just the `type PluginRef,` line, leaving the rest of the import intact:

```ts
import {
  PluginRefInvalidError,
  pluginRefBranch,
  pluginRefTag,
```

- [ ] **Step 13: Run lint to verify 0 errors**

```bash
npm run lint
```

Expected: exit code 0. **Errors must be `0`.** Up to 3 `react-hooks/set-state-in-effect` **warnings** may appear (the deferred ones) — warnings are acceptable and do not fail `eslint .`. If you see any _error_, fix it before continuing.

- [ ] **Step 14: Re-run typecheck and tests (lint edits must not regress either)**

```bash
npm run typecheck && npm test 2>&1 | tail -3
```

Expected: typecheck exits 0; all 1023 tests pass.

- [ ] **Step 15: Confirm still Prettier-clean**

```bash
npx prettier --check .
```

Expected: `All matched files use Prettier code style!`

- [ ] **Step 16: Commit**

```bash
git add eslint.config.js \
        src/main/application/schemas/plugin-manifest.schema.ts \
        src/main/application/services/plugin-manifest-parser.ts \
        src/main/application/services/plugin-publisher.ts \
        src/renderer/screens/plugins/PublishPluginDialog.tsx \
        tests/main/application/schemas/meta-file.schema.test.ts \
        tests/main/application/schemas/plugin-manifest.schema.test.ts \
        tests/main/application/services/customization-service.test.ts \
        tests/main/application/services/plugin-installer.test.ts \
        tests/main/application/services/plugin-publisher.test.ts \
        tests/main/domain/plugin-id.test.ts \
        tests/main/domain/plugin-ref.test.ts
git commit -m "$(cat <<'EOF'
fix(lint): clear all eslint errors

- Add no-unused-vars ignore patterns for the `_`-prefixed convention already in use.
- Remove dead imports/bindings (PluginManifest, join, PluginId, PluginRef,
  PluginIdInvalidError, originalPush, pat) and unused catch bindings.
- Replace `as any` test casts with `Record<string, unknown>`.
- Scope-defer react-hooks/set-state-in-effect to `warn` for two dialogs (form-init
  effect refactor tracked as a follow-up PR).

No production behavior change.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Measure and record coverage (no commit)

**Files:** none (measurement only).

Per the spec, PR 1 **measures and records** coverage; it does **not** chase the 80/70 gate.

- [ ] **Step 1: Run coverage**

```bash
npx vitest run --coverage 2>&1 | tail -25
```

Expected: all tests pass; a coverage table prints. The run **may exit non-zero** because `vitest.config.ts` enforces 80/70 thresholds and the tree is below them — that is expected and pre-existing (`npm test` itself does not check coverage, so the green test gate is unaffected). Record the **All files** `% Stmts` and `% Branch` (baseline ≈ 72.84% stmts / 62.23% branches).

- [ ] **Step 2: Note the numbers for the PR description**

Write down the measured `% Stmts` / `% Branch` — they go verbatim into the PR body in Task 5. Do not edit thresholds or add tests in this PR.

---

## Task 5: Final verification and PR

**Files:** none (verification + PR).

- [ ] **Step 1: Run the full gate one last time**

```bash
npx prettier --check . && npm run typecheck && npm run lint && npm test 2>&1 | tail -3
```

Expected, in order:

- `All matched files use Prettier code style!`
- typecheck: exit 0, no output
- lint: exit 0 (0 errors; ≤3 `set-state-in-effect` warnings allowed)
- tests: all 1023 pass

> Per superpowers:verification-before-completion — do not claim done until you have **seen** this output. If any gate is red, return to the owning task.

- [ ] **Step 2: Review the diff is mechanical-only**

```bash
git diff main --stat
git log --oneline main..HEAD
```

Expected: 3 commits (`style:`, `fix(types):`, `fix(lint):`); the only non-format, non-test production edits are `DetailDrawer.tsx`, `plugin-manifest.schema.ts`, `plugin-manifest-parser.ts`, `plugin-publisher.ts`, `PublishPluginDialog.tsx`, and `eslint.config.js`.

- [ ] **Step 3: Push and open the PR** (confirm with the user first — outward, hard-to-reverse)

```bash
git push -u origin chore/tooling-baseline
gh pr create --base main --title "chore: tooling baseline (format + typecheck + lint)" --body "$(cat <<'EOF'
## What

PR 1 of the refinement refactor (see `docs/superpowers/specs/2026-06-05-refinement-refactor-design.md`). Mechanical tooling baseline, in three bisectable commits:

1. `style:` — `npm run format` across the tree (no logic change).
2. `fix(types):` — typecheck 8 → 0 (drop stale `copilot` fixtures; `DetailDrawer` slotProps).
3. `fix(lint):` — lint 30 → 0 (ignore `^_`; remove dead imports/bindings; `any` → `Record<string, unknown>`; scope-defer `set-state-in-effect`).

## Coverage (measured, not chased)

- Statements: <FILL FROM TASK 4>%
- Branches: <FILL FROM TASK 4>%

Below the 80/70 gate; deferred per the spec (revisit after the god-file splits).

## Deferred follow-up

`react-hooks/set-state-in-effect` is scoped to `warn` for `PublishPluginDialog.tsx` and `PluginInstallPreviewDialog.tsx`. The proper effect refactor (derive state / remount via `key`) is its own PR; remove the scoped override then.

## Verification

`prettier --check .` clean · `npm run typecheck` green · `npm run lint` green (0 errors) · all 1023 tests pass.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Record the deferred follow-up so it is not lost**

The `set-state-in-effect` refactor is now a real obligation referenced in code (`eslint.config.js` scoped override) and in the PR body. Capture it where the team tracks follow-ups (issue tracker, or an auto-memory note alongside the existing `gi-last-write-wins-followup`). Suggested text:

> _Refactor form-init effects in `PublishPluginDialog` / `PluginInstallPreviewDialog` to satisfy `react-hooks/set-state-in-effect`, then remove the scoped `warn` override added in the tooling-baseline PR._

---

## Self-Review (done while writing — recorded for the executor)

- **Spec coverage:** PR 1 step 1 (format) → Task 1. Step 2 (typecheck: 7 copilot + 1 DetailDrawer) → Task 2. Step 3 (lint 30 → 0) → Task 3. Step 4 (coverage measure-only) → Task 4. Success criteria (`prettier --check` / typecheck / lint / tests / coverage recorded) → Task 5 Step 1 + Task 4. ✓
- **Placeholder scan:** every code step shows exact before/after. The only `<FILL …>` is the coverage number, which is produced in Task 4 and is intentionally measured at execution time. ✓
- **Type/name consistency:** `paperSlotProps` (Task 2) is the same const referenced in `slotProps={{ paper: paperSlotProps }}`. ESLint keys (`argsIgnorePattern`/`varsIgnorePattern`/`caughtErrorsIgnorePattern`, `react-hooks/set-state-in-effect`) match across Task 3 Step 1 and the verification expectations. ✓
- **Spec discrepancy surfaced:** the 17-in-production lint reality and the 3 `set-state-in-effect` deferral are documented up front and resolved by the agreed scoped-warn approach. ✓
