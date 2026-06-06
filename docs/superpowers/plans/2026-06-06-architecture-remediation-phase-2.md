# Architecture Remediation — Phase 2 (Backlog + Bookkeeping) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clear the well-bounded structural-debt items surfaced by the 2026-06-06 architecture diagnosis — fix the one real hexagonal layering violation, delete dead code, dedupe the three near-identical customization facades, tighten the coverage ratchet, and keep the docs/records in sync.

**Architecture:** Electron app, hexagonal split inside `src/main/` (`domain` → `application/{ports,services,schemas}` → `infrastructure` → `ipc`). Services must depend only inward (ports/domain), never on concrete I/O. This plan moves a misfiled pure function inward, removes orphans, and extracts shared facade logic — all behavior-preserving, proven by the existing test suite as a characterization net.

**Tech Stack:** TypeScript (max-strict: `verbatimModuleSyntax`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), Vitest (node + jsdom projects), ESM with `.js` import extensions.

**Scope note (read before starting):** This plan covers the four _bounded, high-confidence_ backlog items (hex fix, dead-code removal, facade dedupe, coverage ratchet) plus bookkeeping. Three larger items from the diagnosis are deliberately **out of scope** and each warrants its own plan — see "Follow-up plans (out of scope)" at the end: typed IPC contract (P2.3), `Settings.tsx` react-query migration (P2.4), and raising coverage to the 80/70 target (needs new tests, not just a ratchet bump).

**Sequencing rationale:** Task 1 (hex fix) is a prerequisite for Task 3 — once the parser lives in `application/`, the facade helpers can import it cleanly. Task 2 (delete orphans) runs before Task 4 (coverage) because the orphan renderer dialogs live under `src/renderer/screens/**` (inside the coverage `include`) with no tests, so removing them _raises_ the measured baseline that Task 4 locks in.

**Gate commands (used throughout):**

- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Full suite: `npm test`
- Single file: `npx vitest run <path>`
- Coverage: `npx vitest run --coverage`

---

## File structure (what changes)

| File                                                                          | Responsibility                                            | Change                                                                |
| ----------------------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------- |
| `src/main/application/markdown/frontmatter.ts`                                | Pure Markdown+YAML frontmatter parse/serialize            | **Create** (moved from infrastructure)                                |
| `src/main/infrastructure/markdown/frontmatter.ts`                             | (old location)                                            | **Delete** (via `git mv`)                                             |
| `src/main/application/services/{skill,agent,command}-service.ts`              | Per-entity facades                                        | **Modify** — update import; later call shared helpers                 |
| `src/main/infrastructure/customization/fs-customization-repository.ts`        | FS adapter for customizations                             | **Modify** — update import path                                       |
| `tests/main/.../customization-service.global-instruction-save.test.ts`        | parser test consumer                                      | **Modify** — update import path                                       |
| `tests/main/infrastructure/customization/fs-customization-repository.test.ts` | repo test consumer                                        | **Modify** — update import path                                       |
| `src/main/application/services/customization-plugin-helpers.ts`               | Shared plugin-collection + plugin-guard logic for facades | **Create**                                                            |
| `src/main/application/ports/path-prober.ts`                                   | (orphan port)                                             | **Delete**                                                            |
| `src/main/infrastructure/adapters/claude-plugin-adapter.ts`                   | (orphan adapter, wired nowhere)                           | **Delete**                                                            |
| `tests/main/infrastructure/adapters/__tests__/claude-plugin-adapter.test.ts`  | (test of orphan adapter)                                  | **Delete**                                                            |
| `src/renderer/screens/plugins/PluginNewDialog.tsx`                            | (orphan dialog)                                           | **Delete**                                                            |
| `src/renderer/screens/marketplaces/AddMarketplaceDialog.tsx`                  | (orphan dialog)                                           | **Delete**                                                            |
| `vitest.config.ts`                                                            | Coverage ratchet thresholds                               | **Modify**                                                            |
| `docs/reference/architecture.md`                                              | Source-of-truth doc                                       | **Modify** — drop ClaudePluginAdapter paragraph; note parser location |

