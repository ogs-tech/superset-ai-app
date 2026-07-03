# Cursor Adapter — Symlink Core (Plan A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `CursorAdapter` that symlinks skills, agents, and slash-commands (explicit-only skills) into Cursor's native `~/.cursor/` and `<repo>/.cursor/` locations, toggled via `adapters.cursor.enabled`, surfaced as a Cursor toggle in Settings and (for free) in the Health screen.

**Architecture:** A new `CursorAdapter implements Adapter` mirrors `ClaudeAdapter`, returning `{ scope, destination }` symlink destinations pointing at `.cursor/skills/<name>/` (directory) and `.cursor/agents/<name>.md`. Because a slash-command is already a `Skill` with `explicitOnly: true` and its on-disk `SKILL.md` already carries `disable-model-invocation: true`, commands ride the same directory symlink — no content generation. The `Settings.adapters` type, defaults, and validator gain a required `cursor` entry. **No changes to `AdapterManager`, `SymlinkManager`, or the health machinery** — they already iterate registered adapters and planned destinations generically, so Cursor symlinks sync, remove, count, and health-check with zero new infrastructure.

**Tech Stack:** TypeScript (strict, ESM with `.js` import specifiers), Electron (main/preload/renderer), Vitest (node + jsdom projects), React + MUI (renderer), Node `fs` symlinks behind `SymlinkManager`.

## Global Constraints

- **Import specifiers use `.js`** even from `.ts` sources (`verbatimModuleSyntax` + ESM). Example: `import { CursorAdapter } from './infrastructure/adapters/cursor-adapter.js'`.
- **Strict TS:** `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch` all on. `arr[0]` is `T | undefined`.
- **Hexagonal rule:** services depend on **ports**, never on `node:fs`/`electron` directly. The adapter is infrastructure and may use `node:path`.
- **UI copy in pt-BR; all identifiers/types/IPC method names in English.** No i18n framework — inline string literals.
- **Release gate:** `npm run lint`, `npm run typecheck`, and `npm test` must all be green at the end of every task (no "no new errors" exception).
- **Canonical model:** entities are `Entity` with kinds `skill`/`agent`/`instruction`. A slash-command = `Skill` with `explicitOnly: true`. Adapter contract is `resolveEntityDestinations({ entity, linkedRepos })`.
- **`cursor` defaults to `enabled: false`** — Cursor sync is opt-in; enabling it must never be a side effect of an upgrade.
- **Out of scope for Plan A** (deferred to Plan B — `2026-07-02-cursor-adapter-generated-files.md`): `instruction → <repo>/AGENTS.md`, the `strategy: 'write'` port change, the `FileMaterializer`, the generated-file health collector, and the link-a-repo notice. In Plan A, `CursorAdapter.resolveEntityDestinations` returns `[]` for `instruction`.

---

## File Structure

**Created:**
- `src/main/infrastructure/adapters/cursor-adapter.ts` — the adapter (mirror of `claude-adapter.ts`), one responsibility: map an `Entity` + linked repos to Cursor symlink destinations.
- `tests/main/infrastructure/adapters/__tests__/cursor-adapter.contract.test.ts` — Adapter port contract (id, function shape, homedir guard).
- `tests/main/infrastructure/adapters/__tests__/cursor-adapter.entity-destinations.test.ts` — per-kind × per-scope × N-repo destination mapping.
- `tests/main/infrastructure/adapters/__tests__/cursor-adapter.wiring.test.ts` — integration: with Cursor enabled, `AdapterManager.planDestinations()` includes `.cursor/` entries; disabled → none.

