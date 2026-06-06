# Architecture Remediation (P1 + Dead Code + Doc Drift) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden `superset-ai-app` for release by fixing the three P1 risks (unguarded boot, validation errors disguised as `internal`, unvalidated marketplace IPC payloads), deleting verified dead code, and correcting the drifted architecture doc — delivered as one PR of six green commits.

**Architecture:** Pure remediation, no behaviour additions. Changes are confined to the `main` process (`domain/`, `application/services/`, `ipc/`), a doc rewrite under `docs/reference/`, and the deletion of one orphan renderer component. The error fixes route domain-meaningful failures (`validation`, `not_found`) through the existing `DomainError → IpcError.kind` channel in `ipc/dispatcher.ts` instead of leaking as `kind: 'internal'`. No IPC method signatures change; no renderer behaviour changes.

**Tech Stack:** Electron + TypeScript (strict: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`) + Vitest (node + jsdom projects). Imports use `.js` extensions on relative paths. Conventional Commits with the `Co-Authored-By` trailer.

---

## How to use this plan

- **Six tasks → six commits.** Each task ends green on `npm run lint && npm run typecheck && npm test`.
- **TDD where it fits.** Tasks 2, 3, 4 are driven by failing tests first. Task 1 (Electron boot lifecycle) and Task 6 (doc) carry an explicit **Manual QA / verification** step instead of a unit test, per the project's "TDD where it fits, skip it where it doesn't" rule. Task 5 (deletion) is verified by the existing suite staying green.
- **Run a single test file:** `npx vitest run <path>`. Whole suite: `npm test`.
- **Strict TS reminder:** `arr[0]` is `T | undefined`; optional props don't accept explicit `undefined` unless typed `T | undefined`.
- **Branch first** (currently on `main`).

## Decisions locked before planning

1. **`*IdInvalidError` migration target:** they become subclasses of `DomainError` with `kind: 'validation'`, passing `details` straight to `super(...)` (do **not** redeclare a `details` field — `tests/main/domain/skill-id.test.ts:56` reads `err.details?.raw` and that keeps working via the base class). The `name` property is preserved for diagnostics.
2. **Dead code scope:** delete only what grep proved unused — the five entity-repository **ports** + their four `Fs*` impls, plus the orphan `EntityViewer.tsx`. `FileSystemMutator` is **NOT** dead (used by `workspace-bootstrap.ts`) — leave it.
3. **Marketplace validation depth:** validate exactly the fields that today crash via non-null assertions in `cloneMarketplaceSource` (`url`/`path`/`repo` per discriminant). Do not over-validate optional metadata.
4. **Out of scope (separate future plans):** P2.2 generic `TypedCustomizationFacade<T>`, P2.3 typed `IpcMethod` contract, P2.4 `useSettings()` react-query migration, P3 hex-literal tokenization, renderer test coverage. These are independent subsystems and each deserves its own plan.

---

## File Structure

### Created

| Path                                             | Responsibility                                                                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `tests/main/domain/customization-errors.test.ts` | Pins that every `*IdInvalidError` is a `DomainError` with `kind: 'validation'` and preserves `name` + `details.raw`. |

### Modified

| Path                                                          | Change                                                                   |
| ------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `src/main/index.ts`                                           | Wrap `wireIpc()` boot in `try/catch` → fatal dialog + `app.quit()`.      |
| `src/main/domain/customization-errors.ts`                     | All six errors `extends DomainError` (`kind: 'validation'`).             |
| `src/main/application/services/hook-service.ts:42`            | `new Error('Hook not found…')` → `DomainError('not_found', …)`.          |
| `src/main/application/services/plugin-service.ts:321,389,403` | `not_found` for missing plugin (×2), `validation` for non-branch update. |
| `src/main/ipc/_validators.ts`                                 | Add `asMarketplacePlugin(value, label)`.                                 |
| `src/main/ipc/plugin-handlers.ts:85,96`                       | Use `asMarketplacePlugin` instead of `as MarketplacePlugin`.             |
| `tests/main/ipc/plugin-handlers.test.ts`                      | Add malformed-source rejection cases.                                    |
| `tests/main/application/services/hook-service.test.ts`        | Assert `get` of missing hook throws `kind: 'not_found'`.                 |
| `tests/main/application/services/plugin-service.test.ts`      | Assert `get`/`update` not-found + non-branch update kinds.               |
| `docs/reference/architecture.md`                              | Correct all drifted paths/claims (see Task 6).                           |

### Deleted (verified zero importers, zero tests)

- `src/main/application/ports/skill-repository.ts`
- `src/main/application/ports/agent-repository.ts`
- `src/main/application/ports/command-repository.ts`
- `src/main/application/ports/global-instruction-repository.ts`
- `src/main/application/ports/hook-repository.ts`
- `src/main/infrastructure/customization/fs-skill-repository.ts`
- `src/main/infrastructure/customization/fs-agent-repository.ts`
- `src/main/infrastructure/customization/fs-command-repository.ts`
- `src/main/infrastructure/customization/fs-global-instruction-repository.ts`
- `src/renderer/components/EntityViewer.tsx`

---

## Task 0: Branch

- [ ] **Step 1: Create the working branch**

Run:

```bash
git checkout -b chore/architecture-remediation
```

Expected: `Switched to a new branch 'chore/architecture-remediation'`

- [ ] **Step 2: Confirm the gate is green before any change**

Run: `npm run lint && npm run typecheck && npm test`
Expected: lint exit 0, typecheck exit 0, `Tests 1107 passed`. (Baseline — if not green, stop and investigate before proceeding.)

---

## Task 1: Guard the boot sequence

**Why:** `src/main/index.ts` ends with `void app.whenReady().then(async () => { await wireIpc(); … })` — no `.catch()`. A first-run failure in `WorkspaceBootstrap` or `MarketplaceSeeder` becomes an unhandled rejection and the window opens in an inconsistent state with no message. This is an Electron lifecycle concern, not unit-testable cheaply, so it is verified by **Manual QA**.

**Files:**

- Modify: `src/main/index.ts` (final `app.whenReady()` block)

- [ ] **Step 1: Add a fatal-boot reporter and wrap the boot**

Replace the final block:

```ts
void app.whenReady().then(async () => {
  await wireIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
```

with:

```ts
function reportFatalBootError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[boot] fatal error during startup:', error);
  dialog.showErrorBox(
    'Superset AI failed to start',
    `The app could not finish initializing and will now close.\n\n${message}`,
  );
  app.quit();
}

void app.whenReady().then(async () => {
  try {
    await wireIpc();
  } catch (error) {
    reportFatalBootError(error);
    return;
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
```

- [ ] **Step 2: Import `dialog` from electron**

In `src/main/index.ts:1`, change:

```ts
import { app, BrowserWindow, ipcMain } from 'electron';
```

to:

```ts
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
```

- [ ] **Step 3: Verify the gate**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all green, still `1107 passed` (no test touches this path).

- [ ] **Step 4: Manual QA (boot failure path)**

Temporarily force a throw at the top of `wireIpc()` (e.g. `throw new Error('boot smoke test');` as the first line of the function), then run `npm run dev`.
Expected: a native error dialog titled "Superset AI failed to start" appears, and the app quits instead of opening a blank window.
Then **remove** the temporary throw and confirm `npm run dev` boots normally.

- [ ] **Step 5: Commit**

```bash
git add src/main/index.ts
git commit -m "fix(main): report and exit on fatal boot errors

Wrap wireIpc() in try/catch so a first-run bootstrap/seeder failure
surfaces a native dialog and quits cleanly instead of leaving the
window in an inconsistent state."
```

---

## Task 2: `*IdInvalidError` become `DomainError('validation')`

**Why:** All six errors in `customization-errors.ts` extend plain `Error`. When thrown through an IPC handler, `dispatcher.ts` maps them to `kind: 'internal'` — the renderer cannot tell "invalid ID" from "crash". They must carry `kind: 'validation'`.

**Files:**

- Create: `tests/main/domain/customization-errors.test.ts`
- Modify: `src/main/domain/customization-errors.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/main/domain/customization-errors.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../src/main/domain/errors.js';
import {
  SkillIdInvalidError,
  AgentIdInvalidError,
  CommandIdInvalidError,
  HookIdInvalidError,
  GlobalInstructionIdInvalidError,
  MarketplaceIdInvalidError,
} from '../../../src/main/domain/customization-errors.js';

const CASES = [
  ['SkillIdInvalidError', SkillIdInvalidError],
  ['AgentIdInvalidError', AgentIdInvalidError],
  ['CommandIdInvalidError', CommandIdInvalidError],
  ['HookIdInvalidError', HookIdInvalidError],
  ['GlobalInstructionIdInvalidError', GlobalInstructionIdInvalidError],
  ['MarketplaceIdInvalidError', MarketplaceIdInvalidError],
] as const;

describe('customization id errors', () => {
  for (const [name, Ctor] of CASES) {
    it(`${name} is a validation DomainError carrying name + details`, () => {
      const err = new Ctor('bad id', { raw: 'Bad' });
      expect(err).toBeInstanceOf(DomainError);
      expect(err).toBeInstanceOf(Error);
      expect(err.kind).toBe('validation');
      expect(err.name).toBe(name);
      expect(err.message).toBe('bad id');
      expect(err.details?.raw).toBe('Bad');
    });
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/main/domain/customization-errors.test.ts`
Expected: FAIL — `err.kind` is `undefined` (errors still extend `Error`).

- [ ] **Step 3: Rewrite the errors to extend `DomainError`**

Replace the entire contents of `src/main/domain/customization-errors.ts`:

```ts
import { DomainError } from './errors.js';

export class SkillIdInvalidError extends DomainError {
  constructor(message: string, details?: { raw?: string }) {
    super('validation', message, details);
    this.name = 'SkillIdInvalidError';
  }
}

export class AgentIdInvalidError extends DomainError {
  constructor(message: string, details?: { raw?: string }) {
    super('validation', message, details);
    this.name = 'AgentIdInvalidError';
  }
}

export class CommandIdInvalidError extends DomainError {
  constructor(message: string, details?: { raw?: string }) {
    super('validation', message, details);
    this.name = 'CommandIdInvalidError';
  }
}

export class HookIdInvalidError extends DomainError {
  constructor(message: string, details?: { raw?: string }) {
    super('validation', message, details);
    this.name = 'HookIdInvalidError';
  }
}

export class GlobalInstructionIdInvalidError extends DomainError {
  constructor(message: string, details?: { raw?: string }) {
    super('validation', message, details);
    this.name = 'GlobalInstructionIdInvalidError';
  }
}

export class MarketplaceIdInvalidError extends DomainError {
  constructor(message: string, details?: { raw?: string }) {
    super('validation', message, details);
    this.name = 'MarketplaceIdInvalidError';
  }
}
```

- [ ] **Step 4: Run the new test + the id value-object tests**

Run: `npx vitest run tests/main/domain/customization-errors.test.ts tests/main/domain/skill-id.test.ts tests/main/domain/command-id.test.ts`
Expected: PASS. (`skill-id.test.ts:56`/`command-id.test.ts:56` read `err.details?.raw` — still works via the base class; `instanceof SkillIdInvalidError` still holds.)

- [ ] **Step 5: Run the full gate**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/main/domain/customization-errors.ts tests/main/domain/customization-errors.test.ts
git commit -m "fix(domain): make id-invalid errors validation DomainErrors

The six *IdInvalidError types extended plain Error, so IPC mapped them
to kind:'internal'. They now extend DomainError('validation') and reach
the renderer with the correct kind while preserving name and details."
```

---

## Task 3: Route service "not found" / "invalid" through `DomainError`

**Why:** `HookService.get` and `PluginService.get`/`update` throw plain `new Error(...)` for semantically clear `not_found` / `validation` cases, surfacing as `kind: 'internal'`.

**Files:**

- Modify: `src/main/application/services/hook-service.ts:42`
- Modify: `src/main/application/services/plugin-service.ts:321,389,403`
- Modify: `tests/main/application/services/hook-service.test.ts`
- Modify: `tests/main/application/services/plugin-service.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/main/application/services/hook-service.test.ts` (inside the top-level `describe`):

```ts
it('get() throws a not_found DomainError for a missing hook', async () => {
  const service = new HookService(new FakeClaudeSettingsPort());
  await expect(service.get({ id: 'does-not-exist' as never })).rejects.toMatchObject({
    kind: 'not_found',
  });
});
```

> If `FakeClaudeSettingsPort` is not already imported in this file, add `import { FakeClaudeSettingsPort } from '../../../../src/main/application/services/__fixtures__/fake-claude-settings-port.js';` and adjust the relative depth to match the existing imports in the file.

Append to `tests/main/application/services/plugin-service.test.ts` (inside the suite, reusing whatever fake-deps factory the file already defines — referred to here as `makeService()`):

```ts
it('get() throws not_found for an unknown plugin', async () => {
  const service = makeService();
  await expect(service.get('ghost' as never, 'personal')).rejects.toMatchObject({
    kind: 'not_found',
  });
});

it('update() throws not_found for an unknown plugin', async () => {
  const service = makeService();
  await expect(service.update('ghost' as never, 'personal')).rejects.toMatchObject({
    kind: 'not_found',
  });
});
```

> Replace `makeService()` with the file's existing constructor/helper. If the file builds the service inline per-test, copy that construction here.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/main/application/services/hook-service.test.ts tests/main/application/services/plugin-service.test.ts`
Expected: FAIL — thrown errors have no `kind` (plain `Error`).

- [ ] **Step 3: Fix `HookService.get`**

In `src/main/application/services/hook-service.ts`, add the import near the existing domain imports (after line 13):

```ts
import { DomainError } from '../../domain/errors.js';
```

Change line 42 from:

```ts
if (!found) throw new Error(`Hook not found: ${input.id}`);
```

to:

```ts
if (!found) {
  throw new DomainError('not_found', `Hook not found: ${input.id}`, {
    id: input.id,
  });
}
```

- [ ] **Step 4: Fix `PluginService.get` and `update`**

In `src/main/application/services/plugin-service.ts`, ensure `DomainError` is imported (add `import { DomainError } from '../../domain/errors.js';` alongside the existing domain imports if absent).

Change line 321 from:

```ts
throw new Error(`Plugin '${id}' not found in ${scope} scope`);
```

to:

```ts
throw new DomainError('not_found', `Plugin '${id}' not found in ${scope} scope`, {
  id,
  scope,
});
```

Change line 389 from:

```ts
throw new Error(`Plugin '${id}' not found in ${scope} scope`);
```

to:

```ts
throw new DomainError('not_found', `Plugin '${id}' not found in ${scope} scope`, {
  id,
  scope,
});
```

Change the non-branch guard at line 402-405 from:

```ts
throw new Error(
  `Can only update plugins pinned to a branch (plugin '${id}' is pinned to ${entry.installedRef?.kind ?? 'nothing'})`,
);
```

to:

```ts
throw new DomainError(
  'validation',
  `Can only update plugins pinned to a branch (plugin '${id}' is pinned to ${entry.installedRef?.kind ?? 'nothing'})`,
  { id, pinnedTo: entry.installedRef?.kind ?? 'nothing' },
);
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/main/application/services/hook-service.test.ts tests/main/application/services/plugin-service.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the full gate**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add src/main/application/services/hook-service.ts src/main/application/services/plugin-service.ts tests/main/application/services/hook-service.test.ts tests/main/application/services/plugin-service.test.ts
git commit -m "fix(services): use DomainError for hook/plugin not_found + invalid update

HookService.get and PluginService.get/update threw plain Errors for
not_found and validation cases, which IPC mapped to kind:'internal'.
They now throw DomainError so the renderer receives the right kind."
```

---

## Task 4: Validate marketplace plugin payloads at the IPC boundary

**Why:** `plugin-handlers.ts:85,96` cast `raw['plugin'] as MarketplacePlugin` with no validation. A payload whose `source` is missing `url`/`path`/`repo` reaches `cloneMarketplaceSource` (`plugin-service.ts:571,572,581,588`) where non-null assertions (`s.url!`) produce a raw `TypeError` → `kind: 'internal'`. We validate the discriminant's required fields at the boundary and throw `DomainError('validation')`.

**Files:**

- Modify: `src/main/ipc/_validators.ts`
- Modify: `src/main/ipc/plugin-handlers.ts`
- Modify: `tests/main/ipc/plugin-handlers.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/main/ipc/plugin-handlers.test.ts`. Reuse the file's existing `buildPluginHandlers(fakeService)` setup (the file already constructs handlers with a fake `PluginService`; refer to that instance as `handlers`):

```ts
it('rejects installFromMarketplace when git-subdir source lacks url', async () => {
  await expect(
    handlers['plugin.installFromMarketplace']?.({
      plugin: {
        name: 'p',
        description: 'd',
        source: { source: 'git-subdir', path: 'pkg' },
      },
      scope: 'personal',
    }),
  ).rejects.toMatchObject({ kind: 'validation' });
});

it('rejects installFromMarketplace when github source lacks repo', async () => {
  await expect(
    handlers['plugin.installFromMarketplace']?.({
      plugin: { name: 'p', description: 'd', source: { source: 'github' } },
      scope: 'personal',
    }),
  ).rejects.toMatchObject({ kind: 'validation' });
});

it('rejects previewFromMarketplace when source object lacks discriminant', async () => {
  await expect(
    handlers['plugin.previewFromMarketplace']?.({
      plugin: { name: 'p', description: 'd', source: {} },
    }),
  ).rejects.toMatchObject({ kind: 'validation' });
});

it('accepts a well-formed url source', async () => {
  const result = await handlers['plugin.previewFromMarketplace']?.({
    plugin: {
      name: 'p',
      description: 'd',
      source: { source: 'url', url: 'https://example.com/p.tar.gz' },
    },
  });
  expect(result).toBeDefined(); // delegated to the fake service, no throw
});
```

> If the existing tests build handlers inside each `it` rather than a shared `handlers`, mirror that local construction in these new cases.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/main/ipc/plugin-handlers.test.ts`
Expected: FAIL — current code casts without validation, so the malformed cases reach the fake service (or throw a non-`kind` `TypeError`) instead of a `validation` `DomainError`.

- [ ] **Step 3: Add the validator**

In `src/main/ipc/_validators.ts`, add the import at the top (after line 3):

```ts
import type { MarketplacePlugin } from '../domain/marketplace-manifest.js';
```

and append this function:

```ts
export function asMarketplacePlugin(value: unknown, label: string): MarketplacePlugin {
  const obj = asObject(value, label);
  const src = obj['source'];

  if (typeof src !== 'string') {
    const s = asObject(src, `${label}.source`);
    const kind = s['source'];
    if (typeof kind !== 'string' || kind.length === 0) {
      throw new DomainError(
        'validation',
        `Invalid '${label}.source': missing 'source' discriminant`,
      );
    }

    const requireField = (field: string): void => {
      const v = s[field];
      if (typeof v !== 'string' || v.length === 0) {
        throw new DomainError(
          'validation',
          `Invalid '${label}.source' of kind '${kind}': missing '${field}'`,
        );
      }
    };

    if (kind === 'git-subdir') {
      requireField('url');
      requireField('path');
    } else if (kind === 'url' || kind === 'git') {
      requireField('url');
    } else if (kind === 'github') {
      requireField('repo');
    }
  }

  return obj as MarketplacePlugin;
}
```

- [ ] **Step 4: Use the validator in the handlers**

In `src/main/ipc/plugin-handlers.ts:8`, add `asMarketplacePlugin` to the import:

```ts
import {
  asBoolean,
  asMarketplacePlugin,
  asObject,
  asScope,
  asString,
  optParams,
} from './_validators.js';
```

Change line 85 from:

```ts
const plugin = raw['plugin'] as MarketplacePlugin;
```

to:

```ts
const plugin = asMarketplacePlugin(raw['plugin'], 'plugin');
```

Change line 96 from:

```ts
const plugin = raw['plugin'] as MarketplacePlugin;
```

to:

```ts
const plugin = asMarketplacePlugin(raw['plugin'], 'plugin');
```

> The `import type { MarketplacePlugin }` on line 3 is now unused — remove it to satisfy `verbatimModuleSyntax`/lint.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/main/ipc/plugin-handlers.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the full gate**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add src/main/ipc/_validators.ts src/main/ipc/plugin-handlers.ts tests/main/ipc/plugin-handlers.test.ts
git commit -m "fix(ipc): validate marketplace plugin source at the boundary

installFromMarketplace/previewFromMarketplace cast the plugin payload
without validation, so a malformed source crashed with a raw TypeError
(kind:internal) deep in cloneMarketplaceSource. Add asMarketplacePlugin
to reject missing url/path/repo with kind:validation up front."
```

---

## Task 5: Delete verified dead code

**Why:** grep proved zero importers (outside their own files) and zero tests for the five entity-repository ports, their four `Fs*` impls, and the orphan `EntityViewer.tsx`. They confuse the mental model ("which port backs SkillService?" — none; it uses `CustomizationService`). `FileSystemMutator` is intentionally left (used by `workspace-bootstrap.ts`).

**Files:** see "Deleted" list in File Structure.

- [ ] **Step 1: Re-confirm nothing imports the targets (guard against drift since planning)**

Run:

```bash
grep -rn "skill-repository\|agent-repository\|command-repository\|global-instruction-repository\|hook-repository\|EntityViewer" src tests --include='*.ts' --include='*.tsx' \
  | grep -v -E "fs-(skill|agent|command|global-instruction)-repository\.ts:|/(skill|agent|command|global-instruction|hook)-repository\.ts:|components/EntityViewer\.tsx:"
```

Expected: **no output**. (Any hit means a live importer appeared — stop and reassess before deleting.)

- [ ] **Step 2: Delete the files**

Run:

```bash
git rm \
  src/main/application/ports/skill-repository.ts \
  src/main/application/ports/agent-repository.ts \
  src/main/application/ports/command-repository.ts \
  src/main/application/ports/global-instruction-repository.ts \
  src/main/application/ports/hook-repository.ts \
  src/main/infrastructure/customization/fs-skill-repository.ts \
  src/main/infrastructure/customization/fs-agent-repository.ts \
  src/main/infrastructure/customization/fs-command-repository.ts \
  src/main/infrastructure/customization/fs-global-instruction-repository.ts \
  src/renderer/components/EntityViewer.tsx
```

Expected: 10 `rm` lines.

- [ ] **Step 3: Verify the gate (the deletion's proof of safety)**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all green, still `1107 passed` — nothing referenced the deleted files.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: remove dead entity-repository ports/impls and orphan EntityViewer

The per-entity *Repository ports and their Fs* implementations were
superseded by the CustomizationService-backed facades and imported by
nothing. EntityViewer.tsx had no caller. FileSystemMutator is retained
(used by WorkspaceBootstrapService)."
```

---

## Task 6: Correct the drifted architecture doc

**Why:** `CLAUDE.md` designates `docs/reference/architecture.md` the source of truth, but it describes files/dirs that no longer exist — actively misleading new contributors. This is the highest-ROI fix: cheap, high impact.

**Files:**

- Modify: `docs/reference/architecture.md`

- [ ] **Step 1: Apply these corrections**

Edit `docs/reference/architecture.md` so each drifted claim matches reality:

1. **Remove `search-service`** from the "Cross-cutting" services list (line ~57) — it does not exist.
2. **Plugin services are flat:** change "Core services — located at `src/main/application/services/plugins/`" to "located at `src/main/application/services/` (flat, not nested)".
3. **Plugin adapters are flat:** change "Core adapters — located at `src/main/infrastructure/adapters/plugins/`" to "located across `src/main/infrastructure/{git,github,plugins,settings,credentials}/`". (`claude-adapter.ts`/`claude-plugin-adapter.ts` live in `infrastructure/adapters/`; the plugin lifecycle adapters do not.)
4. **Git client:** change "`SimpleGitClient` (GitPort) — wraps **nodegit**" to "wraps **simple-git**".
5. **Renderer structure block (lines ~76-90):** replace the stale tree with the real one:
   ```
   src/renderer/
   ├── App.tsx                 # View union: loading | main | settings | io-error
   ├── main.tsx
   ├── screens/                # Main.tsx routes by Nav; per-entity dirs:
   │   ├── skills/ agents/ commands/ hooks/ global-instructions/
   │   ├── plugins/ marketplaces/ health/ starter-pack/ settings/
   │   └── IoError.tsx
   ├── components/             # ds/ (design system), shell/ (TopNav, SubRail, CommandPalette), EntityDataGrid/
   ├── hooks/                  # react-query data hooks
   └── lib/                    # ipc.ts, query-client.ts, theme-mode-context.tsx
   ```
   Remove the references to `Onboarding.tsx` and `screens/customizations/` (neither exists).
6. **Data-flow example (lines ~92-100):** replace the `customization.create` example with a current namespace, e.g. `callIpc('skill.create', payload)` → `skill-handlers.ts` → `SkillService`. Note the `customization.*` namespace was removed.
7. **Navigation note:** add one line under Renderer — "Navigation is state-driven via a `Nav` discriminated union in `components/shell/nav.ts` (areas: biblioteca, plugins, …); `Main.tsx` maps `Nav` to a screen. No `react-router`."

- [ ] **Step 2: Verify every path the doc now names actually exists**

Run:

```bash
cd /Users/odenirgomes/Projects/ogs-tech/internal/superset-ai-app
for p in \
  src/main/application/services \
  src/main/infrastructure/adapters/claude-adapter.ts \
  src/main/infrastructure/git src/main/infrastructure/github \
  src/main/infrastructure/plugins src/main/infrastructure/credentials \
  src/renderer/components/shell/nav.ts src/renderer/screens/Main.tsx \
  src/main/ipc/skill-handlers.ts; do
  [ -e "$p" ] && echo "OK  $p" || echo "MISSING $p"
done
grep -in "nodegit\|search-service\|Onboarding\|services/plugins/\|adapters/plugins/\|customization\.create" docs/reference/architecture.md \
  && echo "!! stale reference still present" || echo "no stale references"
```

Expected: all `OK`, and `no stale references`.

- [ ] **Step 3: Commit**

```bash
git add docs/reference/architecture.md
git commit -m "docs(architecture): correct drift vs real structure

Remove non-existent search-service, fix nodegit->simple-git, flatten the
plugin services/adapters paths, replace the stale renderer tree and the
removed customization.create data-flow example with the real Nav/typed
namespaces."
```

---

## Self-Review

**1. Spec coverage (diagnostic → tasks):**

- P1.1 boot guard → Task 1 ✓
- P1.2 marketplace validation → Task 4 ✓
- P1.3 error hierarchy (ids + service throws) → Tasks 2 & 3 ✓
- P2.1 dead ports/impls → Task 5 ✓
- P3 orphan `EntityViewer` → Task 5 ✓
- §4 doc drift → Task 6 ✓
- Deferred (P2.2/P2.3/P2.4, hex tokens, renderer tests): explicitly out of scope, recorded in "Decisions locked" #4. ✓

**2. Placeholder scan:** No "TBD/handle edge cases/similar to". Two steps reference file-local helpers the engineer must reuse (`makeService()` in plugin-service tests, the existing `handlers`/fake setup in plugin-handlers tests) — flagged inline with a `>` note because the exact name belongs to a test file not safe to guess; the engineer adapts to the local name. Acceptable per "follow established patterns".

**3. Type consistency:** `asMarketplacePlugin(value, label)` defined in Task 4 Step 3, used with that signature in Step 4 and the tests. `DomainError('validation' | 'not_found', message, details?)` matches `errors.ts:9`. `reportFatalBootError(error: unknown)` defined and used in Task 1. `details.raw` access verified against base-class `details: Record<string,unknown> | undefined`. The `import type { MarketplacePlugin }` removal in plugin-handlers (Task 4 Step 4) prevents an unused-import lint failure under `verbatimModuleSyntax`.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-06-architecture-remediation.md`. Two execution options:

1. **Subagent-Driven (recommended)** — a fresh subagent per task, two-stage review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session with checkpoints for review.

Which approach?