---

## Task 1: Fix the hexagonal violation — relocate the frontmatter parser to `application/`

**Why:** `skill-service.ts:13`, `agent-service.ts:13`, `command-service.ts:13` import `parseMarkdown` (a _value_, not a type) from `infrastructure/markdown/frontmatter.js`. That is an application→infrastructure dependency — a layer arrow pointing outward, against the hexagon. The function itself is pure (YAML parse + string splitting, zero I/O) — it is merely **misfiled**. Moving it to `application/markdown/` makes every importer's dependency point inward (services→application ✓, infrastructure→application ✓). It sits naturally next to `application/schemas/`, which validate the very frontmatter it parses, and keeps `yaml` out of `domain/`.

This is a pure relocation — no behavior change — so the existing tests are the characterization net. No new test is written; TDD here means "the suite stays green across the move."

**Files:**

- Move: `src/main/infrastructure/markdown/frontmatter.ts` → `src/main/application/markdown/frontmatter.ts`
- Modify imports in: `src/main/application/services/skill-service.ts:13`, `agent-service.ts:13`, `command-service.ts:13`, `src/main/infrastructure/customization/fs-customization-repository.ts:15`
- Modify imports in: `tests/main/application/services/__tests__/customization-service.global-instruction-save.test.ts:6`, `tests/main/infrastructure/customization/fs-customization-repository.test.ts:7`

- [ ] **Step 1: Move the file with history preserved**

Run:

```bash
mkdir -p src/main/application/markdown
git mv src/main/infrastructure/markdown/frontmatter.ts src/main/application/markdown/frontmatter.ts
rmdir src/main/infrastructure/markdown 2>/dev/null || true
```

Expected: the file now lives at `src/main/application/markdown/frontmatter.ts`; old dir is gone. No content change inside the file.

- [ ] **Step 2: Update the three service imports**

In `src/main/application/services/skill-service.ts`, `agent-service.ts`, and `command-service.ts`, change line 13 in each from:

```ts
import { parseMarkdown } from '../../infrastructure/markdown/frontmatter.js';
```

to:

```ts
import { parseMarkdown } from '../markdown/frontmatter.js';
```

- [ ] **Step 3: Update the infrastructure repository import**

In `src/main/infrastructure/customization/fs-customization-repository.ts`, change line 15 from:

```ts
import { parseMarkdown, serializeMarkdown } from '../markdown/frontmatter.js';
```

to:

```ts
import { parseMarkdown, serializeMarkdown } from '../../application/markdown/frontmatter.js';
```

- [ ] **Step 4: Update the two test imports**

In `tests/main/application/services/__tests__/customization-service.global-instruction-save.test.ts`, change line 6 from:

```ts
import { parseMarkdown } from '../../../../../src/main/infrastructure/markdown/frontmatter.js';
```

to:

```ts
import { parseMarkdown } from '../../../../../src/main/application/markdown/frontmatter.js';
```

In `tests/main/infrastructure/customization/fs-customization-repository.test.ts`, change line 7 from:

```ts
import { parseMarkdown } from '../../../../src/main/infrastructure/markdown/frontmatter.js';
```

to:

```ts
import { parseMarkdown } from '../../../../src/main/application/markdown/frontmatter.js';
```

- [ ] **Step 5: Verify no stale import paths remain**

Run: `grep -rn "infrastructure/markdown" src tests`
Expected: **no output** (every reference now points at `application/markdown`).

- [ ] **Step 6: Typecheck and run the affected tests**

Run:

```bash
npm run typecheck
npx vitest run tests/main/infrastructure/customization/fs-customization-repository.test.ts tests/main/application/services/__tests__/customization-service.global-instruction-save.test.ts tests/main/application/services/customization-typed-services.test.ts
```

Expected: typecheck passes (0 errors); all listed tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/main/application/markdown/frontmatter.ts \
        src/main/application/services/skill-service.ts \
        src/main/application/services/agent-service.ts \
        src/main/application/services/command-service.ts \
        src/main/infrastructure/customization/fs-customization-repository.ts \
        tests/main/application/services/__tests__/customization-service.global-instruction-save.test.ts \
        tests/main/infrastructure/customization/fs-customization-repository.test.ts