**Modified:**
- `src/shared/settings.ts` — add required `cursor: AdapterSettings` to `Settings.adapters` and to `getDefaults()`.
- `src/main/application/services/settings-service.ts` — `stripLegacyFields` backfills `cursor`; `assertValidSettings` accepts `claude` + optional `cursor`, rejects any other adapter.
- `src/main/index.ts` — construct `CursorAdapter` and register it in the adapters `Map`.
- `src/renderer/screens/Settings.tsx` — render a Cursor toggle; widen the `'claude'` literals to `'claude' | 'cursor'`.
- **Settings-literal sweep** (compiler-driven; add `cursor: { enabled: false }` next to `claude`): `tests/main/application/services/__tests__/adapter-manager.helpers.ts`, `.../adapter-manager.count-destinations.test.ts`, `.../adapter-manager.remove-all.test.ts`, `.../adapter-manager.remove-all.shape.test.ts`, `.../adapter-manager.remove-all.unknown.test.ts`, `.../adapter-manager.remove-entity.test.ts`, `tests/main/application/services/health/plan-destinations.test.ts`, `tests/main/application/services/settings-service.test.ts`, `tests/main/application/services/settings-service.legacy-default-scope.test.ts`, `tests/main/application/__tests__/disable-claude.e2e.test.ts`, `tests/main/application/__tests__/disable-claude-external-symlink.e2e.test.ts`, `tests/main/infrastructure/adapters/__tests__/claude-adapter.e2e.test.ts`, `tests/main/infrastructure/adapters/__tests__/claude-adapter.wiring.test.ts`, `tests/main/infrastructure/adapters/__tests__/global-instruction.e2e.test.ts`, `tests/main/ipc/registry.test.ts`, `tests/shared/settings.test.ts`, `tests/renderer/bootstrap-router.test.tsx`, `tests/renderer/components/shell/AppShell.test.tsx`, `tests/renderer/components/shell/TopNav.test.tsx`, `tests/renderer/lib/theme-mode-context.test.tsx`, `tests/renderer/screens/settings.test.tsx`, `tests/renderer/screens/settings/adapters-section.test.tsx`, `tests/renderer/screens/settings/linked-repos.test.tsx`. (The exact set is whatever `npm run typecheck` flags after Task 1's type change — the compiler is the source of truth; the list above is the known scope.)

---

### Task 1: Add `cursor` to the Settings schema

Everything downstream reads `settings.adapters.cursor`, so this lands first. The deliverable is: the `Settings` type carries a required `cursor` adapter, the validator accepts it, old on-disk files backfill it, and the **entire suite is green** (fixtures swept).

**Files:**
- Modify: `src/shared/settings.ts`
- Modify: `src/main/application/services/settings-service.ts`
- Test: `tests/main/application/services/settings-service.test.ts`
- Test: `tests/shared/settings.test.ts` (assert `getDefaults` shape)
- Sweep: every file listed under "Settings-literal sweep" above.

**Interfaces:**
- Consumes: nothing new.
- Produces: `Settings.adapters` is now `{ claude: AdapterSettings; cursor: AdapterSettings }`. `getDefaults().adapters.cursor === { enabled: false }`. `SettingsService.save`/`merge` accept and validate `cursor`; unknown adapter keys are rejected with `DomainError('validation', ...)`.

- [ ] **Step 1: Write the failing validator test**

Add to `tests/main/application/services/settings-service.test.ts`:

```ts
describe('SettingsService — cursor adapter', () => {
  it('save accepts settings with a cursor adapter', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const service = new SettingsService(stubRepo({ save }));
    const withCursor: Settings = {
      adapters: { claude: { enabled: true }, cursor: { enabled: true } },
      linkedRepos: [],
      ui: { theme: 'system' },
      language: 'off',
    };

    await service.save(withCursor);

    expect(save).toHaveBeenCalledWith(withCursor);
  });

  it('save rejects an unknown adapter key', async () => {
    const service = new SettingsService(stubRepo());
    const bad = {
      adapters: { claude: { enabled: true }, copilot: { enabled: true } },
      linkedRepos: [],
      ui: { theme: 'system' },
      language: 'off',
    } as unknown as Settings;

    await expect(service.save(bad)).rejects.toBeInstanceOf(DomainError);
  });

  it('load backfills a disabled cursor for pre-cursor settings files', async () => {
    const legacy = {
      adapters: { claude: { enabled: true } },
      linkedRepos: [],
      ui: { theme: 'system' },
      language: 'off',
    } as unknown as Settings;
    const service = new SettingsService(stubRepo({ load: () => Promise.resolve(legacy) }));

    const loaded = await service.load();

    expect(loaded?.adapters.cursor).toEqual({ enabled: false });
    expect(loaded?.adapters.claude).toEqual({ enabled: true });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/main/application/services/settings-service.test.ts`
Expected: FAIL — `save` currently throws on the `cursor` key ("'adapters' must contain exactly the 'claude' adapter"); `load` returns no `cursor`.

- [ ] **Step 3: Extend the shared `Settings` type and defaults**

In `src/shared/settings.ts`, change the `Settings.adapters` shape and `getDefaults`:

```ts
export interface Settings {
  adapters: {
    claude: AdapterSettings;
    cursor: AdapterSettings;
  };
  linkedRepos: LinkedRepo[];
  ui: UiSettings;
  language: LanguagePreference;
}

export function getDefaults(): Settings {
  return {
    adapters: {
      claude: { enabled: true },
      cursor: { enabled: false },
    },
    linkedRepos: [],
    ui: { theme: 'system' },
    language: 'off',
  };
}
```

- [ ] **Step 4: Update `stripLegacyFields` and `assertValidSettings`**

In `src/main/application/services/settings-service.ts`, replace `stripLegacyFields` (lines 10-26) with:

```ts
const stripLegacyFields = (settings: Settings): Settings => {
  // Drops fields from older on-disk shapes (a removed `copilot` adapter key, the
  // legacy per-adapter `defaultScope`) by rebuilding `adapters` from scratch, and
  // backfills a disabled `cursor` for settings files written before it existed.
  const adapters = settings.adapters as unknown as {
    claude?: Record<string, unknown>;
    cursor?: Record<string, unknown>;
  };
  const clean = (
    entry: Record<string, unknown> | undefined,
    fallbackEnabled: boolean,
  ): { enabled: boolean } => ({
    enabled: typeof entry?.['enabled'] === 'boolean' ? (entry['enabled'] as boolean) : fallbackEnabled,
  });
  return {
    ...settings,
    adapters: {
      claude: clean(adapters.claude, true),
      cursor: clean(adapters.cursor, false),
    },
  };
};
```

Then replace the adapters block of `assertValidSettings` (lines 88-99) with:

```ts
  const adapters = asRecord(s['adapters'], "Missing or invalid 'adapters'");
  const adapterKeys = Object.keys(adapters);
  const ALLOWED_ADAPTERS = new Set(['claude', 'cursor']);
  if (!adapterKeys.includes('claude')) {
    invalid("'adapters' must contain the 'claude' adapter");
  }
  for (const key of adapterKeys) {
    if (!ALLOWED_ADAPTERS.has(key)) invalid(`Unknown adapter '${key}'`);
    const entry = asRecord(adapters[key], `'adapters.${key}' must be an object`);
    if (typeof entry['enabled'] !== 'boolean') {
      invalid(`'adapters.${key}.enabled' must be a boolean`);
    }
    if (Object.keys(entry).some((k) => k !== 'enabled')) {
      invalid(`'adapters.${key}' has unexpected fields`);
    }
  }
```

- [ ] **Step 5: Run the new test to verify it passes**

Run: `npx vitest run tests/main/application/services/settings-service.test.ts`
Expected: PASS for the three new cases.

- [ ] **Step 6: Sweep every Settings literal, driven by the compiler**

Run: `npm run typecheck`
Expected: a list of errors of the form `Property 'cursor' is missing in type '{ claude: ...; }'` across the files listed in "Settings-literal sweep". For **each** flagged literal, add `cursor: { enabled: false }` beside `claude`. Example — in `tests/main/application/services/__tests__/adapter-manager.helpers.ts`:

```ts
export const defaultSettings: Settings = {
  adapters: {
    claude: { enabled: true },
    cursor: { enabled: false },
  },
  linkedRepos: [],
  ui: { theme: 'system' },
  language: 'off',
};
```

And in `tests/main/application/services/health/plan-destinations.test.ts`, update `settingsWith`:

```ts
const settingsWith = (over: Partial<Settings> = {}): Settings => ({
  ...getDefaults(),
  adapters: { claude: { enabled: true }, cursor: { enabled: false } },
  ...over,
});
```

For `tests/main/application/services/settings-service.legacy-default-scope.test.ts`: whatever assertion expects `result.adapters` to equal `{ claude: { enabled: true } }` must now expect `{ claude: { enabled: true }, cursor: { enabled: false } }` (load backfills cursor). For `tests/shared/settings.test.ts`: the `getDefaults` shape assertion must include `cursor: { enabled: false }`. Repeat for every remaining flagged file — the edit is identical each time.

- [ ] **Step 7: Run full typecheck + suite to verify green**

Run: `npm run typecheck && npm test`
Expected: typecheck clean; all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/shared/settings.ts src/main/application/services/settings-service.ts tests/
git commit -m "feat(settings): add cursor adapter to the settings schema (disabled by default)"
```

---

### Task 2: The `CursorAdapter`

**Files:**
- Create: `src/main/infrastructure/adapters/cursor-adapter.ts`
- Test: `tests/main/infrastructure/adapters/__tests__/cursor-adapter.contract.test.ts`
- Test: `tests/main/infrastructure/adapters/__tests__/cursor-adapter.entity-destinations.test.ts`

**Interfaces:**
- Consumes: `Adapter`, `AdapterDestination` from `application/ports/adapter.js`; `Entity`, `LinkedRepo`; `DomainError`.
- Produces: `class CursorAdapter implements Adapter` with `adapterId = 'cursor'` and `resolveEntityDestinations({ entity, linkedRepos }): AdapterDestination[]`. Skills → `<home|repo>/.cursor/skills/<name>` (directory). Agents → `<home|repo>/.cursor/agents/<name>.md`. `instruction` and all other kinds → `[]`. Constructor throws `DomainError('internal', …, { reason: 'missing-homedir' })` on an empty/undefined/null homedir.

- [ ] **Step 1: Write the failing contract test**

Create `tests/main/infrastructure/adapters/__tests__/cursor-adapter.contract.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CursorAdapter } from '../../../../../src/main/infrastructure/adapters/cursor-adapter.js';
import { DomainError } from '../../../../../src/main/domain/errors.js';