git commit -m "refactor(arch): relocate frontmatter parser to application layer

Move the pure parseMarkdown/serializeMarkdown module out of
infrastructure/ into application/markdown/. Fixes the application->
infrastructure value import in skill/agent/command services (the one
genuine hexagonal layering violation): every importer now depends
inward. Behaviour-preserving; covered by existing tests.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Remove dead code — four orphans + one orphan test

**Why:** The diagnosis confirmed by grep (zero external references) four artifacts that nothing in production wires:

- `application/ports/path-prober.ts` — `PathProber` interface, no implementors, no consumers.
- `infrastructure/adapters/claude-plugin-adapter.ts` — `ClaudePluginAdapter`, implements no port, instantiated only by its own test (not by `index.ts`). The test gives a false sense of coverage for code nothing runs. **Decision: delete** (YAGNI — wire it back from git history if a real consumer ever appears).
- `renderer/screens/plugins/PluginNewDialog.tsx` and `renderer/screens/marketplaces/AddMarketplaceDialog.tsx` — exported, rendered by no JSX. Being under `screens/**` they sit inside the coverage `include` with no tests, dragging the renderer baseline down.

No test is _added_ here; the safety net is that the full suite must still pass after deletion (nothing depended on these).

**Files:**

- Delete: `src/main/application/ports/path-prober.ts`
- Delete: `src/main/infrastructure/adapters/claude-plugin-adapter.ts`
- Delete: `tests/main/infrastructure/adapters/__tests__/claude-plugin-adapter.test.ts`
- Delete: `src/renderer/screens/plugins/PluginNewDialog.tsx`
- Delete: `src/renderer/screens/marketplaces/AddMarketplaceDialog.tsx`

- [ ] **Step 1: Re-confirm zero external references (guard against drift since the diagnosis)**

Run:

```bash
grep -rn "PathProber\|path-prober" src tests --include="*.ts" --include="*.tsx" | grep -v "ports/path-prober.ts:"
grep -rn "ClaudePluginAdapter\|claude-plugin-adapter" src tests --include="*.ts" --include="*.tsx" | grep -v "adapters/claude-plugin-adapter.ts:" | grep -v "claude-plugin-adapter.test.ts:"
grep -rn "PluginNewDialog" src tests --include="*.tsx" --include="*.ts" | grep -v "PluginNewDialog.tsx:"
grep -rn "AddMarketplaceDialog" src tests --include="*.tsx" --include="*.ts" | grep -v "AddMarketplaceDialog.tsx:"
```

Expected: **no output** from any of the four greps. (If any line appears, STOP — that artifact is no longer an orphan; remove it from this task and investigate.)

- [ ] **Step 2: Delete the five files**

Run:

```bash
git rm src/main/application/ports/path-prober.ts \
       src/main/infrastructure/adapters/claude-plugin-adapter.ts \
       tests/main/infrastructure/adapters/__tests__/claude-plugin-adapter.test.ts \
       src/renderer/screens/plugins/PluginNewDialog.tsx \
       src/renderer/screens/marketplaces/AddMarketplaceDialog.tsx
```

Expected: git stages five deletions.

- [ ] **Step 3: Typecheck and run the full suite**

Run:

```bash
npm run typecheck
npm test
```

Expected: typecheck passes; all tests PASS (no suite referenced the deleted code). If a test fails on a missing import, the artifact was not truly orphaned — restore it and re-investigate.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove orphaned port, adapter, and renderer dialogs

Delete dead code with zero production references (verified by grep):
- PathProber port (no implementors/consumers)
- ClaudePluginAdapter (wired nowhere; only its own test used it)
- PluginNewDialog / AddMarketplaceDialog (rendered by no JSX)

Removing the two renderer dialogs also lifts the coverage baseline,
since they sat under screens/** with no tests.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Dedupe the three customization facades via shared plugin helpers

**Why:** `skill-service.ts`, `agent-service.ts`, and `command-service.ts` are structurally near-identical (~140 LOC each). The genuinely duplicated, non-trivial logic is (a) the plugin-collection loop (`collectPluginSkills/Agents/Commands`) and (b) `assertNotPluginSourced`. Extracting these two into a config-driven helper module removes the triplicated logic while keeping each service class, its public API, and its tests unchanged.

**Design decision (and what we rejected):** A full generic `TypedCustomizationFacade<T>` class was considered but rejected as over-abstraction (YAGNI) — it would force the per-entity `save({ skill })`/`{ agent }`/`{ command }` key differences through awkward wrappers and obscure the three readable classes. Instead we extract two small, well-typed free functions and let each class keep its shape. This is the smaller, lower-risk, better-tasted move. The `command` service keeps its special plugin-frontmatter merge (`{ ...frontmatter, name, type: 'command' }`) inside its own `build` callback, so no behavior is flattened away.

**Type constraint discovered during planning:** `ProvenanceKey.type` (in `plugin-provenance.ts:7-9`) is `'skill' | 'agent' | 'command'`, NOT the full `CustomizationType`. The helper's `type` parameter must use that narrower union or `provenanceKey(...)` will not typecheck.

**Files:**

- Create: `src/main/application/services/customization-plugin-helpers.ts`
- Test: `tests/main/application/services/customization-plugin-helpers.test.ts`
- Modify: `src/main/application/services/skill-service.ts`, `agent-service.ts`, `command-service.ts`
- Safety net (must stay green): `tests/main/application/services/customization-typed-services.test.ts`, `tests/main/ipc/typed-handlers.test.ts`

- [ ] **Step 1: Write the failing test for the shared helpers**

Create `tests/main/application/services/customization-plugin-helpers.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  collectPluginEntities,
  assertNotPluginSourced,
  type PluginProvenanceDeps,
} from '../../../../src/main/application/services/customization-plugin-helpers.js';
import { pluginId } from '../../../../src/main/domain/plugin-id.js';
import { OperationNotAllowedForOriginError } from '../../../../src/main/domain/plugin-errors.js';

function makeDeps(
  provenanceMap: Map<string, ReturnType<typeof pluginId>>,
  files: Record<string, string>,
): PluginProvenanceDeps {
  return {
    provenance: {
      forScope: async () => provenanceMap,
    } as unknown as PluginProvenanceDeps['provenance'],
    cache: {
      pluginDir: (_scope: string, pid: string) => `/cache/${pid}`,
    } as unknown as PluginProvenanceDeps['cache'],
    fs: {
      readFile: async (path: string) => {
        const content = files[path];
        if (content === undefined) throw new Error(`ENOENT: ${path}`);
        return content;
      },
    } as unknown as PluginProvenanceDeps['fs'],
  };
}

describe('collectPluginEntities', () => {
  it('builds entities for keys matching the prefix and parses their files', async () => {
    const pid = pluginId('demo-plugin');
    const deps = makeDeps(
      new Map([
        ['skill/alpha', pid],
        ['agent/beta', pid], // ignored: wrong prefix
      ]),
      {
        '/cache/demo-plugin/skills/alpha/SKILL.md': '---\nname: alpha\n---\nAlpha body',
      },
    );

    const out = await collectPluginEntities(
      deps,
      {
        keyPrefix: 'skill/',
        relPath: (name) => `skills/${name}/SKILL.md`,
        build: ({ name, body, pluginId: p }) => ({ name, body, p }),
      },
      'personal',
    );

    expect(out).toEqual([{ name: 'alpha', body: 'Alpha body', p: pid }]);
  });

  it('skips entities whose file is unreadable', async () => {
    const pid = pluginId('demo-plugin');
    const deps = makeDeps(new Map([['skill/missing', pid]]), {});

    const out = await collectPluginEntities(
      deps,
      {
        keyPrefix: 'skill/',
        relPath: (name) => `skills/${name}/SKILL.md`,
        build: ({ name }) => ({ name }),
      },
      'personal',
    );

    expect(out).toEqual([]);
  });
});

describe('assertNotPluginSourced', () => {
  it('is a no-op when deps are absent', async () => {
    await expect(
      assertNotPluginSourced(undefined, {
        type: 'skill',
        operation: 'save',
        name: 'alpha',
        scope: 'personal',
      }),
    ).resolves.toBeUndefined();
  });

  it('throws OperationNotAllowedForOriginError when the entity is plugin-sourced', async () => {
    const pid = pluginId('demo-plugin');
    const deps = makeDeps(new Map([['skill/alpha', pid]]), {});

    await expect(
      assertNotPluginSourced(deps, {
        type: 'skill',
        operation: 'delete',
        name: 'alpha',
        scope: 'personal',
      }),
    ).rejects.toBeInstanceOf(OperationNotAllowedForOriginError);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/main/application/services/customization-plugin-helpers.test.ts`
Expected: FAIL — cannot resolve `customization-plugin-helpers.js` (module does not exist yet).

- [ ] **Step 3: Implement the shared helpers**

Create `src/main/application/services/customization-plugin-helpers.ts`:

```ts
import { join } from 'node:path';
import type { PluginProvenanceService } from './plugin-provenance.js';
import type { PluginCachePort } from '../ports/plugin-cache-port.js';
import type { FileSystemPort } from '../ports/filesystem-port.js';
import type { Scope } from '../ports/scope.js';
import type { PluginId } from '../../domain/plugin-id.js';
import type { ProvenanceKey } from './plugin-provenance.js';
import { parseMarkdown } from '../markdown/frontmatter.js';
import { OperationNotAllowedForOriginError } from '../../domain/plugin-errors.js';
import { provenanceKey } from './plugin-provenance.js';

export interface PluginProvenanceDeps {
  provenance: PluginProvenanceService;
  cache: PluginCachePort;
  fs: FileSystemPort;
}

export interface PluginEntitySpec<TEntity> {
  /** Provenance-key prefix selecting this entity type, e.g. 'skill/'. */
  keyPrefix: string;
  /** File path of the entity inside the plugin dir, relative to it. */
  relPath: (name: string) => string;
  /** Build the domain entity from the parsed plugin file. */
  build: (args: {
    name: string;
    frontmatter: unknown;
    body: string;
    pluginId: PluginId;
  }) => TEntity;
}