describe('CursorAdapter — Adapter port contract', () => {
  it('exposes adapterId === "cursor"', () => {
    expect(new CursorAdapter({ homedir: '/home/user' }).adapterId).toBe('cursor');
  });

  it('exposes a resolveEntityDestinations function', () => {
    expect(typeof new CursorAdapter({ homedir: '/home/user' }).resolveEntityDestinations).toBe(
      'function',
    );
  });

  it('throws DomainError(internal, missing-homedir) for empty homedir', () => {
    try {
      new CursorAdapter({ homedir: '' });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).kind).toBe('internal');
      expect((err as DomainError).details).toMatchObject({ reason: 'missing-homedir' });
    }
  });

  it('throws for undefined and null homedir', () => {
    expect(() => new CursorAdapter({ homedir: undefined as unknown as string })).toThrow(DomainError);
    expect(() => new CursorAdapter({ homedir: null as unknown as string })).toThrow(DomainError);
  });
});
```

- [ ] **Step 2: Write the failing destination-mapping test**

Create `tests/main/infrastructure/adapters/__tests__/cursor-adapter.entity-destinations.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { CursorAdapter } from '../../../../../src/main/infrastructure/adapters/cursor-adapter.js';
import {
  WORKSPACE_SOURCE,
  type Agent,
  type Instruction,
  type Skill,
} from '../../../../../src/shared/entity.js';
import type { LinkedRepo } from '../../../../../src/shared/settings.js';

const meta = { version: '0.1.0', createdAt: '', updatedAt: '' };
const adapter = new CursorAdapter({ homedir: '/home/u' });

describe('CursorAdapter.resolveEntityDestinations', () => {
  it('routes a personal skill to ~/.cursor/skills/<name> (directory)', () => {
    const skill: Skill = { urn: 'urn:skill:demo', kind: 'skill', name: 'demo', description: 'd',
      scopes: ['personal'], metadata: meta, source: WORKSPACE_SOURCE, content: 'b' };
    expect(adapter.resolveEntityDestinations({ entity: skill, linkedRepos: [] })).toEqual([
      { scope: 'personal', destination: '/home/u/.cursor/skills/demo' },
    ]);
  });

  it('routes an explicit-only skill (slash-command) to the same skills directory', () => {
    const command: Skill = { urn: 'urn:skill:deploy', kind: 'skill', name: 'deploy', description: 'd',
      scopes: ['personal'], metadata: meta, source: WORKSPACE_SOURCE, content: 'b', explicitOnly: true };
    expect(adapter.resolveEntityDestinations({ entity: command, linkedRepos: [] })).toEqual([
      { scope: 'personal', destination: '/home/u/.cursor/skills/deploy' },
    ]);
  });

  it('fans a [personal, project] skill out to ~/.cursor and each linked repo', () => {
    const skill: Skill = { urn: 'urn:skill:multi', kind: 'skill', name: 'multi', description: 'd',
      scopes: ['personal', 'project'], metadata: meta, source: WORKSPACE_SOURCE, content: 'b' };
    const linkedRepos: LinkedRepo[] = [
      { id: 'r1', name: 'app', path: '/repos/app' },
      { id: 'r2', name: 'lib', path: '/repos/lib' },
    ];
    expect(adapter.resolveEntityDestinations({ entity: skill, linkedRepos })).toEqual([
      { scope: 'personal', destination: '/home/u/.cursor/skills/multi' },
      { scope: 'project', destination: '/repos/app/.cursor/skills/multi' },
      { scope: 'project', destination: '/repos/lib/.cursor/skills/multi' },
    ]);
  });

  it('routes a project-scoped agent to <repo>/.cursor/agents/<name>.md', () => {
    const agent: Agent = { urn: 'urn:agent:triage', kind: 'agent', name: 'triage', description: 'd',
      scopes: ['project'], metadata: meta, source: WORKSPACE_SOURCE, systemPrompt: 'b' };
    const linkedRepos: LinkedRepo[] = [{ id: 'r', name: 'app', path: '/repos/app' }];
    expect(adapter.resolveEntityDestinations({ entity: agent, linkedRepos })).toEqual([
      { scope: 'project', destination: '/repos/app/.cursor/agents/triage.md' },
    ]);
  });

  it('returns [] for an instruction (deferred to Plan B — AGENTS.md write)', () => {
    const ins: Instruction = { urn: 'urn:instruction:default', kind: 'instruction', name: 'default',
      description: '', scopes: ['personal'], metadata: meta, source: WORKSPACE_SOURCE, content: 'b', activation: 'always' };
    expect(adapter.resolveEntityDestinations({ entity: ins, linkedRepos: [] })).toEqual([]);
  });
});
```

- [ ] **Step 3: Run both tests to verify they fail**

Run: `npx vitest run tests/main/infrastructure/adapters/__tests__/cursor-adapter.contract.test.ts tests/main/infrastructure/adapters/__tests__/cursor-adapter.entity-destinations.test.ts`
Expected: FAIL — `Cannot find module '.../cursor-adapter.js'`.

- [ ] **Step 4: Implement the adapter**

Create `src/main/infrastructure/adapters/cursor-adapter.ts`:

```ts
import { join } from 'node:path';
import type { Adapter, AdapterDestination } from '../../application/ports/adapter.js';
import type { LinkedRepo } from '../../../shared/settings.js';
import type { Entity } from '../../../shared/entity.js';
import { DomainError } from '../../domain/errors.js';