/**
 * Reads every plugin-provided entity of one type for a scope, parsing each
 * file and delegating shape construction to `spec.build`. Files that cannot be
 * read are skipped silently (the plugin may be mid-install or partial).
 */
export async function collectPluginEntities<TEntity>(
  deps: PluginProvenanceDeps,
  spec: PluginEntitySpec<TEntity>,
  scope: Scope,
): Promise<TEntity[]> {
  const { provenance, cache, fs } = deps;
  const map = await provenance.forScope(scope);
  const out: TEntity[] = [];
  for (const [key, pid] of map.entries()) {
    if (!key.startsWith(spec.keyPrefix)) continue;
    const name = key.slice(spec.keyPrefix.length);
    const file = join(cache.pluginDir(scope, pid), spec.relPath(name));
    try {
      const raw = await fs.readFile(file);
      const { frontmatter, body } = parseMarkdown(raw);
      out.push(spec.build({ name, frontmatter, body, pluginId: pid }));
    } catch {
      // Plugin entity file unreadable — skip silently.
    }
  }
  return out;
}

/**
 * Throws OperationNotAllowedForOriginError if a workspace entity of this
 * type/name is actually provided (shadowed) by an installed plugin, making
 * save/delete illegal. No-op when provenance deps are not configured.
 */