export interface CursorAdapterDeps {
  homedir: string;
}

/**
 * Publishes workspace entities into Cursor's native file surface via symlinks.
 * Skills (incl. slash-commands, which are explicit-only skills whose on-disk
 * SKILL.md already carries `disable-model-invocation: true`) are symlinked as
 * whole directories; agents as single `.md` files. Cursor ignores the extra
 * Claude-style frontmatter keys, reading only `name`/`description`.
 *
 * `instruction` has no home-level file in Cursor; its per-repo AGENTS.md is a
 * generated-file (`write`) case handled by Plan B, so it resolves to [] here.
 */
export class CursorAdapter implements Adapter {
  readonly adapterId = 'cursor';
  private readonly homedir: string;

  constructor(deps: CursorAdapterDeps) {
    if (deps.homedir === undefined || deps.homedir === null || deps.homedir === '') {
      throw new DomainError('internal', 'CursorAdapter requires a non-empty homedir', {
        reason: 'missing-homedir',
      });
    }
    this.homedir = deps.homedir;
  }

  resolveEntityDestinations(args: {
    entity: Entity;
    linkedRepos: LinkedRepo[];
  }): AdapterDestination[] {
    const { kind, name, scopes } = args.entity;

    if (kind !== 'skill' && kind !== 'agent') {
      return [];
    }

    const subfolder = kind === 'skill' ? '.cursor/skills' : '.cursor/agents';
    const fileName = kind === 'skill' ? name : `${name}.md`;
    const out: AdapterDestination[] = [];

    if (scopes.includes('personal')) {
      out.push({ scope: 'personal', destination: join(this.homedir, subfolder, fileName) });
    }
    if (scopes.includes('project')) {
      for (const repo of args.linkedRepos) {
        out.push({ scope: 'project', destination: join(repo.path, subfolder, fileName) });
      }
    }
    return out;
  }
}
```

- [ ] **Step 5: Run both tests to verify they pass**

Run: `npx vitest run tests/main/infrastructure/adapters/__tests__/cursor-adapter.contract.test.ts tests/main/infrastructure/adapters/__tests__/cursor-adapter.entity-destinations.test.ts`
Expected: PASS (all cases).

- [ ] **Step 6: Commit**

```bash
git add src/main/infrastructure/adapters/cursor-adapter.ts tests/main/infrastructure/adapters/__tests__/cursor-adapter.contract.test.ts tests/main/infrastructure/adapters/__tests__/cursor-adapter.entity-destinations.test.ts
git commit -m "feat(cursor): add CursorAdapter mapping skills/agents to .cursor symlinks"
```

---

### Task 3: Register `CursorAdapter` in the composition root

Wiring the adapter into the `AdapterManager` map is what actually makes Cursor sync/remove/count/health work — all of those iterate `deps.adapters`. The integration test proves the end-to-end resolution through `AdapterManager` without touching the filesystem.

**Files:**
- Modify: `src/main/index.ts` (lines 93-103 region)
- Test: `tests/main/infrastructure/adapters/__tests__/cursor-adapter.wiring.test.ts`

**Interfaces:**
- Consumes: `CursorAdapter` (Task 2); `setupAdapterManager` helper; `Settings`.
- Produces: the running app registers both `claude` and `cursor` adapters; `AdapterManager.planDestinations()` emits `cursor` entries when `adapters.cursor.enabled === true`.

- [ ] **Step 1: Write the failing wiring/integration test**

Create `tests/main/infrastructure/adapters/__tests__/cursor-adapter.wiring.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CursorAdapter } from '../../../../../src/main/infrastructure/adapters/cursor-adapter.js';
import { ClaudeAdapter } from '../../../../../src/main/infrastructure/adapters/claude-adapter.js';
import { WORKSPACE_SOURCE, type Skill } from '../../../../../src/shared/entity.js';
import type { Settings } from '../../../../../src/shared/settings.js';
import { setupAdapterManager } from '../../../application/services/__tests__/adapter-manager.helpers.js';