export async function assertNotPluginSourced(
  deps: PluginProvenanceDeps | undefined,
  args: {
    type: ProvenanceKey['type'];
    operation: 'save' | 'delete';
    name: string;
    scope: Scope;
  },
): Promise<void> {
  if (!deps) return;
  const map = await deps.provenance.forScope(args.scope);
  const pid = map.get(provenanceKey({ type: args.type, name: args.name }));
  if (pid != null) {
    throw new OperationNotAllowedForOriginError(
      `Cannot ${args.operation} ${args.type} '${args.name}' provided by plugin '${pid}'`,
      { origin: 'plugin', operation: args.operation },
    );
  }
}
```

- [ ] **Step 4: Run the helper test to verify it passes**

Run: `npx vitest run tests/main/application/services/customization-plugin-helpers.test.ts`
Expected: PASS (all four cases).

- [ ] **Step 5: Rewire `skill-service.ts` to use the helpers**

In `src/main/application/services/skill-service.ts`:

Replace the import block lines 13-15 (currently `parseMarkdown`, `OperationNotAllowedForOriginError`, `provenanceKey` imports) so it reads:

```ts
import { OperationNotAllowedForOriginError } from '../../domain/plugin-errors.js';
import { collectPluginEntities, assertNotPluginSourced } from './customization-plugin-helpers.js';
```

(Remove the now-unused `parseMarkdown` and `provenanceKey` imports; keep `OperationNotAllowedForOriginError` for the save-time source guard.)

Replace the `collectPluginSkills` method (lines 53-76) with:

```ts
  private async collectPluginSkills(scope: Scope): Promise<Skill[]> {
    if (!this.pluginDeps) return [];
    return collectPluginEntities(
      this.pluginDeps,
      {
        keyPrefix: 'skill/',
        relPath: (name) => `skills/${name}/SKILL.md`,
        build: ({ name, frontmatter, body, pluginId }) => ({
          id: skillId(name),
          frontmatter: frontmatter as SkillFrontmatter,
          source: pluginSource(pluginId),
          body,
        }),
      },
      scope,
    );
  }
```

Replace the `assertNotPluginSourced` private method (lines 125-139) entirely with a thin delegation — change every call site `await this.assertNotPluginSourced('save', input.skill.id, input.scope ?? 'personal')` and the delete one to:

```ts
await assertNotPluginSourced(this.pluginDeps, {
  type: 'skill',
  operation: 'save', // or 'delete' in the delete method
  name: input.skill.id, // or input.id in the delete method
  scope: input.scope ?? 'personal',
});
```

and delete the now-unused private `assertNotPluginSourced` method. Leave the save-time `if (input.skill.source.kind === 'plugin')` guard (lines 89-94) inline — it is a 5-line check, not worth extracting.

- [ ] **Step 6: Rewire `agent-service.ts` to use the helpers**

Apply the identical pattern to `src/main/application/services/agent-service.ts`:

- Same import swap (drop `parseMarkdown`/`provenanceKey`, add the two helpers, keep `OperationNotAllowedForOriginError`).
- Replace `collectPluginAgents`:

```ts
  private async collectPluginAgents(scope: Scope): Promise<Agent[]> {
    if (!this.pluginDeps) return [];
    return collectPluginEntities(
      this.pluginDeps,
      {
        keyPrefix: 'agent/',
        relPath: (name) => `agents/${name}.md`,
        build: ({ name, frontmatter, body, pluginId }) => ({
          id: agentId(name),
          frontmatter: frontmatter as AgentFrontmatter,
          source: pluginSource(pluginId),
          body,
        }),
      },
      scope,
    );
  }
```

- Replace both `this.assertNotPluginSourced(...)` calls with `assertNotPluginSourced(this.pluginDeps, { type: 'agent', operation: ..., name: ..., scope: ... })` and delete the private method.

- [ ] **Step 7: Rewire `command-service.ts` to use the helpers (note the special frontmatter merge)**

Apply the same pattern to `src/main/application/services/command-service.ts`, preserving the command-only frontmatter merge inside `build`:

```ts
  private async collectPluginCommands(scope: Scope): Promise<Command[]> {
    if (!this.pluginDeps) return [];
    return collectPluginEntities(
      this.pluginDeps,
      {
        keyPrefix: 'command/',
        relPath: (name) => `commands/${name}.md`,
        build: ({ name, frontmatter, body, pluginId }) => ({
          id: commandId(name),
          frontmatter: {
            ...(frontmatter as Partial<CommandFrontmatter>),
            name,
            type: 'command',
          } as CommandFrontmatter,
          source: pluginSource(pluginId),
          body,
        }),
      },
      scope,
    );
  }
```

- Same import swap; replace both `this.assertNotPluginSourced(...)` calls with `assertNotPluginSourced(this.pluginDeps, { type: 'command', operation: ..., name: ..., scope: ... })` and delete the private method.

- [ ] **Step 8: Typecheck**

Run: `npm run typecheck`
Expected: 0 errors. (If `frontmatter as SkillFrontmatter` etc. trips `exactOptionalPropertyTypes`, the cast mirrors the original `parseMarkdown<SkillFrontmatter>` typing — keep the explicit cast as shown.)

- [ ] **Step 9: Run the facade + handler safety-net tests**

Run:

```bash
npx vitest run tests/main/application/services/customization-typed-services.test.ts tests/main/ipc/typed-handlers.test.ts tests/main/ipc/registry.test.ts tests/main/application/services/customization-plugin-helpers.test.ts
```

Expected: all PASS. These exercise list/get/save/delete and plugin-provenance merging through the public facade API — green here proves the extraction is behavior-preserving.

- [ ] **Step 10: Lint**

Run: `npm run lint`
Expected: 0 errors (no unused imports left behind from the swaps).

- [ ] **Step 11: Commit**

```bash
git add src/main/application/services/customization-plugin-helpers.ts \
        tests/main/application/services/customization-plugin-helpers.test.ts \
        src/main/application/services/skill-service.ts \
        src/main/application/services/agent-service.ts \
        src/main/application/services/command-service.ts
git commit -m "refactor(services): extract shared plugin helpers for facades

Collapse the triplicated plugin-collection loop and plugin-source guard
from skill/agent/command services into collectPluginEntities and
assertNotPluginSourced. Each facade keeps its public API and its
command-only frontmatter merge; behaviour proven by the existing typed
service + handler tests plus new unit tests for the helpers.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Tighten the coverage ratchet to the post-cleanup baseline

**Why:** `vitest.config.ts` floors are `lines 75 / functions 72 / statements 74 / branches 62` — set deliberately below the production 80/70 target as an anti-regression ratchet. After Tasks 1-3 (notably deleting the untested orphan dialogs), the measured baseline rises. Locking the floor to the new measured numbers prevents silent backsliding without requiring new tests. (Closing the remaining gap _to_ 80/70 needs new renderer/IPC tests — that is a separate plan; see follow-ups.)

**Files:**

- Modify: `vitest.config.ts:21-29`

- [ ] **Step 1: Measure current coverage**

Run: `npx vitest run --coverage`
Expected: a coverage table prints. Record the four **total** percentages for Statements / Branches / Functions / Lines (the final summary row).

- [ ] **Step 2: Set each threshold to the floor of the measured value**

In `vitest.config.ts`, update the `thresholds` block (lines 24-29) using the measured numbers from Step 1, rounded **down** to the nearest integer, and only ever raising (never lowering) the existing floor. Update the comment to record the new baseline and date. For example, if Step 1 reports S77.x / B64.x / F75.x / L78.x:

```ts
      // Ratchet floor: locked to the 2026-06-06 post-cleanup baseline
      // (S77 / B64 / F75 / L78). Raise toward the 80/70 production target as
      // renderer-screen and IPC-handler coverage improves (separate plan).
      thresholds: {
        lines: 78,
        functions: 75,
        statements: 77,
        branches: 64,
      },
```

Use the actual measured floors, not these example values. If any measured value is _below_ the current floor (unexpected — investigate before proceeding), keep the existing floor for that metric and stop to diagnose the regression.

- [ ] **Step 3: Verify the gate passes at the new floor**

Run: `npx vitest run --coverage`
Expected: PASS — coverage meets or exceeds every new threshold (it must, since the floor was set from this same measurement).

- [ ] **Step 4: Commit**