const skill: Skill = {
  urn: 'urn:skill:demo', kind: 'skill', name: 'demo', description: 'd',
  scopes: ['personal'], metadata: { version: '1.0.0', createdAt: '', updatedAt: '' },
  source: WORKSPACE_SOURCE, content: 'b',
};

const settings = (cursorEnabled: boolean): Settings => ({
  adapters: { claude: { enabled: true }, cursor: { enabled: cursorEnabled } },
  linkedRepos: [],
  ui: { theme: 'system' },
  language: 'off',
});

describe('CursorAdapter wiring through AdapterManager', () => {
  it('plans a ~/.cursor destination when cursor is enabled', async () => {
    const claude = new ClaudeAdapter({ homedir: '/home/u' });
    const cursor = new CursorAdapter({ homedir: '/home/u' });
    const { manager, registerEntity } = await setupAdapterManager([claude, cursor], settings(true));
    await registerEntity(skill);

    const plan = await manager.planDestinations();
    const destinations = plan.map((p) => p.destination);

    expect(destinations).toContain('/home/u/.cursor/skills/demo');
    expect(destinations).toContain('/home/u/.claude/skills/demo');
  });

  it('plans NO .cursor destination when cursor is disabled', async () => {
    const claude = new ClaudeAdapter({ homedir: '/home/u' });
    const cursor = new CursorAdapter({ homedir: '/home/u' });
    const { manager, registerEntity } = await setupAdapterManager([claude, cursor], settings(false));
    await registerEntity(skill);

    const plan = await manager.planDestinations();

    expect(plan.some((p) => p.destination.includes('/.cursor/'))).toBe(false);
    expect(plan.some((p) => p.adapterId === 'cursor')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/main/infrastructure/adapters/__tests__/cursor-adapter.wiring.test.ts`
Expected: the "enabled" case FAILS (no `/home/u/.cursor/skills/demo` in the plan) because the manager under test only knows the adapters it is handed — here it already gets `cursor`, so this test actually passes on the helper alone. The value is regression protection; if it passes immediately, that's fine — proceed. (The genuine wiring change is Step 3 in `index.ts`, which the helper does not exercise.)

> Note: this integration test validates the *manager-level* behaviour with a registered CursorAdapter. `index.ts` itself has no unit test in this codebase (composition root); its correctness is covered by typecheck + Step 4's manual check.

- [ ] **Step 3: Register the adapter in `index.ts`**

In `src/main/index.ts`, add the import beside the existing ClaudeAdapter import (line 18):

```ts
import { CursorAdapter } from './infrastructure/adapters/cursor-adapter.js';
```

Then, in `wireIpc`, construct it next to `claudeAdapter` (line 93) and add it to the `adapters` map (lines 100-102):

```ts
  const claudeAdapter = new ClaudeAdapter({ homedir: homedir() });
  const cursorAdapter = new CursorAdapter({ homedir: homedir() });
  const entityRepository = new FsEntityRepository(workspacePath);
  const adapterManager = new AdapterManager({
    settingsService,
    entityRepository,
    symlinkManager,
    workspacePath,
    adapters: new Map<string, Adapter>([
      [claudeAdapter.adapterId, claudeAdapter],
      [cursorAdapter.adapterId, cursorAdapter],
    ]),
  });
```

- [ ] **Step 4: Verify typecheck + the integration test + a manual smoke check**

Run: `npm run typecheck && npx vitest run tests/main/infrastructure/adapters/__tests__/cursor-adapter.wiring.test.ts`
Expected: typecheck clean; both cases pass.

Manual smoke (optional but recommended): `npm run dev`, open Settings — the Cursor toggle (Task 4) appears; enabling it and running a sync creates `~/.cursor/skills/<name>` symlinks. (If Task 4 is not yet done, defer this to after Task 4.)

- [ ] **Step 5: Commit**

```bash
git add src/main/index.ts tests/main/infrastructure/adapters/__tests__/cursor-adapter.wiring.test.ts
git commit -m "feat(cursor): register CursorAdapter in the composition root"
```

---

### Task 4: Cursor toggle in the Settings screen

**Files:**
- Modify: `src/renderer/screens/Settings.tsx`
- Test: `tests/renderer/screens/settings/adapters-section.test.tsx`

**Interfaces:**
- Consumes: `Settings.adapters.cursor` (Task 1); existing `adapter.setEnabled` / `adapter.countDestinations` IPC (already adapter-id-generic).
- Produces: a "Cursor" checkbox in the Adapters card, wired to the same `handleAdapterToggle` / `ConfirmDisableModal` flow as Claude, keyed by `adapterId: 'cursor'`.

- [ ] **Step 1: Write the failing renderer test**

Add to `tests/renderer/screens/settings/adapters-section.test.tsx`. First widen the shared `baseSettings` literal (top of file) to include cursor:

```ts
const baseSettings: Settings = {
  adapters: { claude: { enabled: true }, cursor: { enabled: false } },
  linkedRepos: [],
  ui: { theme: 'system' },
  language: 'off',
};
```

Then add the new describe block:

```ts
describe('<Settings> — cursor adapter toggle', () => {
  it('renders a Cursor checkbox reflecting settings.adapters.cursor.enabled', async () => {
    setupRoute();
    render(<SettingsScreen />);
    const toggle = (await screen.findByLabelText('Cursor')) as HTMLInputElement;
    expect(toggle.checked).toBe(false);
  });

  it('toggling cursor on calls adapter.setEnabled with adapterId:"cursor"', async () => {
    const user = userEvent.setup();
    setupRoute();
    render(<SettingsScreen />);

    const toggle = await screen.findByLabelText('Cursor');
    await user.click(toggle);

    await waitFor(() =>
      expect(call).toHaveBeenCalledWith(
        'adapter.setEnabled',
        expect.objectContaining({ adapterId: 'cursor', enabled: true }),
      ),
    );
  });

  it('toggling cursor off (when enabled) opens the disable modal for Cursor', async () => {
    const user = userEvent.setup();
    call.mockImplementation((method: string) => {
      if (method === 'settings.get')
        return Promise.resolve(
          ok({ ...baseSettings, adapters: { claude: { enabled: true }, cursor: { enabled: true } } }),
        );
      if (method === 'repo.list') return Promise.resolve(ok([]));
      if (method === 'adapter.countDestinations') return Promise.resolve(ok({ count: 3 }));
      return Promise.resolve(ok(undefined));
    });
    render(<SettingsScreen />);

    const toggle = await screen.findByLabelText('Cursor');
    await user.click(toggle);

    await waitFor(() =>
      expect(call).toHaveBeenCalledWith('adapter.countDestinations', { adapterId: 'cursor' }),
    );
    expect(await screen.findByTestId('confirm-disable-modal')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/renderer/screens/settings/adapters-section.test.tsx`
Expected: FAIL — `findByLabelText('Cursor')` finds nothing (only "Claude" is rendered).

- [ ] **Step 3: Add a label map and widen the adapter-key literals**

In `src/renderer/screens/Settings.tsx`, add a module-level constant near the other local constants (e.g. just below the imports / `LANGUAGE_OPTIONS`):

```ts
const ADAPTER_KEYS = ['claude', 'cursor'] as const;
type AdapterKey = (typeof ADAPTER_KEYS)[number];
const ADAPTER_LABEL: Record<AdapterKey, string> = { claude: 'Claude', cursor: 'Cursor' };
```

Widen the `disableModal` state (lines 66-69) and both handlers (`handleAdapterToggle` line 124, and the `key` type inside `handleDisableConfirm` is inferred from state, so no change there):

```ts
  const [disableModal, setDisableModal] = useState<{
    key: AdapterKey;
    count: number;
  } | null>(null);
```

```ts
  const handleAdapterToggle = async (
    key: AdapterKey,
    enabled: boolean,
  ): Promise<void> => {
```

- [ ] **Step 4: Render both toggles from the map**

Replace the Adapters `FormGroup` body (Settings.tsx lines 281-294):

```tsx
        <FormGroup>
          {ADAPTER_KEYS.map((key) => (
            <FormControlLabel
              key={key}
              control={
                <Checkbox
                  id={`adapter-${key}`}
                  checked={settings.adapters[key].enabled}
                  onChange={(e) => void handleAdapterToggle(key, e.target.checked)}
                />
              }
              label={ADAPTER_LABEL[key]}
            />
          ))}
        </FormGroup>
```

And pass the per-adapter name to the disable modal (Settings.tsx line ~488, the `<ConfirmDisableModal>` render):

```tsx
  {disableModal !== null && (
    <ConfirmDisableModal
      adapterName={ADAPTER_LABEL[disableModal.key]}
      count={disableModal.count}
      onConfirmRemove={() => void handleDisableConfirm(true)}
      onConfirmNoRemove={() => void handleDisableConfirm(false)}
      onCancel={() => setDisableModal(null)}
    />
  )}
```

- [ ] **Step 5: Run the renderer test to verify it passes**

Run: `npx vitest run tests/renderer/screens/settings/adapters-section.test.tsx`
Expected: PASS (all three new cases + the pre-existing Claude cases).

- [ ] **Step 6: Full gate — lint, typecheck, whole suite**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/screens/Settings.tsx tests/renderer/screens/settings/adapters-section.test.tsx
git commit -m "feat(cursor): add Cursor adapter toggle to the Settings screen"
```

---

## Self-Review (completed by plan author)

**Spec coverage (against `2026-07-01-cursor-adapter-design.md`, reconciled to the Entity model):**
- Skill personal/project → `.cursor/skills/<name>/` symlink — Task 2/3. ✓
- Agent personal/project → `.cursor/agents/<name>.md` symlink — Task 2/3. ✓
- Command personal/project → **collapses into skill symlink** (explicit-only skill; `disable-model-invocation` already in SKILL.md) — Task 2 (explicit-only test case). ✓
- `adapters.cursor.enabled` setting + Cursor toggle — Task 1 + Task 4. ✓
- Health surfaces Cursor symlinks — **free**: `SymlinkCollector.planDestinations()` iterates enabled adapters, so cursor symlinks appear under the existing `symlink` category once Task 3 registers the adapter (regression-covered by Task 3's wiring test). ✓
- **Deferred to Plan B** (explicitly out of scope here): `instruction → AGENTS.md` (Decision 5), the `write` strategy + `FileMaterializer` + manifest/marker (Decision 2, §5.2/5.3), the link-a-repo notice (§7), generated-file health collector (§6). Cross-referenced in Global Constraints and Task 2 (instruction → []).

**Placeholder scan:** none — every code step shows complete code; the fixture sweep (Task 1 Step 6) is compiler-driven with the exact edit shown and the file set enumerated.

**Type consistency:** `AdapterDestination` shape unchanged (`{ scope, destination }`) — Plan A does not touch the port. `adapterId = 'cursor'` used consistently in adapter, wiring test, renderer toggle. `AdapterKey`/`ADAPTER_LABEL` introduced in Task 4 and used at both the toggle and the modal. `Settings.adapters.cursor` required type is set in Task 1 before any consumer (Tasks 3, 4) reads it.