```bash
git add vitest.config.ts
git commit -m "test: tighten coverage ratchet to post-cleanup baseline

Lock thresholds to the measured baseline after the Phase-2 dead-code
removal. Anti-regression only; reaching the 80/70 target needs new
tests, tracked in a separate plan.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Bookkeeping — sync docs and run the full release gate

**Why:** Task 2 deleted `ClaudePluginAdapter`, which `docs/reference/architecture.md` still describes (the "ClaudePluginAdapter helper" paragraph, ~line 158). Architecture docs are the source of truth and have drifted before — leaving a deleted artifact documented re-introduces drift. Task 1 moved the frontmatter parser; the doc's layer description should reflect that pure parsing lives in `application/`. Finally, the whole branch must pass the release gate (lint + typecheck + tests) before the work is considered done.

**Files:**

- Modify: `docs/reference/architecture.md`

- [ ] **Step 1: Remove the stale ClaudePluginAdapter paragraph**

In `docs/reference/architecture.md`, delete the paragraph beginning `**ClaudePluginAdapter helper**` (around line 158) — the entire bullet/paragraph describing the now-deleted helper. Verify nothing else in the doc references `ClaudePluginAdapter`:

```bash
grep -n "ClaudePluginAdapter" docs/reference/architecture.md
```

Expected after edit: **no output**.

- [ ] **Step 2: Note the frontmatter parser's home in the layer description**

In `docs/reference/architecture.md`, in the "Hexagonal layers (main)" section (the `application/` block around lines 28-31), add a line documenting the relocated parser so future readers don't expect it under infrastructure. Change:

```
│   └── schemas/     # Zod schemas
```

to:

```
│   ├── schemas/     # Zod schemas
│   └── markdown/    # pure frontmatter parse/serialize (no I/O)
```

- [ ] **Step 3: Run the full release gate**

Run:

```bash
npm run lint
npm run typecheck
npm test
```

Expected: all three pass cleanly (green lint + typecheck + tests is the release gate per CLAUDE.md).

- [ ] **Step 4: Commit**

```bash
git add docs/reference/architecture.md
git commit -m "docs(architecture): drop deleted ClaudePluginAdapter; note parser location

Sync the source-of-truth doc with Phase-2 changes: remove the paragraph
describing the now-deleted ClaudePluginAdapter helper, and record that
the pure frontmatter parser now lives under application/markdown/.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Follow-up plans (out of scope — each needs its own plan)

These three diagnosis items are real but are **independent subsystems** too large for bite-sized inclusion here. Per the writing-plans scope check, each should get a dedicated plan:

1. **Typed IPC contract (P2.3).** Introduce an `IpcMethod` union and a params/result map so the dispatcher (`Record<string, IpcHandler>` with `params: unknown`) gains compile-time method↔payload safety, replacing the stringly-typed contract and the `as unknown as` casts at the handler boundary. Touches ~40 methods across all namespaces — its own plan.
2. **`Settings.tsx` react-query migration (P2.4).** Replace the ~15 `useState` + manual `useEffect`/`callIpc` sprawl with a `useSettings()` react-query hook, matching `use-customization-list.ts`. Renderer subsystem — its own plan.
3. **Coverage to the 80/70 target.** Task 4 only ratchets the floor to today's baseline. Reaching 80/70 requires _new_ renderer-screen and IPC-handler tests (and likely widening the coverage `include` to `renderer/{components,hooks,lib}`). A test-writing plan, not a config bump.

---

## Self-review checklist (run before execution)

- **Spec coverage:** hex violation → Task 1; dead code → Task 2; facade triplication → Task 3; coverage floor → Task 4; doc/record sync + gate → Task 5; the three large items explicitly deferred with rationale.
- **Placeholder scan:** every code/command step shows exact content; the only deliberately data-dependent values are the Task 4 thresholds (measured at execution — instructions specify exactly how to derive them).
- **Type consistency:** helper names `collectPluginEntities` / `assertNotPluginSourced` and the `PluginProvenanceDeps` / `PluginEntitySpec<TEntity>` interfaces are used identically across the helper module, its test, and all three service rewires; `type` is constrained to `ProvenanceKey['type']` to match `provenanceKey`.
