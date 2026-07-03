# Canonical Entity Model — Phase 0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the polymorphic `Customization` model with a tool-agnostic canonical `Entity` contract plus concrete `Skill`/`Agent`/`Instruction` types and a serializer boundary, migrating the three `.md`-backed entities, folding `command` away, and reshaping `global-instruction → instruction`.

**Architecture:** Introduce `Entity` + concrete types in `src/shared/`, an `EntitySerializer` that maps a canonical entity ↔ the Claude on-disk `.md` format (which stays the storage format), and an `EntityRepository`/`EntityService` pipeline that replaces `CustomizationService`/`CustomizationRepository`. The Claude adapter keeps syncing by **symlink** (identity): skills/agents symlink their `.md`, and instructions symlink a **frontmatter-free** file to both `~/.claude/CLAUDE.md` and `~/AGENTS.md`. New canonical infrastructure is built additively (Group A/B), main-process services are cut over one kind at a time (Group C), then IPC and renderer are migrated (Group D/E) and the dead `Customization` code is deleted last (Group F).

**Tech Stack:** TypeScript (strict), Electron + electron-vite, React 18 + MUI + react-query (renderer), Zod (schema validation), `yaml` (frontmatter), Vitest (node + jsdom projects), `simple-git`/`@octokit/rest` (unaffected here).

## Global Constraints

- **Package manager:** `npm` (canonical; `package-lock.json` committed). Never introduce a new dependency without flagging it — this plan introduces **none**.
- **Imports use `.js` extensions** on all relative source imports even though the source is `.ts` (required by `verbatimModuleSyntax` + NodeNext ESM). Example: `import { entityUrn } from '../../../shared/entity.js'`.
- **Strict TS:** `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch` are all on. `arr[0]` is `T | undefined`; optional properties must be omitted (conditional spread), never set to explicit `undefined`, unless the field is typed `T | undefined`.
- **Type imports:** use `import type { … }` for type-only imports (enforced by `verbatimModuleSyntax`).
- **Hexagonal rule:** services depend on **ports**, never on `node:fs`/`electron`/`simple-git` directly. Concrete I/O lives in `src/main/infrastructure/`. `src/shared/` must not import from `src/main/` (shared is imported *by* main and renderer).
- **Release gate (must stay green after every task):** `npm run lint` (`eslint .`), `npm run typecheck` (`tsc --noEmit -p tsconfig.node.json && tsc --noEmit -p tsconfig.web.json`), and `npm test` (`vitest run --coverage`). Coverage thresholds are **lines 80 / functions 76 / statements 78 / branches 66** on `src/main/{application,ipc,infrastructure}` and `src/renderer/screens` + `App.tsx`. New code must carry tests that keep these green.
- **Two Vitest projects:** `node` runs `tests/main/**` + `tests/shared/**` (env node); `jsdom` runs `tests/renderer/**` (env jsdom, setup `tests/renderer/setup.ts`). Renderer tests mock the IPC boundary via `window.api.call`, so the two projects are independently green — this is what lets Group C (main) and Group E (renderer) land as separate green tasks.
- **UI copy is pt-BR; all code, identifiers, comments, and test descriptions are English.**
- **Frozen clock in tests:** use the repo's `FixedClock` with `new Date('2026-04-26T10:00:00.000Z')` (the established convention). `Date.now()` is fine in production code via the `ClockPort`.
- **Ignore `.claude/worktrees/**`** — those are stale duplicate copies of the source tree, not live code.

## Design decisions locked for this plan

1. **Canonical types live in `src/shared/entity.ts`** so both the renderer (web tsconfig) and main (node tsconfig) import them. The spec's `Entity` §4 contract is extended with a **`source: EntitySource`** provenance field (workspace | plugin) — the app requires it for plugin read-only enforcement and the renderer's plugin badge. Because `src/shared` cannot import branded `PluginId` from `src/main/domain`, `EntitySource.pluginId` is a plain `string` (same approach as the existing `McpProvenance` in `src/shared/mcp.ts`); a branded `PluginId` is still assignable to it.
2. **`urn` is derived, never persisted.** `urn = \`urn:${kind}:${name}\``. The `.md` files store no urn.
3. **Storage stays Claude `.md`.** The `EntitySerializer` maps canonical `Entity` ↔ `.md`. For skills/agents the on-disk frontmatter layout is **kept flat and identical to today** (top-level `name`/`type`/`description`/`scopes`/`version`/`tags`/`createdAt`/`updatedAt`, plus `disable-model-invocation` for `explicitOnly`), so files stay compatible while both the old `Fs*CustomizationRepository` and the new `FsEntityRepository` coexist mid-migration. (Moving `version` under a nested `metadata:` per the SKILL.md standard is Phase 2 / neutral-emitter work, out of scope here.)
4. **Instruction is stored frontmatter-free** (plain markdown at `instructions/default.md`) and symlinked to **both** `~/.claude/CLAUDE.md` and `~/AGENTS.md`. Its `metadata` (`version` → `'0.0.0'`, `createdAt`/`updatedAt` → `''`) is **synthesized on load** (no `FileSystemPort` change). The instruction repository reads `instructions/default.md`, falling back **read-only** to the legacy `global-instructions/default.md` (frontmatter is stripped on parse), so an existing default instruction is preserved without a migration service.
5. **`command` is removed as an entity/view; no on-disk migration.** Existing `commands/*.md` are left orphaned (no longer listed, synced, or shown). The `Skill` type gains `explicitOnly?: boolean` (↔ Claude `disable-model-invocation: true`) for *future* command-like skills, but nothing migrates old command files.
6. **IPC:** `skill.*` and `agent.*` keep their method names (payload shape changes to canonical). `global-instruction.get`/`.save` → `instruction.get`/`.save`. `command.*` handlers are removed.
7. **Renderer file/symbol renames are deliberately deferred.** Component *files* keep their current names (`CustomizationListScreen.tsx`, `CustomizationEditor.tsx`, `CustomizationViewDrawer.tsx`, `use-customization-list.ts`) to keep this plan's diff focused on the *model*. The `Customization`/`CustomizationFrontmatter` **types** are fully removed; only the cosmetic filename sweep is left for a follow-up PR.
8. **Shared persistence is not "the deprecated umbrella."** The generic save/rename/timestamp/validate/sync logic moves into a new `EntityService` (generic over `Entity`, kind-aware). The typed facades (`SkillService`/`AgentService`/`InstructionService`) wrap it and add plugin-provenance merging, exactly as they wrap `CustomizationService` today.

## File Structure

**Created**
- `src/shared/entity.ts` — `EntityKind`, `Scope`, `EntitySource`, `EntityMetadata`, `Entity`, `Skill`, `Agent`, `Instruction`, `InstructionActivation`, `entityUrn`, `parseUrn`, type guards.
- `src/shared/sync-result.ts` — `SyncStatus`, `SyncResultDetails`, `SyncResult` (moved out of `customization.ts`).
- `src/main/application/entity/entity-serializer.ts` — `renderEntityFile`, `parseEntityFile`.
- `src/main/application/ports/entity-repository.ts` — `EntityRepository` port + query types.
- `src/main/infrastructure/entity/fs-entity-repository.ts` — `FsEntityRepository`.
- `src/main/infrastructure/entity/in-memory-entity-repository.ts` — `InMemoryEntityRepository`.
- `src/main/application/services/entity-service.ts` — generic `EntityService`.
- `src/main/application/schemas/entity-schema.ts` — Zod `entitySchema`, `skillEntitySchema`, `agentEntitySchema`, `instructionEntitySchema`.
- `src/main/application/services/entity-validator.ts` — `EntityValidator` (validates a canonical `Entity` by kind).
- `src/main/application/services/entity-plugin-helpers.ts` — `collectPluginEntities` (canonical), reuses `assertNotPluginSourced`.
- `src/main/application/services/instruction-service.ts` — `InstructionService` (singleton).
- `src/main/ipc/instruction-handlers.ts` — `buildInstructionHandlers`.
- Test files mirroring each of the above under `tests/main/**` and `tests/shared/**`.

**Modified**
- `src/main/application/ports/adapter.ts` — add `resolveEntityDestinations`.
- `src/main/infrastructure/adapters/claude-adapter.ts` — implement `resolveEntityDestinations`.
- `src/main/application/services/adapter-manager.ts` — add `syncEntity`/`removeEntity`/`entitySourcePath`.
- `src/main/application/services/skill-service.ts`, `agent-service.ts` — return canonical entities.
- `src/main/ipc/skill-handlers.ts`, `agent-handlers.ts`, `registry.ts` — canonical payloads; drop command; add instruction; rename GI.
- `src/main/index.ts` — wire new repo/services; drop command/GI wiring at cleanup.
- `src/renderer/hooks/use-customization-list.ts`, `components/CustomizationListScreen.tsx`, `components/CustomizationEditor.tsx`, `components/CustomizationViewDrawer.tsx`, `components/PluginRelatedEntities.tsx`, `components/EntityDataGrid/*`, `lib/blank-customization.ts`, `lib/default-global-instruction.ts`, `screens/global-instructions/GlobalInstructionScreen.tsx`, `screens/Main.tsx`, `components/shell/nav.ts`.

**Deleted (Group F)**
- `src/main/application/services/customization-service.ts`, `command-service.ts`, `global-instruction-service.ts`, `customization-plugin-helpers.ts`.
- `src/main/application/ports/customization-repository.ts`.
- `src/main/infrastructure/customization/fs-customization-repository.ts`, `in-memory-customization-repository.ts`, `normalize-frontmatter.ts`.
- `src/main/application/schemas/{common,skill,agent,command,global-instruction}.ts`, `schema-validator.ts`.
- `src/main/domain/customization-id.ts`, `command-id.ts` (+ its tests).
- `src/main/ipc/command-handlers.ts`, `global-instruction-handlers.ts`.
- `src/renderer/screens/commands/CommandList.tsx`.
- `Customization`/`CustomizationFrontmatter`/`CustomizationType`/`CustomizationScope` from `src/shared/customization.ts` (file removed once `SyncResult` has moved and no importers remain).
- Old `AdapterManager.syncOne`/`syncAll`/`removeOne`/`removeAll` customization args + `ClaudeAdapter.resolveDestinations` (once no caller remains).

---

## Group A — Canonical foundation (additive; nothing consumes it yet)

### Task 1: Canonical `Entity` types + URN helpers

**Files:**
- Create: `src/shared/entity.ts`
- Test: `tests/shared/entity.test.ts`

**Interfaces:**
- Consumes: nothing (leaf module, no imports).
- Produces: `EntityKind`, `Scope`, `EntityProvenance`, `EntitySource`, `WORKSPACE_SOURCE`, `EntityMetadata`, `Entity`, `InstructionActivation`, `Skill`, `Agent`, `Instruction`, `entityUrn(kind, name): string`, `parseUrn(urn): { kind: EntityKind; name: string }`, `isPluginSource`, `isWorkspaceSource`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/shared/entity.test.ts
import { describe, it, expect } from 'vitest';
import {
  entityUrn,
  parseUrn,
  isPluginSource,
  isWorkspaceSource,
  WORKSPACE_SOURCE,
  type Skill,
} from '../../src/shared/entity.js';

describe('entityUrn', () => {
  it('derives urn:{kind}:{name}', () => {
    expect(entityUrn('skill', 'code-review')).toBe('urn:skill:code-review');
    expect(entityUrn('instruction', 'default')).toBe('urn:instruction:default');
  });
});

describe('parseUrn', () => {
  it('round-trips a urn back to kind + name', () => {
    expect(parseUrn('urn:mcp:figma')).toEqual({ kind: 'mcp', name: 'figma' });
  });

  it('keeps colons that appear in the name segment', () => {
    expect(parseUrn('urn:hook:pre:commit')).toEqual({ kind: 'hook', name: 'pre:commit' });
  });

  it('throws on a malformed urn', () => {
    expect(() => parseUrn('not-a-urn')).toThrow(/Invalid URN/);
  });
});

describe('source guards', () => {
  it('classifies workspace and plugin sources', () => {
    expect(isWorkspaceSource(WORKSPACE_SOURCE)).toBe(true);
    expect(isPluginSource({ kind: 'plugin', pluginId: 'p', provenance: 'workspace-managed' })).toBe(true);
  });
});

describe('Skill type', () => {
  it('is assignable with the canonical shape', () => {
    const skill: Skill = {
      urn: 'urn:skill:demo',
      kind: 'skill',
      name: 'demo',
      description: 'a demo skill',
      scopes: ['personal'],
      metadata: { version: '0.1.0', createdAt: '', updatedAt: '' },
      source: WORKSPACE_SOURCE,
      content: '# Demo\n',
    };
    expect(skill.kind).toBe('skill');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/shared/entity.test.ts`
Expected: FAIL — cannot resolve `../../src/shared/entity.js`.

- [ ] **Step 3: Create `src/shared/entity.ts`**

```ts
// src/shared/entity.ts
export type EntityKind = 'skill' | 'agent' | 'mcp' | 'instruction' | 'hook';

export type Scope = 'personal' | 'project';

export type EntityProvenance = 'workspace-managed' | 'claude-code';

export type EntitySource =
  | { kind: 'workspace' }
  | { kind: 'plugin'; pluginId: string; provenance: EntityProvenance };

export const WORKSPACE_SOURCE: EntitySource = { kind: 'workspace' };

export function isPluginSource(
  source: EntitySource,
): source is { kind: 'plugin'; pluginId: string; provenance: EntityProvenance } {
  return source.kind === 'plugin';
}

export function isWorkspaceSource(source: EntitySource): source is { kind: 'workspace' } {
  return source.kind === 'workspace';
}

export interface EntityMetadata {
  version: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Entity {
  urn: string;
  kind: EntityKind;
  name: string;
  description: string;
  scopes: Scope[];
  metadata: EntityMetadata;
  source: EntitySource;
  ext?: Record<string, unknown>;
}

export interface Skill extends Entity {
  kind: 'skill';
  content: string;
  explicitOnly?: boolean;
}

export interface Agent extends Entity {
  kind: 'agent';
  systemPrompt: string;
  model?: string;
  tools?: string[];
  deniedTools?: string[];
}

export type InstructionActivation = 'always' | 'glob' | 'agent-requested' | 'manual';

export interface Instruction extends Entity {
  kind: 'instruction';
  content: string;
  activation: InstructionActivation;
  globs?: string[];
}

export function entityUrn(kind: EntityKind, name: string): string {
  return `urn:${kind}:${name}`;
}

export function parseUrn(urn: string): { kind: EntityKind; name: string } {
  const match = /^urn:([a-z]+):(.+)$/.exec(urn);
  const kind = match?.[1];
  const name = match?.[2];
  if (kind === undefined || name === undefined) {
    throw new Error(`Invalid URN: ${urn}`);
  }
  return { kind: kind as EntityKind, name };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/shared/entity.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck`
Expected: no errors.

```bash
git add src/shared/entity.ts tests/shared/entity.test.ts
git commit -m "feat(shared): add canonical Entity contract and URN helpers"
```

---

### Task 2: Move `SyncResult` out of `customization.ts`

The canonical stack must not depend on `shared/customization.ts` (which is deleted in Group F). `SyncResult` is imported by many files, so extract it now and re-export it from `customization.ts` to keep every existing importer green.

**Files:**
- Create: `src/shared/sync-result.ts`
- Modify: `src/shared/customization.ts:22-38`
- Test: `tests/shared/sync-result.test.ts`

**Interfaces:**
- Produces: `SyncStatus`, `SyncResultDetails`, `SyncResult` (same shapes as today).

- [ ] **Step 1: Write the failing test**

```ts
// tests/shared/sync-result.test.ts
import { describe, it, expect } from 'vitest';
import type { SyncResult } from '../../src/shared/sync-result.js';

describe('SyncResult', () => {
  it('accepts an ok result with a destination', () => {
    const r: SyncResult = { adapter: 'claude', destination: '/x', status: 'ok' };
    expect(r.status).toBe('ok');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/shared/sync-result.test.ts`
Expected: FAIL — cannot resolve `sync-result.js`.

- [ ] **Step 3: Create `src/shared/sync-result.ts`** (verbatim shapes moved from `customization.ts`)

```ts
// src/shared/sync-result.ts
export type SyncStatus = 'ok' | 'conflict' | 'error';

export interface SyncResultDetails {
  backupPath?: string;
  replacedTarget?: string;
  skipped?: 'no-linked-repos' | 'not-found';
  reason?: string;
  action?: 'overwritten';
}

export interface SyncResult {
  adapter: string;
  destination: string | null;
  status: SyncStatus;
  message?: string;
  details?: SyncResultDetails;
}
```

- [ ] **Step 4: Re-export from `customization.ts` so existing importers still resolve**

Replace the inline `SyncStatus`/`SyncResultDetails`/`SyncResult` block (`src/shared/customization.ts:22-38`) with a re-export, leaving the `Customization*` types untouched for now:

```ts
// src/shared/customization.ts  (keep the Customization* types above this line)
export type { SyncStatus, SyncResultDetails, SyncResult } from './sync-result.js';
```

- [ ] **Step 5: Run the full suite to confirm no importer broke**

Run: `npm run typecheck && npx vitest run tests/shared`
Expected: PASS; typecheck clean (all `SyncResult` importers still resolve via the re-export).

- [ ] **Step 6: Commit**

```bash
git add src/shared/sync-result.ts src/shared/customization.ts tests/shared/sync-result.test.ts
git commit -m "refactor(shared): extract SyncResult into its own module"
```

---

### Task 3: `EntitySerializer` — canonical `Entity` ↔ Claude `.md`

**Files:**
- Create: `src/main/application/entity/entity-serializer.ts`
- Test: `tests/main/application/entity/entity-serializer.test.ts`

**Interfaces:**
- Consumes: `parseMarkdown`, `serializeMarkdown` from `../markdown/frontmatter.js` (existing; `parseMarkdown<T>(raw): { frontmatter: T; body: string }`, `serializeMarkdown(frontmatter, body): string`); `Entity`, `Skill`, `Agent`, `Instruction`, `EntityKind`, `EntitySource`, `entityUrn` from `../../../shared/entity.js`.
- Produces: `renderEntityFile(entity: Entity): string`, `parseEntityFile(args: { kind: EntityKind; name: string; raw: string; source: EntitySource }): Entity`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/main/application/entity/entity-serializer.test.ts
import { describe, it, expect } from 'vitest';
import { renderEntityFile, parseEntityFile } from '../../../../src/main/application/entity/entity-serializer.js';
import { WORKSPACE_SOURCE, type Skill, type Agent, type Instruction } from '../../../../src/shared/entity.js';

const baseMeta = { version: '0.1.0', createdAt: '2026-04-26T10:00:00.000Z', updatedAt: '2026-04-26T10:00:00.000Z' };

describe('renderEntityFile — skill', () => {
  it('emits flat Claude frontmatter and the content as body', () => {
    const skill: Skill = {
      urn: 'urn:skill:demo', kind: 'skill', name: 'demo', description: 'a demo',
      scopes: ['personal'], metadata: baseMeta, source: WORKSPACE_SOURCE, content: '# Demo\n',
    };
    const raw = renderEntityFile(skill);
    expect(raw).toContain('name: demo');
    expect(raw).toContain('type: skill');
    expect(raw).toContain('version: 0.1.0');
    expect(raw).toContain('# Demo');
    expect(raw).not.toContain('disable-model-invocation');
  });

  it('maps explicitOnly to disable-model-invocation: true', () => {
    const skill: Skill = {
      urn: 'urn:skill:cmd', kind: 'skill', name: 'cmd', description: 'a command skill',
      scopes: ['personal'], metadata: baseMeta, source: WORKSPACE_SOURCE, content: 'body', explicitOnly: true,
    };
    expect(renderEntityFile(skill)).toContain('disable-model-invocation: true');
  });
});

describe('parseEntityFile — skill round-trip', () => {
  it('parses frontmatter back into a canonical skill with ext passthrough', () => {
    const raw = [
      '---', 'name: demo', 'type: skill', 'description: a demo',
      'scopes:', '  - personal', 'version: 0.1.0',
      'createdAt: 2026-04-26T10:00:00.000Z', 'updatedAt: 2026-04-26T10:00:00.000Z',
      'license: MIT', 'disable-model-invocation: true', '---', '# Demo', '',
    ].join('\n');
    const entity = parseEntityFile({ kind: 'skill', name: 'demo', raw, source: WORKSPACE_SOURCE }) as Skill;
    expect(entity.urn).toBe('urn:skill:demo');
    expect(entity.name).toBe('demo');
    expect(entity.description).toBe('a demo');
    expect(entity.metadata.version).toBe('0.1.0');
    expect(entity.explicitOnly).toBe(true);
    expect(entity.content.trim()).toBe('# Demo');
    expect(entity.ext).toEqual({ license: 'MIT' });
  });
});

describe('agent', () => {
  it('maps systemPrompt to body and model/tools to frontmatter', () => {
    const agent: Agent = {
      urn: 'urn:agent:rev', kind: 'agent', name: 'rev', description: 'reviewer',
      scopes: ['personal'], metadata: baseMeta, source: WORKSPACE_SOURCE,
      systemPrompt: 'You review code.', model: 'inherit', tools: ['Read', 'Grep'],
    };
    const raw = renderEntityFile(agent);
    expect(raw).toContain('model: inherit');
    expect(raw).toContain('You review code.');
    const parsed = parseEntityFile({ kind: 'agent', name: 'rev', raw, source: WORKSPACE_SOURCE }) as Agent;
    expect(parsed.systemPrompt.trim()).toBe('You review code.');
    expect(parsed.model).toBe('inherit');
    expect(parsed.tools).toEqual(['Read', 'Grep']);
  });
});

describe('instruction — frontmatter-free', () => {
  it('renders plain markdown with no frontmatter', () => {
    const ins: Instruction = {
      urn: 'urn:instruction:default', kind: 'instruction', name: 'default', description: '',
      scopes: ['personal'], metadata: baseMeta, source: WORKSPACE_SOURCE,
      content: '# Global instructions\nReply in pt-BR.\n', activation: 'always',
    };
    const raw = renderEntityFile(ins);
    expect(raw.startsWith('---')).toBe(false);
    expect(raw).toContain('# Global instructions');
  });

  it('parses a legacy file by stripping any frontmatter, synthesizing metadata', () => {
    const legacy = ['---', 'name: default', 'type: global-instruction', '---', '# Hi', ''].join('\n');
    const ins = parseEntityFile({ kind: 'instruction', name: 'default', raw: legacy, source: WORKSPACE_SOURCE }) as Instruction;
    expect(ins.content.trim()).toBe('# Hi');
    expect(ins.activation).toBe('always');
    expect(ins.metadata.version).toBe('0.0.0');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/main/application/entity/entity-serializer.test.ts`
Expected: FAIL — cannot resolve `entity-serializer.js`.

- [ ] **Step 3: Create `src/main/application/entity/entity-serializer.ts`**

```ts
// src/main/application/entity/entity-serializer.ts
import { parseMarkdown, serializeMarkdown } from '../markdown/frontmatter.js';
import { entityUrn } from '../../../shared/entity.js';
import type {
  Agent,
  Entity,
  EntityKind,
  EntityMetadata,
  EntitySource,
  Instruction,
  Scope,
  Skill,
} from '../../../shared/entity.js';

// Frontmatter keys the serializer maps to typed fields; everything else is `ext` passthrough.
const COMMON_KEYS = ['name', 'type', 'description', 'scopes', 'version', 'tags', 'createdAt', 'updatedAt'];
const SKILL_KEYS = [...COMMON_KEYS, 'disable-model-invocation'];
const AGENT_KEYS = [...COMMON_KEYS, 'model', 'tools', 'deniedTools'];

function extOf(frontmatter: Record<string, unknown>, known: string[]): Record<string, unknown> | undefined {
  const ext: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(frontmatter)) {
    if (!known.includes(k)) ext[k] = v;
  }
  return Object.keys(ext).length > 0 ? ext : undefined;
}

function metaFrontmatter(entity: Entity): Record<string, unknown> {
  return {
    name: entity.name,
    type: entity.kind,
    description: entity.description,
    scopes: entity.scopes,
    version: entity.metadata.version,
    ...(entity.metadata.tags !== undefined ? { tags: entity.metadata.tags } : {}),
    createdAt: entity.metadata.createdAt,
    updatedAt: entity.metadata.updatedAt,
  };
}

function readMetadata(fm: Record<string, unknown>): EntityMetadata {
  return {
    version: typeof fm['version'] === 'string' ? fm['version'] : '0.0.0',
    ...(Array.isArray(fm['tags']) ? { tags: fm['tags'] as string[] } : {}),
    createdAt: typeof fm['createdAt'] === 'string' ? fm['createdAt'] : '',
    updatedAt: typeof fm['updatedAt'] === 'string' ? fm['updatedAt'] : '',
  };
}

function readScopes(fm: Record<string, unknown>): Scope[] {
  const raw = fm['scopes'];
  if (Array.isArray(raw)) return raw.filter((s): s is Scope => s === 'personal' || s === 'project');
  return ['personal'];
}

export function renderEntityFile(entity: Entity): string {
  if (entity.kind === 'instruction') {
    // Frontmatter-free: the body is the whole file.
    const content = (entity as Instruction).content;
    return content.endsWith('\n') ? content : `${content}\n`;
  }
  if (entity.kind === 'skill') {
    const skill = entity as Skill;
    const fm: Record<string, unknown> = {
      ...metaFrontmatter(skill),
      ...(skill.explicitOnly ? { 'disable-model-invocation': true } : {}),
      ...(skill.ext ?? {}),
    };
    return serializeMarkdown(fm, skill.content);
  }
  if (entity.kind === 'agent') {
    const agent = entity as Agent;
    const fm: Record<string, unknown> = {
      ...metaFrontmatter(agent),
      ...(agent.model !== undefined ? { model: agent.model } : {}),
      ...(agent.tools !== undefined ? { tools: agent.tools } : {}),
      ...(agent.deniedTools !== undefined ? { deniedTools: agent.deniedTools } : {}),
      ...(agent.ext ?? {}),
    };
    return serializeMarkdown(fm, agent.systemPrompt);
  }
  // mcp / hook are not .md-backed; Phase 1.
  throw new Error(`renderEntityFile: unsupported kind '${entity.kind}'`);
}

export function parseEntityFile(args: {
  kind: EntityKind;
  name: string;
  raw: string;
  source: EntitySource;
}): Entity {
  const { kind, name, raw, source } = args;
  const { frontmatter, body } = parseMarkdown<Record<string, unknown>>(raw);

  const base = {
    urn: entityUrn(kind, name),
    kind,
    name,
    description: typeof frontmatter['description'] === 'string' ? frontmatter['description'] : '',
    scopes: readScopes(frontmatter),
    metadata: readMetadata(frontmatter),
    source,
  };

  if (kind === 'skill') {
    const skill: Skill = {
      ...base,
      kind: 'skill',
      content: body,
      ...(frontmatter['disable-model-invocation'] === true ? { explicitOnly: true } : {}),
      ...(extOf(frontmatter, SKILL_KEYS) ? { ext: extOf(frontmatter, SKILL_KEYS) } : {}),
    };
    return skill;
  }
  if (kind === 'agent') {
    const agent: Agent = {
      ...base,
      kind: 'agent',
      systemPrompt: body,
      ...(typeof frontmatter['model'] === 'string' ? { model: frontmatter['model'] } : {}),
      ...(Array.isArray(frontmatter['tools']) ? { tools: frontmatter['tools'] as string[] } : {}),
      ...(Array.isArray(frontmatter['deniedTools']) ? { deniedTools: frontmatter['deniedTools'] as string[] } : {}),
      ...(extOf(frontmatter, AGENT_KEYS) ? { ext: extOf(frontmatter, AGENT_KEYS) } : {}),
    };
    return agent;
  }
  if (kind === 'instruction') {
    // Frontmatter-free store; parseMarkdown strips any legacy frontmatter, keeping the body.
    const instruction: Instruction = {
      ...base,
      kind: 'instruction',
      description: '',
      scopes: ['personal'],
      metadata: { version: '0.0.0', createdAt: '', updatedAt: '' },
      content: body,
      activation: 'always',
    };
    return instruction;
  }
  throw new Error(`parseEntityFile: unsupported kind '${kind}'`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/main/application/entity/entity-serializer.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck`

```bash
git add src/main/application/entity/entity-serializer.ts tests/main/application/entity/entity-serializer.test.ts
git commit -m "feat(entity): add EntitySerializer mapping Entity to/from Claude .md"
```

---

### Task 4: `EntityRepository` port + `InMemoryEntityRepository`

**Files:**
- Create: `src/main/application/ports/entity-repository.ts`
- Create: `src/main/infrastructure/entity/in-memory-entity-repository.ts`
- Test: `tests/main/infrastructure/entity/in-memory-entity-repository.test.ts`

**Interfaces:**
- Consumes: `Entity`, `EntityKind` from `../../../shared/entity.js`; `DomainError` from `../../domain/errors.js`.
- Produces: `EntityRepository` (`list(query?)`, `get(urn)`, `save(entity)`, `delete(urn)`, `exists(urn)`), `EntityListQuery`, `InMemoryEntityRepository`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/main/infrastructure/entity/in-memory-entity-repository.test.ts
import { describe, it, expect } from 'vitest';
import { InMemoryEntityRepository } from '../../../../src/main/infrastructure/entity/in-memory-entity-repository.js';
import { WORKSPACE_SOURCE, type Skill, type Agent } from '../../../../src/shared/entity.js';

const meta = { version: '0.1.0', createdAt: '', updatedAt: '' };
const skill = (name: string): Skill => ({
  urn: `urn:skill:${name}`, kind: 'skill', name, description: 'd', scopes: ['personal'],
  metadata: meta, source: WORKSPACE_SOURCE, content: 'b',
});
const agent = (name: string): Agent => ({
  urn: `urn:agent:${name}`, kind: 'agent', name, description: 'd', scopes: ['personal'],
  metadata: meta, source: WORKSPACE_SOURCE, systemPrompt: 'b',
});

describe('InMemoryEntityRepository', () => {
  it('saves, gets and lists by kind', async () => {
    const repo = new InMemoryEntityRepository();
    await repo.save(skill('a'));
    await repo.save(agent('b'));
    expect((await repo.list({ kind: 'skill' })).map((e) => e.urn)).toEqual(['urn:skill:a']);
    expect((await repo.get('urn:skill:a')).name).toBe('a');
    expect(await repo.exists('urn:agent:b')).toBe(true);
  });

  it('rejects get on a missing urn with not_found', async () => {
    const repo = new InMemoryEntityRepository();
    await expect(repo.get('urn:skill:nope')).rejects.toMatchObject({ kind: 'not_found' });
  });

  it('deep-clones on read so callers cannot mutate the store', async () => {
    const repo = new InMemoryEntityRepository();
    await repo.save(skill('a'));
    const first = (await repo.get('urn:skill:a')) as Skill;
    first.content = 'mutated';
    expect(((await repo.get('urn:skill:a')) as Skill).content).toBe('b');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/main/infrastructure/entity/in-memory-entity-repository.test.ts`
Expected: FAIL — modules do not exist.

- [ ] **Step 3: Create the port**

```ts
// src/main/application/ports/entity-repository.ts
import type { Entity, EntityKind } from '../../../shared/entity.js';

export interface EntityListQuery {
  kind?: EntityKind;
}

export interface EntityRepository {
  list(query?: EntityListQuery): Promise<Entity[]>;
  get(urn: string): Promise<Entity>;
  save(entity: Entity): Promise<Entity>;
  delete(urn: string): Promise<void>;
  exists(urn: string): Promise<boolean>;
}
```

- [ ] **Step 4: Create the in-memory adapter**

```ts
// src/main/infrastructure/entity/in-memory-entity-repository.ts
import type { Entity } from '../../../shared/entity.js';
import type { EntityListQuery, EntityRepository } from '../../application/ports/entity-repository.js';
import { DomainError } from '../../domain/errors.js';

export class InMemoryEntityRepository implements EntityRepository {
  private readonly store = new Map<string, Entity>();

  list(query?: EntityListQuery): Promise<Entity[]> {
    const all = [...this.store.values()].map((e) => structuredClone(e));
    return Promise.resolve(query?.kind ? all.filter((e) => e.kind === query.kind) : all);
  }

  get(urn: string): Promise<Entity> {
    const found = this.store.get(urn);
    if (!found) {
      return Promise.reject(new DomainError('not_found', `Entity not found: ${urn}`));
    }
    return Promise.resolve(structuredClone(found));
  }

  save(entity: Entity): Promise<Entity> {
    this.store.set(entity.urn, structuredClone(entity));
    return Promise.resolve(structuredClone(entity));
  }

  delete(urn: string): Promise<void> {
    this.store.delete(urn);
    return Promise.resolve();
  }

  exists(urn: string): Promise<boolean> {
    return Promise.resolve(this.store.has(urn));
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/main/infrastructure/entity/in-memory-entity-repository.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck + commit**

Run: `npm run typecheck`

```bash
git add src/main/application/ports/entity-repository.ts src/main/infrastructure/entity/in-memory-entity-repository.ts tests/main/infrastructure/entity/in-memory-entity-repository.test.ts
git commit -m "feat(entity): add EntityRepository port and in-memory adapter"
```

---

### Task 5: `FsEntityRepository` (on-disk store, instruction fallback)

**Files:**
- Create: `src/main/infrastructure/entity/fs-entity-repository.ts`
- Test: `tests/main/infrastructure/entity/fs-entity-repository.test.ts`

**Interfaces:**
- Consumes: `renderEntityFile`/`parseEntityFile` (Task 3); `EntityRepository`/`EntityListQuery` (Task 4); `Entity`/`EntityKind`/`WORKSPACE_SOURCE`/`parseUrn` from shared; `DomainError`; `node:fs/promises`, `node:path`, `node:crypto`.
- Produces: `FsEntityRepository` (constructed with a workspace path string or `() => string | Promise<string>`).

**Storage layout (workspace root = `~/.superset-ai-app`):** `skills/<name>/SKILL.md`, `agents/<name>.md`, `instructions/<name>.md`. Instruction `get`/`exists` fall back **read-only** to legacy `global-instructions/<name>.md`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/main/infrastructure/entity/fs-entity-repository.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FsEntityRepository } from '../../../../src/main/infrastructure/entity/fs-entity-repository.js';
import { WORKSPACE_SOURCE, type Skill, type Instruction } from '../../../../src/shared/entity.js';

const meta = { version: '0.1.0', createdAt: '2026-04-26T10:00:00.000Z', updatedAt: '2026-04-26T10:00:00.000Z' };

let ws: string;
beforeEach(async () => { ws = await mkdtemp(join(tmpdir(), 'sde-fs-entity-')); });
afterEach(async () => { await rm(ws, { recursive: true, force: true }); });

describe('FsEntityRepository — skill', () => {
  it('writes SKILL.md under skills/<name>/ and reads it back', async () => {
    const repo = new FsEntityRepository(ws);
    const skill: Skill = {
      urn: 'urn:skill:demo', kind: 'skill', name: 'demo', description: 'd', scopes: ['personal'],
      metadata: meta, source: WORKSPACE_SOURCE, content: '# Demo\n',
    };
    await repo.save(skill);
    const onDisk = await readFile(join(ws, 'skills', 'demo', 'SKILL.md'), 'utf8');
    expect(onDisk).toContain('name: demo');
    const back = (await repo.get('urn:skill:demo')) as Skill;
    expect(back.content.trim()).toBe('# Demo');
  });
});

describe('FsEntityRepository — instruction', () => {
  it('stores frontmatter-free markdown at instructions/<name>.md', async () => {
    const repo = new FsEntityRepository(ws);
    const ins: Instruction = {
      urn: 'urn:instruction:default', kind: 'instruction', name: 'default', description: '',
      scopes: ['personal'], metadata: meta, source: WORKSPACE_SOURCE, content: '# Hi\n', activation: 'always',
    };
    await repo.save(ins);
    const onDisk = await readFile(join(ws, 'instructions', 'default.md'), 'utf8');
    expect(onDisk.startsWith('---')).toBe(false);
    expect(onDisk).toContain('# Hi');
  });

  it('falls back to legacy global-instructions/default.md on get', async () => {
    await mkdir(join(ws, 'global-instructions'), { recursive: true });
    await writeFile(join(ws, 'global-instructions', 'default.md'),
      ['---', 'name: default', 'type: global-instruction', '---', '# Legacy body', ''].join('\n'), 'utf8');
    const repo = new FsEntityRepository(ws);
    const ins = (await repo.get('urn:instruction:default')) as Instruction;
    expect(ins.content.trim()).toBe('# Legacy body');
  });
});

describe('FsEntityRepository — list & delete', () => {
  it('lists skills and agents, and get on a missing urn rejects not_found', async () => {
    const repo = new FsEntityRepository(ws);
    await repo.save({ urn: 'urn:skill:a', kind: 'skill', name: 'a', description: 'd',
      scopes: ['personal'], metadata: meta, source: WORKSPACE_SOURCE, content: 'b' } as Skill);
    expect((await repo.list({ kind: 'skill' })).map((e) => e.name)).toEqual(['a']);
    await repo.delete('urn:skill:a');
    await expect(repo.get('urn:skill:a')).rejects.toMatchObject({ kind: 'not_found' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/main/infrastructure/entity/fs-entity-repository.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/main/infrastructure/entity/fs-entity-repository.ts`**

```ts
// src/main/infrastructure/entity/fs-entity-repository.ts
import { randomBytes } from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, unlink, writeFile, access } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import type { Entity, EntityKind } from '../../../shared/entity.js';
import { WORKSPACE_SOURCE, parseUrn } from '../../../shared/entity.js';
import type { EntityListQuery, EntityRepository } from '../../application/ports/entity-repository.js';
import { renderEntityFile, parseEntityFile } from '../../application/entity/entity-serializer.js';
import { DomainError } from '../../domain/errors.js';

type WorkspacePathProvider = string | (() => string) | (() => Promise<string>);

const KINDS: EntityKind[] = ['skill', 'agent', 'instruction'];
const FOLDER: Record<'skill' | 'agent' | 'instruction', string> = {
  skill: 'skills',
  agent: 'agents',
  instruction: 'instructions',
};

function isEnoent(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'ENOENT';
}

export class FsEntityRepository implements EntityRepository {
  constructor(private readonly workspace: WorkspacePathProvider) {}

  private async root(): Promise<string> {
    return typeof this.workspace === 'string' ? this.workspace : this.workspace();
  }

  private async fileFor(kind: EntityKind, name: string): Promise<string> {
    const root = await this.root();
    if (kind === 'skill') return join(root, FOLDER.skill, name, 'SKILL.md');
    if (kind === 'agent') return join(root, FOLDER.agent, `${name}.md`);
    if (kind === 'instruction') return join(root, FOLDER.instruction, `${name}.md`);
    throw new DomainError('validation', `Unsupported entity kind for storage: ${kind}`);
  }

  private async legacyInstructionFile(name: string): Promise<string> {
    return join(await this.root(), 'global-instructions', `${name}.md`);
  }

  async list(query?: EntityListQuery): Promise<Entity[]> {
    const kinds = query?.kind ? [query.kind] : KINDS;
    const out: Entity[] = [];
    for (const kind of kinds) {
      if (kind !== 'skill' && kind !== 'agent' && kind !== 'instruction') continue;
      out.push(...(await this.listByKind(kind)));
    }
    return out;
  }

  private async listByKind(kind: 'skill' | 'agent' | 'instruction'): Promise<Entity[]> {
    const dir = join(await this.root(), FOLDER[kind]);
    let entries: import('node:fs').Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (err) {
      if (isEnoent(err)) return [];
      throw err;
    }
    const out: Entity[] = [];
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      let name: string | undefined;
      if (kind === 'skill') {
        if (entry.isDirectory()) name = entry.name;
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        name = entry.name.slice(0, -'.md'.length);
      }
      if (name === undefined) continue;
      const raw = await readFile(await this.fileFor(kind, name), 'utf8');
      out.push(parseEntityFile({ kind, name, raw, source: WORKSPACE_SOURCE }));
    }
    return out;
  }

  async get(urn: string): Promise<Entity> {
    const { kind, name } = parseUrn(urn);
    const path = await this.fileFor(kind, name);
    try {
      const raw = await readFile(path, 'utf8');
      return parseEntityFile({ kind, name, raw, source: WORKSPACE_SOURCE });
    } catch (err) {
      if (isEnoent(err) && kind === 'instruction') {
        try {
          const raw = await readFile(await this.legacyInstructionFile(name), 'utf8');
          return parseEntityFile({ kind, name, raw, source: WORKSPACE_SOURCE });
        } catch (legacyErr) {
          if (isEnoent(legacyErr)) throw new DomainError('not_found', `Entity not found: ${urn}`);
          throw legacyErr;
        }
      }
      if (isEnoent(err)) throw new DomainError('not_found', `Entity not found: ${urn}`);
      throw err;
    }
  }

  async save(entity: Entity): Promise<Entity> {
    const path = await this.fileFor(entity.kind, entity.name);
    const dir = dirname(path);
    await mkdir(dir, { recursive: true });
    const content = renderEntityFile(entity);
    const tmp = join(dir, `.${basename(path)}.${randomBytes(8).toString('hex')}.tmp`);
    await writeFile(tmp, content, 'utf8');
    try {
      await rename(tmp, path);
    } catch (err) {
      await unlink(tmp).catch(() => undefined);
      throw err;
    }
    return entity;
  }

  async delete(urn: string): Promise<void> {
    const { kind, name } = parseUrn(urn);
    const root = await this.root();
    try {
      if (kind === 'skill') {
        await rm(join(root, FOLDER.skill, name), { recursive: true, force: true });
      } else {
        await unlink(await this.fileFor(kind, name));
      }
    } catch (err) {
      if (isEnoent(err)) throw new DomainError('not_found', `Entity not found: ${urn}`);
      throw err;
    }
  }

  async exists(urn: string): Promise<boolean> {
    const { kind, name } = parseUrn(urn);
    try {
      await access(await this.fileFor(kind, name));
      return true;
    } catch {
      if (kind === 'instruction') {
        try {
          await access(await this.legacyInstructionFile(name));
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/main/infrastructure/entity/fs-entity-repository.test.ts`
Expected: PASS (skill write/read, instruction frontmatter-free, legacy fallback, list/delete/not_found).

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck`

```bash
git add src/main/infrastructure/entity/fs-entity-repository.ts tests/main/infrastructure/entity/fs-entity-repository.test.ts
git commit -m "feat(entity): add FsEntityRepository with instruction frontmatter-free store"
```

---
## Group B — Sync core learns `Entity` (additive; old symlink path untouched)

### Task 6: `resolveEntityDestinations` + `AdapterManager.syncEntity`/`removeEntity`

Add Entity-based sync **alongside** the existing customization-based methods. Nothing is removed here.

**Files:**
- Modify: `src/main/application/ports/adapter.ts`
- Modify: `src/main/infrastructure/adapters/claude-adapter.ts`
- Modify: `src/main/application/services/adapter-manager.ts`
- Test: `tests/main/infrastructure/adapters/__tests__/claude-adapter.entity-destinations.test.ts`
- Test: `tests/main/application/services/__tests__/adapter-manager.sync-entity.test.ts`

**Interfaces:**
- Consumes: `Entity` from `../../../shared/entity.js`; existing `AdapterDestination`, `LinkedRepo`, `SyncResult`.
- Produces: `Adapter.resolveEntityDestinations(args: { entity: Entity; linkedRepos: LinkedRepo[] })`; `AdapterManager.syncEntity({ entity })`, `AdapterManager.removeEntity({ entity })`; private `entitySourcePath`.

**Instruction destinations:** both `~/.claude/CLAUDE.md` and `~/AGENTS.md` (personal scope). Skill/agent mirror the current subfolders. `mcp`/`hook`/unknown → `[]`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/main/infrastructure/adapters/__tests__/claude-adapter.entity-destinations.test.ts
import { describe, it, expect } from 'vitest';
import { ClaudeAdapter } from '../../../../../src/main/infrastructure/adapters/claude-adapter.js';
import { WORKSPACE_SOURCE, type Skill, type Instruction } from '../../../../../src/shared/entity.js';

const meta = { version: '0.1.0', createdAt: '', updatedAt: '' };
const adapter = new ClaudeAdapter({ homedir: '/home/u' });

describe('ClaudeAdapter.resolveEntityDestinations', () => {
  it('routes a personal skill to ~/.claude/skills/<name>', () => {
    const skill: Skill = { urn: 'urn:skill:demo', kind: 'skill', name: 'demo', description: 'd',
      scopes: ['personal'], metadata: meta, source: WORKSPACE_SOURCE, content: 'b' };
    expect(adapter.resolveEntityDestinations({ entity: skill, linkedRepos: [] })).toEqual([
      { scope: 'personal', destination: '/home/u/.claude/skills/demo' },
    ]);
  });

  it('routes an instruction to BOTH CLAUDE.md and AGENTS.md', () => {
    const ins: Instruction = { urn: 'urn:instruction:default', kind: 'instruction', name: 'default',
      description: '', scopes: ['personal'], metadata: meta, source: WORKSPACE_SOURCE, content: 'b', activation: 'always' };
    expect(adapter.resolveEntityDestinations({ entity: ins, linkedRepos: [] })).toEqual([
      { scope: 'personal', destination: '/home/u/.claude/CLAUDE.md' },
      { scope: 'personal', destination: '/home/u/AGENTS.md' },
    ]);
  });
});
```

```ts
// tests/main/application/services/__tests__/adapter-manager.sync-entity.test.ts
import { describe, it, expect } from 'vitest';
import { setupAdapterManager } from './adapter-manager.helpers.js';
import { ClaudeAdapter } from '../../../../../src/main/infrastructure/adapters/claude-adapter.js';
import { WORKSPACE_SOURCE, type Skill } from '../../../../../src/shared/entity.js';

describe('AdapterManager.syncEntity', () => {
  it('creates a symlink for a personal skill', async () => {
    const { manager, fs } = await setupAdapterManager([new ClaudeAdapter({ homedir: '/home/u' })]);
    const skill: Skill = { urn: 'urn:skill:demo', kind: 'skill', name: 'demo', description: 'd',
      scopes: ['personal'], metadata: { version: '0.1.0', createdAt: '', updatedAt: '' },
      source: WORKSPACE_SOURCE, content: 'b' };
    const report = await manager.syncEntity({ entity: skill });
    expect(report.every((r) => r.status === 'ok')).toBe(true);
    const link = await fs.lstat('/home/u/.claude/skills/demo');
    expect(link.kind).toBe('symlink');
    expect(link.target).toBe('/workspace/skills/demo');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/main/infrastructure/adapters/__tests__/claude-adapter.entity-destinations.test.ts tests/main/application/services/__tests__/adapter-manager.sync-entity.test.ts`
Expected: FAIL — `resolveEntityDestinations`/`syncEntity` do not exist.

- [ ] **Step 3: Extend the `Adapter` port**

In `src/main/application/ports/adapter.ts`, add the import and method (keep `resolveDestinations`):

```ts
import type { Entity } from '../../../shared/entity.js';
```

```ts
  resolveEntityDestinations(args: {
    entity: Entity;
    linkedRepos: LinkedRepo[];
  }): Promise<AdapterDestination[]> | AdapterDestination[];
```

- [ ] **Step 4: Implement it on `ClaudeAdapter`**

In `src/main/infrastructure/adapters/claude-adapter.ts`, add `import type { Entity } from '../../../shared/entity.js';` and this method (leave `resolveDestinations` intact):

```ts
  resolveEntityDestinations(args: {
    entity: Entity;
    linkedRepos: LinkedRepo[];
  }): AdapterDestination[] {
    const { kind, name, scopes } = args.entity;

    if (kind === 'instruction') {
      return [
        { scope: 'personal', destination: join(this.homedir, '.claude/CLAUDE.md') },
        { scope: 'personal', destination: join(this.homedir, 'AGENTS.md') },
      ];
    }

    if (kind !== 'skill' && kind !== 'agent') {
      return [];
    }

    const subfolder = kind === 'skill' ? '.claude/skills' : '.claude/agents';
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
```

- [ ] **Step 5: Add `syncEntity`/`removeEntity`/`entitySourcePath` to `AdapterManager`**

In `src/main/application/services/adapter-manager.ts`, add `import type { Entity } from '../../../shared/entity.js';`, the command types, and the methods (mirrors `syncOne`/`removeOne`, reusing the existing private `syncDestination`/`removeDestination`/`enabledAdapters`):

```ts
export interface SyncEntityCommand {
  entity: Entity;
}

export interface RemoveEntityCommand {
  entity: Entity;
}
```

```ts
  async syncEntity(command: SyncEntityCommand): Promise<SyncResult[]> {
    const settings = (await this.deps.settingsService.load()) ?? this.deps.settingsService.getDefaults();
    const enabledAdapters = this.enabledAdapters(settings);
    const results: SyncResult[] = [];

    const source = this.entitySourcePath(command.entity, this.deps.workspacePath);
    const includesProject = command.entity.scopes.includes('project');
    for (const adapter of enabledAdapters) {
      const destinations = await adapter.resolveEntityDestinations({
        entity: command.entity,
        linkedRepos: settings.linkedRepos,
      });
      for (const destination of destinations) {
        results.push(await this.syncDestination(adapter.adapterId, source, destination.destination));
      }
      if (includesProject && settings.linkedRepos.length === 0) {
        results.push({
          adapter: adapter.adapterId,
          destination: null,
          status: 'ok',
          details: { skipped: 'no-linked-repos' },
        });
      }
    }
    return results;
  }

  async removeEntity(command: RemoveEntityCommand): Promise<SyncResult[]> {
    const settings = (await this.deps.settingsService.load()) ?? this.deps.settingsService.getDefaults();
    const results: SyncResult[] = [];
    for (const adapter of this.deps.adapters.values()) {
      const destinations = await adapter.resolveEntityDestinations({
        entity: command.entity,
        linkedRepos: settings.linkedRepos,
      });
      for (const destination of destinations) {
        results.push(await this.removeDestination(adapter.adapterId, destination.destination));
      }
    }
    return results;
  }

  private entitySourcePath(entity: Entity, workspacePath: string): string {
    if (entity.kind === 'skill') return join(workspacePath, 'skills', entity.name);
    if (entity.kind === 'agent') return join(workspacePath, 'agents', `${entity.name}.md`);
    if (entity.kind === 'instruction') return join(workspacePath, 'instructions', `${entity.name}.md`);
    throw new DomainError('validation', `Unsupported entity kind for sync: ${entity.kind}`);
  }
```

> Note: the two other `Adapter` implementers in the codebase (if any test defines a stub adapter) will need a `resolveEntityDestinations` method to satisfy the port. Run typecheck (Step 7) and add a trivial `resolveEntityDestinations: () => []` to any failing stub.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/main/infrastructure/adapters/__tests__/claude-adapter.entity-destinations.test.ts tests/main/application/services/__tests__/adapter-manager.sync-entity.test.ts`
Expected: PASS.

- [ ] **Step 7: Full node suite + typecheck (nothing old broke)**

Run: `npm run typecheck && npx vitest run --project node`
Expected: PASS (old customization sync tests unchanged; new entity methods added).

- [ ] **Step 8: Commit**

```bash
git add src/main/application/ports/adapter.ts src/main/infrastructure/adapters/claude-adapter.ts src/main/application/services/adapter-manager.ts tests/main/infrastructure/adapters/__tests__/claude-adapter.entity-destinations.test.ts tests/main/application/services/__tests__/adapter-manager.sync-entity.test.ts
git commit -m "feat(sync): add Entity-based resolveEntityDestinations and syncEntity"
```

---

## Group C — Main-process services cut over to canonical (one kind at a time)

### Task 7: Generic `EntityService` + `EntityValidator`

**Files:**
- Create: `src/main/application/schemas/entity-schema.ts`
- Create: `src/main/application/services/entity-validator.ts`
- Create: `src/main/application/services/entity-service.ts`
- Test: `tests/main/application/services/entity-service.test.ts`
- Test: `tests/main/application/services/entity-validator.test.ts`

**Interfaces:**
- Consumes: `EntityRepository` (Task 4), `AdapterManager.syncEntity`/`removeEntity` (Task 6), `ClockPort` (`now(): Date`), `Entity`/`entityUrn`, `SyncResult`, `validationError` from `../../domain/errors.js`, `z` from `zod`.
- Produces: `EntityValidator` (`validate(entity: Entity): void`, throws `DomainError('validation')`); `EntityService` (`list(kind)`, `get(urn)`, `save({ entity, isCreate? })`, `delete({ urn, removeSymlinks })`); `SaveEntityResult`, `DeleteEntityResult`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/main/application/services/entity-validator.test.ts
import { describe, it, expect } from 'vitest';
import { EntityValidator } from '../../../../src/main/application/services/entity-validator.js';
import { WORKSPACE_SOURCE, type Skill, type Instruction } from '../../../../src/shared/entity.js';

const v = new EntityValidator();
const meta = { version: '0.1.0', createdAt: '', updatedAt: '' };

describe('EntityValidator', () => {
  it('accepts a valid skill', () => {
    const skill: Skill = { urn: 'urn:skill:demo', kind: 'skill', name: 'demo', description: 'd',
      scopes: ['personal'], metadata: meta, source: WORKSPACE_SOURCE, content: 'b' };
    expect(() => v.validate(skill)).not.toThrow();
  });

  it('rejects a bad slug', () => {
    const skill: Skill = { urn: 'urn:skill:Bad', kind: 'skill', name: 'Bad Name', description: 'd',
      scopes: ['personal'], metadata: meta, source: WORKSPACE_SOURCE, content: 'b' };
    expect(() => v.validate(skill)).toThrow();
  });

  it('enforces the instruction singleton (name=default, scopes=[personal])', () => {
    const bad: Instruction = { urn: 'urn:instruction:other', kind: 'instruction', name: 'other',
      description: '', scopes: ['personal'], metadata: meta, source: WORKSPACE_SOURCE, content: 'b', activation: 'always' };
    expect(() => v.validate(bad)).toThrow();
  });
});
```

```ts
// tests/main/application/services/entity-service.test.ts
import { describe, it, expect, vi } from 'vitest';
import { EntityService } from '../../../../src/main/application/services/entity-service.js';
import { InMemoryEntityRepository } from '../../../../src/main/infrastructure/entity/in-memory-entity-repository.js';
import { FixedClock } from '../../../../src/main/infrastructure/clock/fixed-clock.js';
import type { AdapterManager } from '../../../../src/main/application/services/adapter-manager.js';
import { WORKSPACE_SOURCE, type Skill } from '../../../../src/shared/entity.js';

const FROZEN = new Date('2026-04-26T10:00:00.000Z');
const skill = (name = 'demo'): Skill => ({
  urn: `urn:skill:${name}`, kind: 'skill', name, description: 'd', scopes: ['personal'],
  metadata: { version: '0.1.0', createdAt: '', updatedAt: '' }, source: WORKSPACE_SOURCE, content: 'b',
});

const setup = () => {
  const repo = new InMemoryEntityRepository();
  const clock = new FixedClock(FROZEN);
  const adapterManager = {
    syncEntity: vi.fn().mockResolvedValue([]),
    removeEntity: vi.fn().mockResolvedValue([]),
  } as unknown as AdapterManager;
  const service = new EntityService(repo, clock, adapterManager);
  return { repo, clock, service, adapterManager };
};

describe('EntityService.save', () => {
  it('stamps createdAt/updatedAt and syncs', async () => {
    const { service, adapterManager } = setup();
    const result = await service.save({ entity: skill(), isCreate: true });
    expect(result.entity.metadata.createdAt).toBe(FROZEN.toISOString());
    expect(result.entity.metadata.updatedAt).toBe(FROZEN.toISOString());
    expect(adapterManager.syncEntity).toHaveBeenCalledWith({ entity: result.entity });
  });

  it('preserves createdAt on update', async () => {
    const { service, clock } = setup();
    await service.save({ entity: skill(), isCreate: true });
    const later = new Date('2026-05-01T00:00:00.000Z');
    clock.set(later);
    const result = await service.save({ entity: skill() });
    expect(result.entity.metadata.createdAt).toBe(FROZEN.toISOString());
    expect(result.entity.metadata.updatedAt).toBe(later.toISOString());
  });

  it('rejects create when the urn already exists', async () => {
    const { service } = setup();
    await service.save({ entity: skill(), isCreate: true });
    await expect(service.save({ entity: skill(), isCreate: true })).rejects.toMatchObject({ kind: 'validation' });
  });

  it('on rename removes the old entity symlinks then deletes it', async () => {
    const { service, repo, adapterManager } = setup();
    const created = (await service.save({ entity: skill('old'), isCreate: true })).entity as Skill;
    const renamed: Skill = { ...created, name: 'new' };
    await service.save({ entity: renamed });
    expect(adapterManager.removeEntity).toHaveBeenCalled();
    await expect(repo.get('urn:skill:old')).rejects.toMatchObject({ kind: 'not_found' });
    expect((await repo.get('urn:skill:new')).name).toBe('new');
  });
});

describe('EntityService.delete', () => {
  it('removes symlinks when asked', async () => {
    const { service, adapterManager } = setup();
    await service.save({ entity: skill(), isCreate: true });
    const result = await service.delete({ urn: 'urn:skill:demo', removeSymlinks: true });
    expect(result.ok).toBe(true);
    expect(adapterManager.removeEntity).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/main/application/services/entity-service.test.ts tests/main/application/services/entity-validator.test.ts`
Expected: FAIL — modules do not exist.

- [ ] **Step 3: Create `entity-schema.ts`**

```ts
// src/main/application/schemas/entity-schema.ts
import { z } from 'zod';

const slug = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'name must match ^[a-z0-9][a-z0-9-]*$');
const version = z.string().regex(/^\d+\.\d+\.\d+(-[\w.-]+)?$/, 'version must follow semver');
const scopes = z
  .array(z.enum(['personal', 'project']))
  .min(1, 'scopes must have at least 1 entry')
  .refine((arr) => new Set(arr).size === arr.length, { message: 'scopes must not contain duplicates' });
const metadata = z.object({
  version,
  tags: z.array(z.string().regex(/^[a-z0-9-]+$/)).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
const source = z.object({ kind: z.enum(['workspace', 'plugin']) }).passthrough();

const entityBase = z.object({
  urn: z.string().min(1),
  name: slug,
  description: z.string().max(1024),
  scopes,
  metadata,
  source,
});

export const skillEntitySchema = entityBase
  .extend({ kind: z.literal('skill'), description: z.string().min(1).max(1024), content: z.string(), explicitOnly: z.boolean().optional() })
  .passthrough();

export const agentEntitySchema = entityBase
  .extend({ kind: z.literal('agent'), description: z.string().min(1).max(1024), systemPrompt: z.string() })
  .passthrough();

export const instructionEntitySchema = entityBase
  .extend({
    kind: z.literal('instruction'),
    name: z.literal('default', { message: 'instruction name must be "default"' }),
    scopes: z.tuple([z.literal('personal')], { message: 'instruction scopes must be exactly ["personal"]' }),
    content: z.string(),
    activation: z.enum(['always', 'glob', 'agent-requested', 'manual']),
    globs: z.array(z.string()).optional(),
  })
  .passthrough();
```

- [ ] **Step 4: Create `entity-validator.ts`**

```ts
// src/main/application/services/entity-validator.ts
import type { Entity } from '../../../shared/entity.js';
import { DomainError } from '../../domain/errors.js';
import {
  skillEntitySchema,
  agentEntitySchema,
  instructionEntitySchema,
} from '../schemas/entity-schema.js';

export class EntityValidator {
  validate(entity: Entity): void {
    const schema =
      entity.kind === 'skill'
        ? skillEntitySchema
        : entity.kind === 'agent'
          ? agentEntitySchema
          : entity.kind === 'instruction'
            ? instructionEntitySchema
            : null;
    if (schema === null) {
      throw new DomainError('validation', `Unsupported entity kind: ${entity.kind}`);
    }
    const result = schema.safeParse(entity);
    if (!result.success) {
      // key is `errors` (not `issues`) to match the renderer editor's validation toast,
      // which reads `err.details.errors as Array<{ path; message }>`.
      throw new DomainError('validation', 'Entity failed validation', {
        errors: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
  }
}
```

- [ ] **Step 5: Create `entity-service.ts`**

```ts
// src/main/application/services/entity-service.ts
import type { Entity, EntityKind } from '../../../shared/entity.js';
import { entityUrn } from '../../../shared/entity.js';
import type { SyncResult } from '../../../shared/sync-result.js';
import type { EntityRepository } from '../ports/entity-repository.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { AdapterManager } from './adapter-manager.js';
import type { EntityValidator } from './entity-validator.js';
import { validationError } from '../../domain/errors.js';

export interface SaveEntityCommand {
  entity: Entity;
  isCreate?: boolean;
}
export interface SaveEntityResult {
  entity: Entity;
  syncReport: SyncResult[];
}
export interface DeleteEntityCommand {
  urn: string;
  removeSymlinks: boolean;
}
export interface DeleteEntityResult {
  ok: true;
  syncReport?: SyncResult[];
}

export class EntityService {
  constructor(
    private readonly repository: EntityRepository,
    private readonly clock: ClockPort,
    private readonly adapterManager: AdapterManager,
    private readonly validator?: EntityValidator,
  ) {}

  list(kind: EntityKind): Promise<Entity[]> {
    return this.repository.list({ kind });
  }

  get(urn: string): Promise<Entity> {
    return this.repository.get(urn);
  }

  async save(command: SaveEntityCommand): Promise<SaveEntityResult> {
    const { entity, isCreate = false } = command;
    this.validator?.validate(entity);

    const urn = entityUrn(entity.kind, entity.name);
    const previousUrn = entity.urn;
    const isRename = !isCreate && previousUrn !== '' && previousUrn !== urn;
    const exists = await this.repository.exists(urn);

    if ((isCreate || isRename) && exists) {
      throw validationError({ message: `Entity already exists: ${urn}`, details: { conflict: urn } });
    }

    const nowIso = this.clock.now().toISOString();
    let createdAt = nowIso;
    let previous: Entity | undefined;
    if (isRename) {
      previous = await this.repository.get(previousUrn);
      createdAt = previous.metadata.createdAt || nowIso;
    } else if (exists) {
      const current = await this.repository.get(urn);
      createdAt = current.metadata.createdAt || nowIso;
    }

    const persisted: Entity = {
      ...entity,
      urn,
      metadata: { ...entity.metadata, createdAt, updatedAt: nowIso },
    };
    const saved = await this.repository.save(persisted);

    const removeReport: SyncResult[] = [];
    if (isRename && previous) {
      removeReport.push(...(await this.adapterManager.removeEntity({ entity: previous })));
      await this.repository.delete(previousUrn);
    }

    const syncReport = await this.adapterManager.syncEntity({ entity: saved });
    return { entity: saved, syncReport: [...removeReport, ...syncReport] };
  }

  async delete(command: DeleteEntityCommand): Promise<DeleteEntityResult> {
    let syncReport: SyncResult[] | undefined;
    if (command.removeSymlinks) {
      const entity = await this.repository.get(command.urn);
      syncReport = await this.adapterManager.removeEntity({ entity });
    }
    await this.repository.delete(command.urn);
    return syncReport === undefined ? { ok: true } : { ok: true, syncReport };
  }
}
```

> `validationError` is the existing factory in `src/main/domain/errors.js`; confirm its call shape (`validationError({ message, details })`) matches usage in `customization-service.ts` and mirror it.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/main/application/services/entity-service.test.ts tests/main/application/services/entity-validator.test.ts`
Expected: PASS.

- [ ] **Step 7: Typecheck + commit**

Run: `npm run typecheck`

```bash
git add src/main/application/schemas/entity-schema.ts src/main/application/services/entity-validator.ts src/main/application/services/entity-service.ts tests/main/application/services/entity-service.test.ts tests/main/application/services/entity-validator.test.ts
git commit -m "feat(entity): add generic EntityService and canonical EntityValidator"
```

---

### Task 8: Canonical plugin-entity collection helper

Reimplement the plugin merge/guard against canonical entities (the old `customization-plugin-helpers.ts` is deleted in Group F).

**Files:**
- Create: `src/main/application/services/entity-plugin-helpers.ts`
- Test: `tests/main/application/services/entity-plugin-helpers.test.ts`

**Interfaces:**
- Consumes: `parseEntityFile` (Task 3); `FileSystemPort`; `Scope`; `PluginProvenanceService` and `provenanceKey` (import lines to be copied verbatim from the existing `customization-plugin-helpers.ts`); `OperationNotAllowedForOriginError`; `Entity`/`EntitySource` from shared.
- Produces: `EntityPluginDeps = { provenance: PluginProvenanceService; fs: FileSystemPort }`; `collectPluginEntities(deps, { kind, relPath }, scope): Promise<Entity[]>`; `assertEntityNotPluginSourced(deps, { kind, operation, name, scope }): Promise<void>`.

- [ ] **Step 1: Open `src/main/application/services/customization-plugin-helpers.ts`** and copy its exact `import` lines for `PluginProvenanceService`, `provenanceKey`, `PluginEntityRef` (or the ref type it iterates), `FileSystemPort`, `Scope`, and `OperationNotAllowedForOriginError`. You will paste these into the new file so the module paths are correct.

- [ ] **Step 2: Write the failing test**

```ts
// tests/main/application/services/entity-plugin-helpers.test.ts
import { describe, it, expect } from 'vitest';
import { InMemoryFileSystem } from '../../../../src/main/infrastructure/filesystem/in-memory-filesystem.js';
import {
  collectPluginEntities,
  assertEntityNotPluginSourced,
  type EntityPluginDeps,
} from '../../../../src/main/application/services/entity-plugin-helpers.js';
import type { PluginProvenanceService } from '../../../../src/main/application/services/plugin-provenance.js';
import type { Skill } from '../../../../src/shared/entity.js';

const SKILL_MD = ['---', 'name: demo', 'type: skill', 'description: from plugin',
  'scopes:', '  - personal', 'version: 1.0.0', '---', '# Demo', ''].join('\n');

const makeDeps = (): EntityPluginDeps => {
  const fs = new InMemoryFileSystem();
  fs.createFile('/plugins/p1/skills/demo/SKILL.md', SKILL_MD);
  const provenance = {
    scan: async () => [{ type: 'skill', name: 'demo', dir: '/plugins/p1', pluginId: 'p1', provenance: 'workspace-managed' }],
    forScope: async () => new Map([['skill/demo', 'p1']]),
  } as unknown as PluginProvenanceService;
  return { provenance, fs };
};

describe('collectPluginEntities', () => {
  it('parses a plugin SKILL.md into a canonical skill with plugin source', async () => {
    const deps = makeDeps();
    const skills = (await collectPluginEntities(deps, { kind: 'skill', relPath: (n) => `skills/${n}/SKILL.md` }, 'personal')) as Skill[];
    expect(skills).toHaveLength(1);
    expect(skills[0]?.urn).toBe('urn:skill:demo');
    expect(skills[0]?.source).toEqual({ kind: 'plugin', pluginId: 'p1', provenance: 'workspace-managed' });
  });
});

describe('assertEntityNotPluginSourced', () => {
  it('throws when the name is owned by a plugin', async () => {
    const deps = makeDeps();
    await expect(
      assertEntityNotPluginSourced(deps, { kind: 'skill', operation: 'save', name: 'demo', scope: 'personal' }),
    ).rejects.toMatchObject({ kind: 'validation' });
  });

  it('is a no-op when deps are absent', async () => {
    await expect(
      assertEntityNotPluginSourced(undefined, { kind: 'skill', operation: 'save', name: 'x', scope: 'personal' }),
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/main/application/services/entity-plugin-helpers.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 4: Create `entity-plugin-helpers.ts`** (use the imports copied in Step 1)

```ts
// src/main/application/services/entity-plugin-helpers.ts
import { join } from 'node:path';
// --- paste the copied import lines here, e.g.: ---
import type { FileSystemPort } from '../ports/filesystem-port.js';
import type { Scope } from '../ports/scope.js';
import type { PluginProvenanceService } from './plugin-provenance.js';
import { provenanceKey } from './plugin-provenance.js'; // adjust path if it lives elsewhere
import { OperationNotAllowedForOriginError } from '../../domain/plugin-errors.js';
// -------------------------------------------------
import type { Entity, EntitySource } from '../../../shared/entity.js';
import { parseEntityFile } from '../entity/entity-serializer.js';

export interface EntityPluginDeps {
  provenance: PluginProvenanceService;
  fs: FileSystemPort;
}

export async function collectPluginEntities(
  deps: EntityPluginDeps,
  spec: { kind: 'skill' | 'agent'; relPath: (name: string) => string },
  scope: Scope,
): Promise<Entity[]> {
  const refs = await deps.provenance.scan(scope);
  const out: Entity[] = [];
  for (const ref of refs) {
    if (ref.type !== spec.kind) continue;
    const file = join(ref.dir, spec.relPath(ref.name));
    try {
      const raw = await deps.fs.readFile(file);
      const source: EntitySource = { kind: 'plugin', pluginId: ref.pluginId, provenance: ref.provenance };
      out.push(parseEntityFile({ kind: spec.kind, name: ref.name, raw, source }));
    } catch {
      // one bad file is skipped silently, mirroring the previous helper
    }
  }
  return out;
}

export async function assertEntityNotPluginSourced(
  deps: EntityPluginDeps | undefined,
  args: { kind: 'skill' | 'agent'; operation: 'save' | 'delete'; name: string; scope: Scope },
): Promise<void> {
  if (!deps) return;
  const map = await deps.provenance.forScope(args.scope);
  const pid = map.get(provenanceKey({ type: args.kind, name: args.name }));
  if (pid != null) {
    throw new OperationNotAllowedForOriginError(
      `Cannot ${args.operation} ${args.kind} '${args.name}' provided by plugin '${pid}'`,
      { origin: 'plugin', operation: args.operation },
    );
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/main/application/services/entity-plugin-helpers.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck + commit**

Run: `npm run typecheck`

```bash
git add src/main/application/services/entity-plugin-helpers.ts tests/main/application/services/entity-plugin-helpers.test.ts
git commit -m "feat(entity): add canonical plugin-entity collection helper"
```

---

### Task 9: `SkillService` → canonical

Replace the skill facade to return canonical `Skill` and go through `EntityService`. Node-side consumers (IPC handler cast, tests, composition root) are updated in the same task so `npm test` stays green.

**Files:**
- Modify (replace): `src/main/application/services/skill-service.ts`
- Modify: `src/main/ipc/skill-handlers.ts` (change the `Skill` import to `../../shared/entity.js`)
- Modify: `src/main/index.ts` (construct `EntityValidator`/`FsEntityRepository`/`EntityService`; change `SkillService` construction)
- Modify: `tests/main/ipc/typed-handlers.test.ts` (skill payloads become canonical)
- Modify: `tests/main/application/services/customization-typed-services.test.ts` (remove the `SkillService` cases)
- Create: `tests/main/application/services/skill-service.test.ts`

**Interfaces:**
- Consumes: `EntityService` (Task 7), `collectPluginEntities`/`assertEntityNotPluginSourced`/`EntityPluginDeps` (Task 8), `Skill`/`entityUrn`/`WORKSPACE_SOURCE` from shared, `skillId`/`SkillId`, `OperationNotAllowedForOriginError`.
- Produces: `SkillService` (`list(scope)`, `get(id)`, `save({ skill, isCreate?, scope? })`, `delete({ id, removeSymlinks, scope? })`), `SaveSkillResult`.

- [ ] **Step 1: Write the failing test** (`tests/main/application/services/skill-service.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import { SkillService } from '../../../../src/main/application/services/skill-service.js';
import { EntityService } from '../../../../src/main/application/services/entity-service.js';
import { InMemoryEntityRepository } from '../../../../src/main/infrastructure/entity/in-memory-entity-repository.js';
import { FixedClock } from '../../../../src/main/infrastructure/clock/fixed-clock.js';
import type { AdapterManager } from '../../../../src/main/application/services/adapter-manager.js';
import { vi } from 'vitest';
import { WORKSPACE_SOURCE, type Skill } from '../../../../src/shared/entity.js';
import { skillId } from '../../../../src/main/domain/skill-id.js';

const skill = (name = 'demo'): Skill => ({
  urn: `urn:skill:${name}`, kind: 'skill', name, description: 'd', scopes: ['personal'],
  metadata: { version: '0.1.0', createdAt: '', updatedAt: '' }, source: WORKSPACE_SOURCE, content: 'b',
});

const setup = () => {
  const repo = new InMemoryEntityRepository();
  const adapterManager = { syncEntity: vi.fn().mockResolvedValue([]), removeEntity: vi.fn().mockResolvedValue([]) } as unknown as AdapterManager;
  const base = new EntityService(repo, new FixedClock(new Date('2026-04-26T10:00:00.000Z')), adapterManager);
  return { repo, service: new SkillService(base) };
};

describe('SkillService', () => {
  it('lists only workspace skills when there are no plugin deps', async () => {
    const { service } = setup();
    await service.save({ skill: skill(), isCreate: true });
    const list = await service.list();
    expect(list.map((s) => s.name)).toEqual(['demo']);
    expect(list[0]?.source).toEqual(WORKSPACE_SOURCE);
  });

  it('rejects saving a plugin-sourced skill', async () => {
    const { service } = setup();
    const pluginSkill: Skill = { ...skill(), source: { kind: 'plugin', pluginId: 'p', provenance: 'workspace-managed' } };
    await expect(service.save({ skill: pluginSkill })).rejects.toMatchObject({ kind: 'validation' });
  });

  it('gets by branded id', async () => {
    const { service } = setup();
    await service.save({ skill: skill(), isCreate: true });
    expect((await service.get(skillId('demo'))).urn).toBe('urn:skill:demo');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/main/application/services/skill-service.test.ts`
Expected: FAIL — new `SkillService` signature / imports don't exist yet.

- [ ] **Step 3: Replace `src/main/application/services/skill-service.ts`**

```ts
// src/main/application/services/skill-service.ts
import type { EntityService } from './entity-service.js';
import type { Skill } from '../../../shared/entity.js';
import { entityUrn, WORKSPACE_SOURCE } from '../../../shared/entity.js';
import type { SyncResult } from '../../../shared/sync-result.js';
import type { Scope } from '../ports/scope.js';
import type { SkillId } from '../../domain/skill-id.js';
import { OperationNotAllowedForOriginError } from '../../domain/plugin-errors.js';
import {
  collectPluginEntities,
  assertEntityNotPluginSourced,
  type EntityPluginDeps,
} from './entity-plugin-helpers.js';

export interface SaveSkillResult {
  skill: Skill;
  syncReport: SyncResult[];
}

export class SkillService {
  constructor(
    private readonly base: EntityService,
    private readonly pluginDeps?: EntityPluginDeps,
  ) {}

  async list(scope: Scope = 'personal'): Promise<Skill[]> {
    const workspace = (await this.base.list('skill')) as Skill[];
    if (!this.pluginDeps) return workspace;
    const plugin = (await collectPluginEntities(
      this.pluginDeps,
      { kind: 'skill', relPath: (name) => `skills/${name}/SKILL.md` },
      scope,
    )) as Skill[];
    const urns = new Set(workspace.map((s) => s.urn));
    return [...workspace, ...plugin.filter((s) => !urns.has(s.urn))];
  }

  async get(id: SkillId): Promise<Skill> {
    return (await this.base.get(entityUrn('skill', id))) as Skill;
  }

  async save(input: { skill: Skill; isCreate?: boolean; scope?: Scope }): Promise<SaveSkillResult> {
    if (input.skill.source.kind === 'plugin') {
      throw new OperationNotAllowedForOriginError(
        `Cannot save a skill provided by plugin '${input.skill.source.pluginId}'`,
        { origin: 'plugin', operation: 'save' },
      );
    }
    await assertEntityNotPluginSourced(this.pluginDeps, {
      kind: 'skill',
      operation: 'save',
      name: input.skill.name,
      scope: input.scope ?? 'personal',
    });
    const result = await this.base.save({
      entity: { ...input.skill, source: WORKSPACE_SOURCE },
      ...(input.isCreate !== undefined ? { isCreate: input.isCreate } : {}),
    });
    return { skill: result.entity as Skill, syncReport: result.syncReport };
  }

  async delete(input: { id: SkillId; removeSymlinks: boolean; scope?: Scope }): Promise<{
    ok: true;
    syncReport?: SyncResult[];
  }> {
    await assertEntityNotPluginSourced(this.pluginDeps, {
      kind: 'skill',
      operation: 'delete',
      name: input.id,
      scope: input.scope ?? 'personal',
    });
    return this.base.delete({ urn: entityUrn('skill', input.id), removeSymlinks: input.removeSymlinks });
  }
}
```

- [ ] **Step 4: Point the IPC handler at the canonical `Skill` type**

In `src/main/ipc/skill-handlers.ts`, change the `Skill` type import from `../application/schemas/skill.js` to `../../shared/entity.js`. The handler body (`asObject(raw['skill'], 'skill') as unknown as Skill`) is unchanged.

- [ ] **Step 5: Wire the canonical stack in `src/main/index.ts`**

Add near the existing `SchemaValidator`/`CustomizationService` construction:

```ts
const entityValidator = new EntityValidator();
const entityRepository = new FsEntityRepository(workspacePath);
const entityService = new EntityService(entityRepository, clock, adapterManager, entityValidator);
```

Change the `SkillService` construction from `new SkillService(customizationService, { provenance: pluginProvenance, fs: nodeFsAdapter })` to:

```ts
const skillService = new SkillService(entityService, { provenance: pluginProvenance, fs: nodeFsAdapter });
```

Add the imports for `EntityValidator`, `FsEntityRepository`, `EntityService` (with `.js` extensions). Leave `CustomizationService`/`AgentService`/`CommandService`/`GlobalInstructionService` wiring in place for now.

- [ ] **Step 6: Update `tests/main/ipc/typed-handlers.test.ts` skill payloads**

For every `skill.save`/`skill.get`/`skill.list` case, build the payload as a **canonical** `Skill` (`{ urn, kind:'skill', name, description, scopes, metadata, source, content }`) instead of `{ id, frontmatter, body, source }`. Construct the handler's `SkillService` from an `EntityService` over an `InMemoryEntityRepository` (mirror the `setup()` in `skill-service.test.ts`). Leave the agent/command/global-instruction cases in this file unchanged.

- [ ] **Step 7: Remove the `SkillService` cases from `customization-typed-services.test.ts`**

Delete every `it`/`describe` in `tests/main/application/services/customization-typed-services.test.ts` that constructs `new SkillService(...)` — skill is now covered by `skill-service.test.ts`. Keep the `AgentService` and `CommandService` cases (they still use the old `CustomizationService` until Tasks 10–11 / Group F).

- [ ] **Step 8: Run node suite + typecheck**

Run: `npm run typecheck && npx vitest run --project node`
Expected: PASS. (jsdom untouched — it mocks IPC and does not import `SkillService`.)

- [ ] **Step 9: Commit**

```bash
git add src/main/application/services/skill-service.ts src/main/ipc/skill-handlers.ts src/main/index.ts tests/main/application/services/skill-service.test.ts tests/main/ipc/typed-handlers.test.ts tests/main/application/services/customization-typed-services.test.ts
git commit -m "refactor(skill): move SkillService to the canonical Entity pipeline"
```

---

### Task 10: `AgentService` → canonical

Same shape as Task 9, for agents.

**Files:**
- Modify (replace): `src/main/application/services/agent-service.ts`
- Modify: `src/main/ipc/agent-handlers.ts` (import `Agent` from `../../shared/entity.js`)
- Modify: `src/main/index.ts` (change `AgentService` construction to use `entityService`)
- Modify: `tests/main/ipc/typed-handlers.test.ts` (agent payloads canonical)
- Modify: `tests/main/application/services/customization-typed-services.test.ts` (remove `AgentService` cases)
- Create: `tests/main/application/services/agent-service.test.ts`

**Interfaces:**
- Produces: `AgentService` (`list(scope)`, `get(id)`, `save({ agent, isCreate?, scope? })`, `delete({ id, removeSymlinks, scope? })`), `SaveAgentResult` (`{ agent: Agent; syncReport: SyncResult[] }`).

- [ ] **Step 1: Write the failing test** (`tests/main/application/services/agent-service.test.ts`)

```ts
import { describe, it, expect, vi } from 'vitest';
import { AgentService } from '../../../../src/main/application/services/agent-service.js';
import { EntityService } from '../../../../src/main/application/services/entity-service.js';
import { InMemoryEntityRepository } from '../../../../src/main/infrastructure/entity/in-memory-entity-repository.js';
import { FixedClock } from '../../../../src/main/infrastructure/clock/fixed-clock.js';
import type { AdapterManager } from '../../../../src/main/application/services/adapter-manager.js';
import { WORKSPACE_SOURCE, type Agent } from '../../../../src/shared/entity.js';
import { agentId } from '../../../../src/main/domain/agent-id.js';

const agent = (name = 'rev'): Agent => ({
  urn: `urn:agent:${name}`, kind: 'agent', name, description: 'reviewer', scopes: ['personal'],
  metadata: { version: '0.1.0', createdAt: '', updatedAt: '' }, source: WORKSPACE_SOURCE, systemPrompt: 'You review.',
});

const setup = () => {
  const repo = new InMemoryEntityRepository();
  const adapterManager = { syncEntity: vi.fn().mockResolvedValue([]), removeEntity: vi.fn().mockResolvedValue([]) } as unknown as AdapterManager;
  const base = new EntityService(repo, new FixedClock(new Date('2026-04-26T10:00:00.000Z')), adapterManager);
  return { service: new AgentService(base) };
};

describe('AgentService', () => {
  it('saves and gets a canonical agent', async () => {
    const { service } = setup();
    await service.save({ agent: agent(), isCreate: true });
    const got = await service.get(agentId('rev'));
    expect(got.urn).toBe('urn:agent:rev');
    expect(got.systemPrompt).toBe('You review.');
  });

  it('rejects saving a plugin-sourced agent', async () => {
    const { service } = setup();
    const pluginAgent: Agent = { ...agent(), source: { kind: 'plugin', pluginId: 'p', provenance: 'workspace-managed' } };
    await expect(service.save({ agent: pluginAgent })).rejects.toMatchObject({ kind: 'validation' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/main/application/services/agent-service.test.ts`
Expected: FAIL.

- [ ] **Step 3: Replace `src/main/application/services/agent-service.ts`**

```ts
// src/main/application/services/agent-service.ts
import type { EntityService } from './entity-service.js';
import type { Agent } from '../../../shared/entity.js';
import { entityUrn, WORKSPACE_SOURCE } from '../../../shared/entity.js';
import type { SyncResult } from '../../../shared/sync-result.js';
import type { Scope } from '../ports/scope.js';
import type { AgentId } from '../../domain/agent-id.js';
import { OperationNotAllowedForOriginError } from '../../domain/plugin-errors.js';
import {
  collectPluginEntities,
  assertEntityNotPluginSourced,
  type EntityPluginDeps,
} from './entity-plugin-helpers.js';

export interface SaveAgentResult {
  agent: Agent;
  syncReport: SyncResult[];
}

export class AgentService {
  constructor(
    private readonly base: EntityService,
    private readonly pluginDeps?: EntityPluginDeps,
  ) {}

  async list(scope: Scope = 'personal'): Promise<Agent[]> {
    const workspace = (await this.base.list('agent')) as Agent[];
    if (!this.pluginDeps) return workspace;
    const plugin = (await collectPluginEntities(
      this.pluginDeps,
      { kind: 'agent', relPath: (name) => `agents/${name}.md` },
      scope,
    )) as Agent[];
    const urns = new Set(workspace.map((a) => a.urn));
    return [...workspace, ...plugin.filter((a) => !urns.has(a.urn))];
  }

  async get(id: AgentId): Promise<Agent> {
    return (await this.base.get(entityUrn('agent', id))) as Agent;
  }

  async save(input: { agent: Agent; isCreate?: boolean; scope?: Scope }): Promise<SaveAgentResult> {
    if (input.agent.source.kind === 'plugin') {
      throw new OperationNotAllowedForOriginError(
        `Cannot save an agent provided by plugin '${input.agent.source.pluginId}'`,
        { origin: 'plugin', operation: 'save' },
      );
    }
    await assertEntityNotPluginSourced(this.pluginDeps, {
      kind: 'agent',
      operation: 'save',
      name: input.agent.name,
      scope: input.scope ?? 'personal',
    });
    const result = await this.base.save({
      entity: { ...input.agent, source: WORKSPACE_SOURCE },
      ...(input.isCreate !== undefined ? { isCreate: input.isCreate } : {}),
    });
    return { agent: result.entity as Agent, syncReport: result.syncReport };
  }

  async delete(input: { id: AgentId; removeSymlinks: boolean; scope?: Scope }): Promise<{
    ok: true;
    syncReport?: SyncResult[];
  }> {
    await assertEntityNotPluginSourced(this.pluginDeps, {
      kind: 'agent',
      operation: 'delete',
      name: input.id,
      scope: input.scope ?? 'personal',
    });
    return this.base.delete({ urn: entityUrn('agent', input.id), removeSymlinks: input.removeSymlinks });
  }
}
```

- [ ] **Step 4: Point `agent-handlers.ts` at the shared `Agent` type** (import `Agent` from `../../shared/entity.js`).

- [ ] **Step 5: Change the `AgentService` construction in `index.ts`** to `new AgentService(entityService, { provenance: pluginProvenance, fs: nodeFsAdapter })`.

- [ ] **Step 6: Update `typed-handlers.test.ts` agent payloads to canonical** and **remove the `AgentService` cases from `customization-typed-services.test.ts`** (only the `CommandService` cases remain there now).

- [ ] **Step 7: Run node suite + typecheck**

Run: `npm run typecheck && npx vitest run --project node`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/main/application/services/agent-service.ts src/main/ipc/agent-handlers.ts src/main/index.ts tests/main/application/services/agent-service.test.ts tests/main/ipc/typed-handlers.test.ts tests/main/application/services/customization-typed-services.test.ts
git commit -m "refactor(agent): move AgentService to the canonical Entity pipeline"
```

---

### Task 11: `InstructionService` (replaces `GlobalInstructionService`) + instruction IPC

Introduce the singleton `InstructionService`, rename the IPC namespace to `instruction.*`, update `settings.setLanguage`, and delete the old GI service + handler. (The renderer still calls `global-instruction.*` / reads `.body` until Task 17 — that is fixed in Group E; `npm test` stays green because renderer tests mock IPC.)

**Files:**
- Create: `src/main/application/services/instruction-service.ts`
- Create: `src/main/ipc/instruction-handlers.ts`
- Delete: `src/main/application/services/global-instruction-service.ts`, `src/main/ipc/global-instruction-handlers.ts`
- Modify: `src/main/ipc/registry.ts` (swap `buildGlobalInstructionHandlers` → `buildInstructionHandlers`; update `settings.setLanguage`; update `IpcDeps` field type)
- Modify: `src/main/index.ts` (construct `InstructionService`; pass to `buildHandlers`)
- Create: `tests/main/application/services/instruction-service.test.ts`
- Modify: `tests/main/ipc/typed-handlers.test.ts` (rename GI cases to `instruction.*`, canonical payloads) and `tests/main/ipc/settings-set-language.test.ts`

**Interfaces:**
- Consumes: `EntityService`, `Instruction`/`entityUrn`/`WORKSPACE_SOURCE`, `globalInstructionId` (still the `'default'` validator).
- Produces: `InstructionService` (`get(name?: string)`, `save({ instruction, isCreate? })`), `SaveInstructionResult` (`{ instruction: Instruction; syncReport: SyncResult[] }`); IPC `instruction.get`, `instruction.save`.

- [ ] **Step 1: Write the failing test** (`tests/main/application/services/instruction-service.test.ts`)

```ts
import { describe, it, expect, vi } from 'vitest';
import { InstructionService } from '../../../../src/main/application/services/instruction-service.js';
import { EntityService } from '../../../../src/main/application/services/entity-service.js';
import { InMemoryEntityRepository } from '../../../../src/main/infrastructure/entity/in-memory-entity-repository.js';
import { FixedClock } from '../../../../src/main/infrastructure/clock/fixed-clock.js';
import type { AdapterManager } from '../../../../src/main/application/services/adapter-manager.js';
import { WORKSPACE_SOURCE, type Instruction } from '../../../../src/shared/entity.js';

const instruction = (): Instruction => ({
  urn: 'urn:instruction:default', kind: 'instruction', name: 'default', description: '',
  scopes: ['personal'], metadata: { version: '0.0.0', createdAt: '', updatedAt: '' },
  source: WORKSPACE_SOURCE, content: '# Instructions\n', activation: 'always',
});

const setup = () => {
  const repo = new InMemoryEntityRepository();
  const adapterManager = { syncEntity: vi.fn().mockResolvedValue([]), removeEntity: vi.fn().mockResolvedValue([]) } as unknown as AdapterManager;
  const base = new EntityService(repo, new FixedClock(new Date('2026-04-26T10:00:00.000Z')), adapterManager);
  return { service: new InstructionService(base) };
};

describe('InstructionService', () => {
  it('saves and gets the default instruction', async () => {
    const { service } = setup();
    await service.save({ instruction: instruction(), isCreate: true });
    const got = await service.get();
    expect(got.urn).toBe('urn:instruction:default');
    expect(got.content).toContain('# Instructions');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/main/application/services/instruction-service.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Create `src/main/application/services/instruction-service.ts`**

```ts
// src/main/application/services/instruction-service.ts
import type { EntityService } from './entity-service.js';
import type { Instruction } from '../../../shared/entity.js';
import { entityUrn, WORKSPACE_SOURCE } from '../../../shared/entity.js';
import type { SyncResult } from '../../../shared/sync-result.js';
import { globalInstructionId } from '../../domain/global-instruction-id.js';

export interface SaveInstructionResult {
  instruction: Instruction;
  syncReport: SyncResult[];
}

export class InstructionService {
  constructor(private readonly base: EntityService) {}

  async get(name = 'default'): Promise<Instruction> {
    // globalInstructionId validates that the slug is the allowed singleton 'default'.
    const id = globalInstructionId(name);
    return (await this.base.get(entityUrn('instruction', id))) as Instruction;
  }

  async save(input: { instruction: Instruction; isCreate?: boolean }): Promise<SaveInstructionResult> {
    const result = await this.base.save({
      entity: { ...input.instruction, source: WORKSPACE_SOURCE },
      ...(input.isCreate !== undefined ? { isCreate: input.isCreate } : {}),
    });
    return { instruction: result.entity as Instruction, syncReport: result.syncReport };
  }
}
```

- [ ] **Step 4: Create `src/main/ipc/instruction-handlers.ts`**

```ts
// src/main/ipc/instruction-handlers.ts
import type { IpcHandlers } from './dispatcher.js';
import type { InstructionService } from '../application/services/instruction-service.js';
import type { Instruction } from '../../shared/entity.js';
import { asObject, asString } from './_validators.js';

export function buildInstructionHandlers(service: InstructionService): IpcHandlers {
  return {
    'instruction.get': async (params) => {
      const raw = asObject(params, 'instruction.get');
      return service.get(asString(raw['id'], 'id'));
    },
    'instruction.save': async (params) => {
      const raw = asObject(params, 'instruction.save');
      const instruction = asObject(raw['instruction'], 'instruction') as unknown as Instruction;
      const isCreate = typeof raw['isCreate'] === 'boolean' ? raw['isCreate'] : undefined;
      return service.save({ instruction, ...(isCreate !== undefined ? { isCreate } : {}) });
    },
  };
}
```

- [ ] **Step 5: Update `registry.ts`**

- Replace the import and spread of `buildGlobalInstructionHandlers(globalInstructionService)` with `buildInstructionHandlers(instructionService)`.
- Change the `IpcDeps` field from `globalInstructionService: GlobalInstructionService` to `instructionService: InstructionService` (update the import).
- Update `settings.setLanguage` to use the instruction service and canonical `content`:

```ts
'settings.setLanguage': async (params) => {
  const raw = asObject(params, 'settings.setLanguage');
  const language = asLanguagePreference(raw['language'], 'language');
  const settings = await settingsService.merge({ language });
  const instruction = await instructionService.get('default');
  const newContent = updateLanguageSection(instruction.content, language);
  const { syncReport } = await instructionService.save({
    instruction: { ...instruction, content: newContent },
  });
  return { settings, syncReport };
},
```

- [ ] **Step 6: Update `index.ts`**

Replace the `GlobalInstructionService` construction with `const instructionService = new InstructionService(entityService);`, remove the `globalInstructionService` from the `buildHandlers({...})` call, and add `instructionService`. Delete the now-unused `GlobalInstructionService` import.

- [ ] **Step 7: Delete the old GI files**

```bash
git rm src/main/application/services/global-instruction-service.ts src/main/ipc/global-instruction-handlers.ts
```

- [ ] **Step 8: Update IPC tests**

In `tests/main/ipc/typed-handlers.test.ts`, rename the global-instruction cases to `instruction.get`/`instruction.save`, build a canonical `Instruction` payload, and construct the handler from an `InstructionService` over an in-memory `EntityService`. In `tests/main/ipc/settings-set-language.test.ts`, update the stubbed service to `instructionService` with canonical `content`.

- [ ] **Step 9: Run node suite + typecheck**

Run: `npm run typecheck && npx vitest run --project node`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "refactor(instruction): replace GlobalInstructionService with canonical InstructionService + instruction.* IPC"
```

---

## Group D — Remove the `command` entity

### Task 12: Remove `command` from the main process

Per the locked decision, `command` is dropped with no migration. Existing `commands/*.md` are orphaned (still on disk, no longer listed/synced/shown). The `command` **Zod schema and id** are left until Group F because the still-alive `SchemaValidator`/`CustomizationService` reference them.

**Files:**
- Delete: `src/main/ipc/command-handlers.ts`
- Delete: `src/main/application/services/command-service.ts`
- Delete: `tests/main/application/services/customization-typed-services.test.ts` (only `CommandService` cases remain after Tasks 9–10)
- Modify: `src/main/ipc/registry.ts` (drop the `buildCommandHandlers` import + spread; drop `commandService` from `IpcDeps` and the destructure)
- Modify: `src/main/index.ts` (drop `CommandService` import + construction; drop `commandService` from the `buildHandlers({...})` call)
- Modify: `tests/main/ipc/typed-handlers.test.ts` (delete the `command.*` cases)

- [ ] **Step 1: Delete the command service, handler, and shared typed-service test**

```bash
git rm src/main/ipc/command-handlers.ts src/main/application/services/command-service.ts tests/main/application/services/customization-typed-services.test.ts
```

- [ ] **Step 2: Update `registry.ts`**

- Remove `import { buildCommandHandlers } from './command-handlers.js';` and the `...buildCommandHandlers(commandService),` line from the returned handler map.
- Remove `commandService: CommandService;` from the `IpcDeps` interface and its `CommandService` import, and remove `commandService` from the `buildHandlers` destructure.

- [ ] **Step 3: Update `index.ts`**

- Remove the `CommandService` import and its construction (`const commandService = new CommandService(...)`).
- Remove `commandService,` from the object passed to `buildHandlers({...})`.

- [ ] **Step 4: Trim `typed-handlers.test.ts`**

Delete every `it`/`describe` that exercises `command.list`/`command.get`/`command.save`/`command.delete`. Leave the skill/agent (canonical) and instruction cases.

- [ ] **Step 5: Run node suite + typecheck**

Run: `npm run typecheck && npx vitest run --project node`
Expected: PASS. (`command.*` methods now return `not_found` via the dispatcher, which is fine — the renderer stops calling them in Tasks 13–14.)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(command): remove command IPC + service (folded into skill going forward)"
```

---

## Group E — Renderer cutover

### Task 13: Remove the command view + rename the instructions nav entry

Structural renderer change, independent of the entity-shape flip.

**Files:**
- Delete: `src/renderer/screens/commands/CommandList.tsx`
- Modify: `src/renderer/components/shell/nav.ts`
- Modify: `src/renderer/screens/Main.tsx`
- Modify: `tests/renderer/components/shell/nav.test.ts`, `tests/renderer/screens/main.test.tsx`, and (if they enumerate the `commands`/`global-instructions` subs) `tests/renderer/components/shell/SubRail.test.tsx`

- [ ] **Step 1: Delete `CommandList.tsx`**

```bash
git rm src/renderer/screens/commands/CommandList.tsx
```

- [ ] **Step 2: Update `nav.ts`** — drop `commands`, rename `global-instructions` → `instructions`

Replace the `LibrarySub` type and `LIBRARY_SUBS` (and drop the now-unused `MessageSquareText` import):

```ts
export type LibrarySub = 'skills' | 'agents' | 'hooks' | 'instructions' | 'mcps';
```

```ts
export const LIBRARY_SUBS: ReadonlyArray<SubDef<LibrarySub>> = [
  { sub: 'skills', label: 'Skills', glyph: Sparkles },
  { sub: 'agents', label: 'Agents', glyph: Bot },
  { sub: 'hooks', label: 'Hooks', glyph: Webhook },
  { sub: 'instructions', label: 'Instructions', glyph: NotebookPen },
  { sub: 'mcps', label: 'MCP', glyph: Plug },
];
```

Update the import line to remove `MessageSquareText`:

```ts
import {
  House, SlidersHorizontal, Puzzle, Activity, Sparkles, Bot,
  Webhook, NotebookPen, Store, Plug, type LucideIcon,
} from 'lucide-react';
```

- [ ] **Step 3: Update `Main.tsx`** — remove the `CommandList` import and the `commands` case; rename the `global-instructions` case to `instructions`

```tsx
import { SkillList } from './skills/SkillList.js';
import { AgentList } from './agents/AgentList.js';
import { HookList } from './hooks/HookList.js';
import { GlobalInstructionScreen } from './global-instructions/GlobalInstructionScreen.js';
import { McpList } from './mcps/McpList.js';
```

```tsx
    case 'biblioteca':
      switch (nav.sub) {
        case 'skills':
          return <SkillList />;
        case 'agents':
          return <AgentList />;
        case 'hooks':
          return <HookList />;
        case 'instructions':
          return <GlobalInstructionScreen />;
        case 'mcps':
          return <McpList />;
      }
```

- [ ] **Step 4: Update the nav/main tests**

In `nav.test.ts`, drop any assertion that `LIBRARY_SUBS` contains `commands`, and change `global-instructions` expectations to `instructions` (label `'Instructions'`, testid `nav-instructions`). In `main.test.tsx`, update any navigation that selects `commands`/`global-instructions` to use `instructions` and remove command-view assertions. If `SubRail.test.tsx` hardcodes the sub list, update it likewise.

- [ ] **Step 5: Run jsdom suite + typecheck**

Run: `npm run typecheck && npx vitest run --project jsdom`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(renderer): drop command view, rename global-instructions nav to instructions"
```

---

### Task 14: Flip the renderer to the canonical `Entity` shape

The shared type change is atomic across all renderer consumers, so this task touches every file that read `c.frontmatter.*`/`c.body`. After it, no renderer file imports from `../../shared/customization.js`. Renderer tests mock IPC, so this is verified against the jsdom project.

**Files (all rewritten below):**
- `src/renderer/hooks/use-customization-list.ts`
- `src/renderer/lib/entity-body.ts` (new)
- `src/renderer/lib/blank-customization.ts`
- `src/renderer/lib/default-global-instruction.ts`
- `src/renderer/components/CustomizationViewDrawer.tsx`
- `src/renderer/components/PluginRelatedEntities.tsx`
- `src/renderer/components/CustomizationEditor.tsx`
- `src/renderer/components/CustomizationListScreen.tsx`
- `src/renderer/screens/global-instructions/GlobalInstructionScreen.tsx`
- Tests: `tests/renderer/components/CustomizationListScreen.test.tsx`, `customization-editor.test.tsx`, `CustomizationViewDrawer.test.tsx`, `PluginRelatedEntities.test.tsx`, `tests/renderer/screens/skills/SkillList.test.tsx`, `tests/renderer/EntityDataGrid.test.tsx`

**Interfaces:**
- Consumes: `Entity`, `Skill`, `Agent`, `Instruction`, `Scope`, `EntityKind`, `entityUrn`, `WORKSPACE_SOURCE` from `../../shared/entity.js`; `SyncResult` from `../../shared/sync-result.js`.
- Produces: `entityQueryKey`, `useCustomizationList(kind, listMethod, scope)`, `useInvalidateCustomization`; `entityBody`/`withEntityBody`; `blankCustomization(kind)`; `defaultGlobalInstruction()`.

- [ ] **Step 1: Write/adjust the failing tests first**

Update the renderer test fixtures to the canonical shape. The canonical fixture template (use in `SkillList.test.tsx`, `CustomizationListScreen.test.tsx`, `CustomizationViewDrawer.test.tsx`, `PluginRelatedEntities.test.tsx`):

```ts
import { WORKSPACE_SOURCE, type Skill } from '../../src/shared/entity.js'; // adjust depth per file
const skill = (name: string, source = WORKSPACE_SOURCE): Skill => ({
  urn: `urn:skill:${name}`, kind: 'skill', name, description: `${name} description`,
  scopes: ['personal'], metadata: { version: '0.1.0', createdAt: '', updatedAt: '' },
  source, content: `# ${name}\n`,
});
```

Concretely:
- `SkillList.test.tsx`: replace the old `skill(name, source)` builder (`{ id, frontmatter, body, source }`) with the canonical one above; the `skill.list` mock returns `ok([...])` of canonical skills. `cardId`/testid lookups keyed on `name` are unchanged.
- `CustomizationListScreen.test.tsx`: build canonical entities; assertions on rendered name (`item.name`) and delete-by-name still hold (delete sends `{ id: item.name }`).
- `CustomizationViewDrawer.test.tsx`: pass a canonical `Entity` as the `entity` prop; the body assertion targets `entityBody(entity)`.
- `PluginRelatedEntities.test.tsx`: canonical items; remove any `commands` group assertions (only `skills`/`agents` groups remain); keys are `item.urn`.
- `EntityDataGrid.test.tsx`: if the fixture uses nested `frontmatter.*` field keys, change them to flat (`name`, `description`) and flatten the fixture objects.
- `customization-editor.test.tsx`: pass a canonical `Skill` as `initial`; assert the save call is `callIpc('skill.save', { skill: <canonical>, isCreate })`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run --project jsdom`
Expected: FAIL — the components still read the old shape / import `../../shared/customization.js`.

- [ ] **Step 3: Rewrite `src/renderer/hooks/use-customization-list.ts`**

```ts
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { callIpc } from '../lib/ipc.js';
import type { Entity, EntityKind, Scope } from '../../shared/entity.js';

export function entityQueryKey(kind: EntityKind, scope: Scope = 'personal'): readonly unknown[] {
  return ['entity', kind, scope] as const;
}

export function useCustomizationList(kind: EntityKind, listMethod: string, scope: Scope = 'personal') {
  return useQuery<Entity[]>({
    queryKey: entityQueryKey(kind, scope),
    queryFn: async () => {
      const list = await callIpc<Entity[]>(listMethod, { scope });
      return Array.isArray(list) ? list : [];
    },
  });
}

export function useInvalidateCustomization() {
  const qc = useQueryClient();
  return (kind: EntityKind, scope: Scope = 'personal'): Promise<void> =>
    qc.invalidateQueries({ queryKey: entityQueryKey(kind, scope) });
}
```

- [ ] **Step 4: Create `src/renderer/lib/entity-body.ts`**

```ts
import type { Agent, Entity, Instruction, Skill } from '../../shared/entity.js';

/** The editable/viewable markdown body of a `.md`-backed entity. */
export function entityBody(entity: Entity): string {
  if (entity.kind === 'agent') return (entity as Agent).systemPrompt;
  return (entity as Skill | Instruction).content;
}

/** Return a copy of `entity` with its body field (content/systemPrompt) replaced. */
export function withEntityBody<E extends Entity>(entity: E, body: string): E {
  if (entity.kind === 'agent') return { ...entity, systemPrompt: body };
  return { ...entity, content: body };
}
```

- [ ] **Step 5: Rewrite `src/renderer/lib/blank-customization.ts`**

```ts
import type { Agent, Instruction, Skill } from '../../shared/entity.js';
import { WORKSPACE_SOURCE } from '../../shared/entity.js';

/**
 * Build an empty entity pre-filled with sensible defaults for a "New" create
 * flow. `instruction` is special-cased: the schema pins name === 'default' and
 * scopes === ['personal'].
 */
export function blankCustomization(kind: 'skill' | 'agent' | 'instruction'): Skill | Agent | Instruction {
  const metadata = { version: '0.1.0', createdAt: '', updatedAt: '' };
  if (kind === 'agent') {
    return { urn: '', kind: 'agent', name: '', description: '', scopes: ['personal'], metadata, source: WORKSPACE_SOURCE, systemPrompt: '' };
  }
  if (kind === 'instruction') {
    return { urn: '', kind: 'instruction', name: 'default', description: '', scopes: ['personal'], metadata, source: WORKSPACE_SOURCE, content: '', activation: 'always' };
  }
  return { urn: '', kind: 'skill', name: '', description: '', scopes: ['personal'], metadata, source: WORKSPACE_SOURCE, content: '' };
}
```

- [ ] **Step 6: Rewrite the builder in `src/renderer/lib/default-global-instruction.ts`**

Keep `DEFAULT_GI_DESCRIPTION` and `DEFAULT_GI_BODY` **exactly as they are**. Replace only the import line and the `defaultGlobalInstruction` function:

```ts
import type { Instruction } from '../../shared/entity.js';
import { WORKSPACE_SOURCE } from '../../shared/entity.js';
```

```ts
export function defaultGlobalInstruction(): Instruction {
  return {
    urn: '',
    kind: 'instruction',
    name: 'default',
    description: DEFAULT_GI_DESCRIPTION,
    scopes: ['personal'],
    metadata: { version: '0.1.0', createdAt: '', updatedAt: '' },
    source: WORKSPACE_SOURCE,
    content: DEFAULT_GI_BODY,
    activation: 'always',
  };
}
```

- [ ] **Step 7: Rewrite `src/renderer/components/CustomizationViewDrawer.tsx`**

```tsx
import { Box, Button, Paper, Stack } from '@mui/material';
import { Pencil } from 'lucide-react';
import { Icon } from './ds/Icon.js';
import { Kicker } from './ds/Kicker.js';
import ReactMarkdown from 'react-markdown';
import { DetailDrawer } from './DetailDrawer.js';
import { ReadOnlyNotice } from './ReadOnlyNotice.js';
import { PluginOriginBadge } from './PluginOriginBadge.js';
import type { Entity } from '../../shared/entity.js';
import { entityBody } from '../lib/entity-body.js';

interface CustomizationViewDrawerProps {
  entity: Entity | null;
  onClose: () => void;
  onEdit: (entity: Entity) => void;
}

export function CustomizationViewDrawer({
  entity,
  onClose,
  onEdit,
}: CustomizationViewDrawerProps): React.ReactElement {
  const isWorkspace = entity?.source.kind === 'workspace';
  const pluginSource = entity?.source.kind === 'plugin' ? entity.source : null;

  return (
    <DetailDrawer
      open={entity !== null}
      onClose={onClose}
      title={entity?.name ?? ''}
      subtitle={entity?.description ? entity.description : undefined}
      badges={
        pluginSource ? (
          <PluginOriginBadge
            pluginId={pluginSource.pluginId}
            {...(pluginSource.provenance ? { provenance: pluginSource.provenance } : {})}
          />
        ) : undefined
      }
      testId="customization"
    >
      {entity && (
        <Stack spacing={2}>
          {pluginSource && <ReadOnlyNotice pluginId={pluginSource.pluginId} />}
          {isWorkspace && (
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<Icon glyph={Pencil} size={16} />}
                onClick={() => onEdit(entity)}
              >
                Edit
              </Button>
            </Stack>
          )}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Kicker>Body</Kicker>
            <Box sx={{ mt: 1, '& p': { my: 0.5 } }}>
              <ReactMarkdown>{entityBody(entity)}</ReactMarkdown>
            </Box>
          </Paper>
        </Stack>
      )}
    </DetailDrawer>
  );
}
```

- [ ] **Step 8: Rewrite `src/renderer/components/PluginRelatedEntities.tsx`** (drops the `commands` group + flips shape)

```tsx
import { useMemo, useState } from 'react';
import { Box, ButtonBase, Paper, Stack, Typography } from '@mui/material';
import { CustomizationViewDrawer } from './CustomizationViewDrawer.js';
import { useCustomizationList } from '../hooks/use-customization-list.js';
import type { Entity, Scope } from '../../shared/entity.js';

interface PluginRelatedEntitiesProps {
  pluginId: string;
  scope?: Scope;
}

interface Group {
  key: 'skills' | 'agents';
  label: string;
  items: Entity[];
}

function filterByPlugin(items: Entity[] | undefined, pluginId: string): Entity[] {
  return (items ?? []).filter((i) => i.source.kind === 'plugin' && i.source.pluginId === pluginId);
}

export function PluginRelatedEntities({
  pluginId,
  scope = 'personal',
}: PluginRelatedEntitiesProps): React.ReactElement {
  const skills = useCustomizationList('skill', 'skill.list', scope);
  const agents = useCustomizationList('agent', 'agent.list', scope);
  const [viewing, setViewing] = useState<Entity | null>(null);

  const groups = useMemo<Group[]>(
    () => [
      { key: 'skills', label: 'Skills', items: filterByPlugin(skills.data, pluginId) },
      { key: 'agents', label: 'Agents', items: filterByPlugin(agents.data, pluginId) },
    ],
    [skills.data, agents.data, pluginId],
  );

  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <Paper variant="outlined" sx={{ p: 2 }} data-testid="plugin-related-entities">
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
        Related entities
      </Typography>
      {total === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No related entities
        </Typography>
      ) : (
        <Stack spacing={2}>
          {groups
            .filter((g) => g.items.length > 0)
            .map((g) => (
              <Box key={g.key} data-testid={`plugin-related-group-${g.key}`}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  {g.label} ({g.items.length})
                </Typography>
                <Stack spacing={0.5}>
                  {g.items.map((item) => (
                    <ButtonBase
                      key={item.urn}
                      onClick={() => setViewing(item)}
                      sx={{ justifyContent: 'flex-start', textAlign: 'left', p: 1, borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}
                    >
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {item.name}
                        </Typography>
                        {item.description && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {item.description}
                          </Typography>
                        )}
                      </Box>
                    </ButtonBase>
                  ))}
                </Stack>
              </Box>
            ))}
        </Stack>
      )}
      <CustomizationViewDrawer entity={viewing} onClose={() => setViewing(null)} onEdit={() => setViewing(null)} />
    </Paper>
  );
}
```

- [ ] **Step 9: Rewrite `src/renderer/components/CustomizationEditor.tsx`**

```tsx
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Box, Button, Checkbox, CircularProgress, Container, FormControlLabel,
  FormGroup, Paper, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import { Kicker } from './ds/Kicker.js';
import { fonts } from '../tokens.js';
import { callIpc, IpcCallError } from '../lib/ipc.js';
import { Toast, type ToastMessage } from './Toast.js';
import { SyncReportModal } from './SyncReportModal.js';
import type { Agent, Instruction, Scope, Skill } from '../../shared/entity.js';
import { entityUrn } from '../../shared/entity.js';
import type { SyncResult } from '../../shared/sync-result.js';
import { entityBody, withEntityBody } from '../lib/entity-body.js';

type EditableEntity = Skill | Agent | Instruction;

const SAVE_BY_KIND: Record<EditableEntity['kind'], { method: string; payloadKey: string; resultKey: string }> = {
  skill: { method: 'skill.save', payloadKey: 'skill', resultKey: 'skill' },
  agent: { method: 'agent.save', payloadKey: 'agent', resultKey: 'agent' },
  instruction: { method: 'instruction.save', payloadKey: 'instruction', resultKey: 'instruction' },
};

interface CustomizationEditorProps {
  initial: EditableEntity;
  isCreate: boolean;
  onSaved: (saved: EditableEntity) => void | Promise<void>;
  onCancel: () => void;
}

type BodyView = 'edit' | 'preview' | 'split';

export function CustomizationEditor({
  initial,
  isCreate,
  onSaved,
  onCancel,
}: CustomizationEditorProps): React.ReactElement {
  const [entity, setEntity] = useState<EditableEntity>(initial);
  const [body, setBody] = useState(entityBody(initial));
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncReport, setSyncReport] = useState<SyncResult[]>([]);
  const [bodyView, setBodyView] = useState<BodyView>('split');

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    try {
      const toSave = withEntityBody({ ...entity, urn: entityUrn(entity.kind, entity.name) }, body);
      const { method, payloadKey, resultKey } = SAVE_BY_KIND[toSave.kind];
      const result = await callIpc<Record<string, unknown>>(method, { [payloadKey]: toSave, isCreate });
      const saved = result[resultKey] as EditableEntity;
      const report = (result['syncReport'] as SyncResult[] | undefined) ?? [];

      setToast({ variant: 'success', message: `${saved.name} salvo` });
      if (report.some((entry) => entry.status !== 'ok')) setSyncReport(report);
      await onSaved(saved);
    } catch (err) {
      if (err instanceof IpcCallError && err.kind === 'validation' && Array.isArray(err.details?.errors)) {
        const errors = err.details.errors as Array<{ path: string; message: string }>;
        const list = errors.map((e) => `${e.path}: ${e.message}`).join('\n');
        setToast({ variant: 'error', message: `${errors.length} validation error(s)\n${list}` });
      } else {
        setToast({ variant: 'error', message: err instanceof IpcCallError ? err.message : String(err) });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container component="main" data-testid="customization-editor" maxWidth="lg" sx={{ py: 4 }}>
      <Stack direction="row" spacing={2} sx={{ mb: 3, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography variant="h4" component="h1">
          {isCreate ? 'Nova customização' : `Editar ${initial.name}`}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={onCancel}>Cancelar</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}>
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </Stack>
      </Stack>

      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Box sx={{ mb: 2 }}><Kicker>Frontmatter</Kicker></Box>
        <Stack spacing={2}>
          <TextField
            label="Name"
            value={entity.name}
            onChange={(e) => setEntity((prev) => ({ ...prev, name: e.target.value }))}
            slotProps={{ htmlInput: { pattern: '^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$', title: 'lowercase letters, digits and hyphens only (1-64 chars, no leading/trailing hyphen)' } }}
            fullWidth
          />
          <TextField
            label="Description"
            value={entity.description}
            onChange={(e) => setEntity((prev) => ({ ...prev, description: e.target.value }))}
            slotProps={{ htmlInput: { maxLength: 200 } }}
            helperText={`${entity.description.length}/200`}
            fullWidth
          />
          <TextField
            label="Version"
            value={entity.metadata.version}
            onChange={(e) => setEntity((prev) => ({ ...prev, metadata: { ...prev.metadata, version: e.target.value } }))}
            sx={{ maxWidth: 200 }}
          />
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Scope</Typography>
            <FormGroup row>
              {(['personal', 'project'] as const).map((value) => (
                <FormControlLabel
                  key={value}
                  control={
                    <Checkbox
                      checked={entity.scopes.includes(value)}
                      onChange={(e) => {
                        const next: Scope[] = e.target.checked
                          ? Array.from(new Set([...entity.scopes, value]))
                          : entity.scopes.filter((s) => s !== value);
                        setEntity((prev) => ({ ...prev, scopes: next }));
                      }}
                    />
                  }
                  label={value}
                />
              ))}
            </FormGroup>
          </Box>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 3 }}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Kicker>Body</Kicker>
          <ToggleButtonGroup size="small" exclusive value={bodyView} onChange={(_, v: BodyView | null) => v && setBodyView(v)}>
            <ToggleButton value="edit">Editar</ToggleButton>
            <ToggleButton value="split">Dividir</ToggleButton>
            <ToggleButton value="preview">Prévia</ToggleButton>
          </ToggleButtonGroup>
        </Stack>

        <Box sx={{ display: 'grid', gridTemplateColumns: bodyView === 'split' ? '1fr 1fr' : '1fr', gap: 2 }}>
          {(bodyView === 'edit' || bodyView === 'split') && (
            <TextField
              value={body}
              onChange={(e) => setBody(e.target.value)}
              multiline minRows={16} fullWidth
              slotProps={{ htmlInput: { 'data-testid': 'body-textarea', style: { fontFamily: fonts.mono, fontSize: '0.9rem', lineHeight: 1.5 } } }}
            />
          )}
          {(bodyView === 'preview' || bodyView === 'split') && (
            <Box
              data-testid="markdown-preview"
              sx={{
                border: 1, borderColor: 'divider', borderRadius: 1, p: 2, minHeight: 240,
                bgcolor: 'background.default', overflow: 'auto',
                '& h1, & h2, & h3': { mt: 1.5, mb: 1 }, '& p': { my: 1 },
                '& code': { bgcolor: 'action.hover', px: 0.5, borderRadius: 0.5, fontFamily: 'monospace' },
                '& pre': { bgcolor: 'action.hover', p: 1.5, borderRadius: 1, overflow: 'auto' },
              }}
            >
              <ReactMarkdown>{body}</ReactMarkdown>
            </Box>
          )}
        </Box>
      </Paper>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
      <SyncReportModal report={syncReport} onClose={() => setSyncReport([])} />
    </Container>
  );
}
```

- [ ] **Step 10: Rewrite `src/renderer/components/CustomizationListScreen.tsx`**

```tsx
import { useState } from 'react';
import {
  Box, Button, Container, Dialog, DialogActions, DialogContent,
  DialogContentText, DialogTitle, Stack,
} from '@mui/material';
import { Plus, Pencil, Trash2, Copy, Sparkles } from 'lucide-react';
import { Icon } from './ds/Icon.js';
import { ScreenHeader } from './ds/ScreenHeader.js';
import { EmptyState } from './ds/EmptyState.js';
import { callIpc, IpcCallError } from '../lib/ipc.js';
import { Toast, type ToastMessage } from './Toast.js';
import { PluginOriginBadge } from './PluginOriginBadge.js';
import { CustomizationEditor } from './CustomizationEditor.js';
import { CustomizationViewDrawer } from './CustomizationViewDrawer.js';
import { EntityDataGrid } from './EntityDataGrid/index.js';
import type { EntityDef, RowAction } from './EntityDataGrid/index.js';
import { useCustomizationList, useInvalidateCustomization } from '../hooks/use-customization-list.js';
import type { Agent, Entity, Skill } from '../../shared/entity.js';
import { blankCustomization } from '../lib/blank-customization.js';

interface CustomizationListScreenProps {
  entityType: 'skill' | 'agent';
  title: string;
  singular: string;
  gender: 'f' | 'm';
  listMethod: string;
  deleteMethod: string;
  subtitle?: React.ReactNode;
  emptyDescription?: React.ReactNode;
}

type Editor =
  | { kind: 'closed' }
  | { kind: 'create'; customization: Skill | Agent }
  | { kind: 'edit'; customization: Skill | Agent };

export function CustomizationListScreen({
  entityType, title, singular, gender, listMethod, deleteMethod, subtitle, emptyDescription,
}: CustomizationListScreenProps): React.ReactElement {
  const { data, isLoading, error } = useCustomizationList(entityType, listMethod);
  const invalidate = useInvalidateCustomization();

  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [editor, setEditor] = useState<Editor>({ kind: 'closed' });
  const [confirmDelete, setConfirmDelete] = useState<Entity | null>(null);
  const [viewing, setViewing] = useState<Entity | null>(null);

  const items = data ?? [];

  const handleSaved = async (saved: Skill | Agent): Promise<void> => {
    setEditor({ kind: 'closed' });
    setToast({ variant: 'success', message: `${saved.name} salvo` });
    await invalidate(entityType);
  };

  const handleDeleteConfirmed = async (): Promise<void> => {
    if (!confirmDelete) return;
    try {
      await callIpc(deleteMethod, { id: confirmDelete.name, removeSymlinks: true });
      setToast({ variant: 'success', message: `${confirmDelete.name} removido` });
      await invalidate(entityType);
    } catch (err) {
      const message = err instanceof IpcCallError ? err.message : String(err);
      setToast({ variant: 'error', message });
    } finally {
      setConfirmDelete(null);
    }
  };

  if (editor.kind !== 'closed') {
    return (
      <CustomizationEditor
        initial={editor.customization}
        isCreate={editor.kind === 'create'}
        onSaved={(saved) => handleSaved(saved as Skill | Agent)}
        onCancel={() => setEditor({ kind: 'closed' })}
      />
    );
  }

  const startCreate = (): void =>
    setEditor({ kind: 'create', customization: blankCustomization(entityType) as Skill | Agent });

  const entity: EntityDef<Entity> = {
    name: entityType,
    pluralName: `${singular}s`,
    getKey: (item) => `${item.source.kind}/${item.urn}`,
    fields: [
      {
        key: 'name',
        label: 'Name',
        primary: true,
        searchable: true,
        render: (item, view) =>
          view === 'card' && item.source.kind === 'plugin' ? (
            <Stack direction="row" sx={{ alignItems: 'center' }}>
              <Box component="span">{item.name}</Box>
              <PluginOriginBadge
                pluginId={item.source.pluginId}
                {...(item.source.provenance ? { provenance: item.source.provenance } : {})}
              />
            </Stack>
          ) : (
            item.name
          ),
      },
      {
        key: 'plugin',
        label: 'Plugin',
        hideInCard: true,
        width: 160,
        render: (item) =>
          item.source.kind === 'plugin' ? (
            <PluginOriginBadge
              pluginId={item.source.pluginId}
              {...(item.source.provenance ? { provenance: item.source.provenance } : {})}
            />
          ) : null,
      },
      { key: 'description', label: 'Description', secondary: true, searchable: true },
    ],
  };

  const isWorkspace = (item: Entity): boolean => item.source.kind === 'workspace';

  const actions: RowAction<Entity>[] = [
    {
      label: 'Editar',
      icon: <Icon glyph={Pencil} size={16} />,
      hidden: (item) => !isWorkspace(item),
      onClick: (item) => setEditor({ kind: 'edit', customization: item as Skill | Agent }),
    },
    {
      label: 'Duplicar',
      icon: <Icon glyph={Copy} size={16} />,
      hidden: (item) => !isWorkspace(item),
      onClick: (item) => setEditor({ kind: 'create', customization: duplicateCustomization(item as Skill | Agent, items) }),
    },
    {
      label: 'Excluir',
      icon: <Icon glyph={Trash2} size={16} />,
      variant: 'destructive',
      hidden: (item) => !isWorkspace(item),
      onClick: (item) => setConfirmDelete(item),
    },
  ];

  return (
    <Container component="main" data-testid={`entity-list-${entityType}`} maxWidth="lg" sx={{ py: 2.5 }}>
      <ScreenHeader
        kicker="Biblioteca"
        title={title}
        subtitle={subtitle}
        actions={
          <Button variant="contained" startIcon={<Icon glyph={Plus} size={16} />} onClick={startCreate} data-testid={`new-${entityType}-button`}>
            Novo
          </Button>
        }
      />

      <EntityDataGrid<Entity>
        entity={entity}
        data={items}
        isLoading={isLoading}
        error={error}
        actions={actions}
        onRowClick={(item) => setViewing(item)}
        searchPlaceholder={`Buscar ${singular}s…`}
        emptyState={
          <EmptyState
            glyph={Sparkles}
            title={`Nenhum${gender === 'f' ? 'a' : ''} ${singular} ainda`}
            description={emptyDescription}
            cta={
              <Button variant="outlined" startIcon={<Icon glyph={Plus} size={16} />} onClick={startCreate}>
                Criar {singular}
              </Button>
            }
            testId={entityType}
          />
        }
      />

      <Dialog open={confirmDelete !== null} onClose={() => setConfirmDelete(null)} aria-label="Confirmar exclusão" data-testid="confirm-delete-dialog">
        <DialogTitle>Confirmar exclusão</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Remover <strong>{confirmDelete?.name}</strong>?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>Cancelar</Button>
          <Button variant="contained" color="error" onClick={handleDeleteConfirmed}>Confirmar</Button>
        </DialogActions>
      </Dialog>

      <Toast toast={toast} onDismiss={() => setToast(null)} />

      <CustomizationViewDrawer
        entity={viewing}
        onClose={() => setViewing(null)}
        onEdit={(item) => {
          setViewing(null);
          setEditor({ kind: 'edit', customization: item as Skill | Agent });
        }}
      />
    </Container>
  );
}

function duplicateCustomization(source: Skill | Agent, siblings: Entity[]): Skill | Agent {
  const taken = new Set(siblings.map((a) => a.name));
  const base = source.name;
  let candidate = `${base}-copy`;
  let i = 2;
  while (taken.has(candidate)) {
    candidate = `${base}-copy-${i}`;
    i++;
  }
  return { ...source, urn: '', name: candidate, metadata: { ...source.metadata, createdAt: '', updatedAt: '' } };
}
```

- [ ] **Step 11: Update `src/renderer/screens/global-instructions/GlobalInstructionScreen.tsx`**

Apply these edits (the surrounding UI is unchanged):
- Change the type import: `import type { Instruction } from '../../../shared/entity.js';` (remove the `../../../shared/customization.js` import).
- `const QUERY_KEY = ['instruction', SLUG] as const;`
- `useState<{ customization: Instruction; isCreate: boolean } | null>(null)`.
- `useQuery<Instruction | null>` and `callIpc<Instruction>('instruction.get', { id: SLUG })`.
- `openBlank`: `setEditor({ customization: blankCustomization('instruction'), isCreate: true })`.
- `onSaved`: `message: \`${saved.name} salvo\``.
- `renderConfigured(existing: Instruction, ...)`: `existing.description?.trim()` → `existing.description.trim()`; `existing.body` → `existing.content` (both the `lineCount` and `parseSections` calls); `existing.frontmatter.version` → `existing.metadata.version`.
- Extend `DESTINATIONS` to reflect the new dual sync target:

```ts
const DESTINATIONS = [
  { assistant: 'Claude Code', path: '~/.claude/CLAUDE.md' },
  { assistant: 'AGENTS.md (neutral)', path: '~/AGENTS.md' },
] as const;
```

- [ ] **Step 12: Run jsdom suite + typecheck**

Run: `npm run typecheck && npx vitest run --project jsdom`
Expected: PASS. If typecheck flags a `../../shared/customization.js` import anywhere in `src/renderer`, migrate that site too (that is the compiler catching a missed ripple site).

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "refactor(renderer): flip customization screens to the canonical Entity shape"
```

---

## Group F — Finalize the sync core and delete the `Customization` model

### Task 15: Point sync at `EntityRepository`, then delete all `Customization` code

At this point every live service (`SkillService`/`AgentService`/`InstructionService`) reads/writes through `EntityService` + `FsEntityRepository`. The `Customization` stack is dead except for `AdapterManager`'s bulk methods, which still enumerate `customizationRepository`. This task flips those to `entityRepository` and then removes the dead code. Do it in two phases; both end green.

**Files — Phase 15.A (sync core):**
- Modify: `src/main/application/services/adapter-manager.ts`
- Modify: `src/main/application/ports/adapter.ts`, `src/main/infrastructure/adapters/claude-adapter.ts`
- Modify: `src/main/index.ts`
- Modify/delete: `tests/main/application/services/__tests__/adapter-manager.helpers.ts` and the `adapter-manager.*` / `claude-adapter.*` tests

**Files — Phase 15.B (model teardown):**
- Delete: `customization-service.ts`, `customization-plugin-helpers.ts`, `schema-validator.ts`; `ports/customization-repository.ts`; `infrastructure/customization/fs-customization-repository.ts`, `in-memory-customization-repository.ts`, `normalize-frontmatter.ts`; `schemas/{common,skill,agent,command,global-instruction}.ts`; `domain/customization-id.ts`, `domain/command-id.ts`, `schemas/command.ts` (+ their tests)
- Modify: `src/shared/customization.ts` → deleted after `SyncResult` importers are repointed
- Modify: `src/main/index.ts`

#### Phase 15.A — flip `AdapterManager` to `EntityRepository`

- [ ] **Step 1: Change the dependency**

In `adapter-manager.ts`: replace the `customizationRepository: CustomizationRepository` field in `AdapterManagerDeps` with `entityRepository: EntityRepository`; change the imports (`import type { EntityRepository } from '../ports/entity-repository.js';`, drop `CustomizationRepository` and `Customization`); the `Entity` import from Task 6 is already present.

- [ ] **Step 2: Rewrite the four enumerating methods to iterate entities**

`syncAll` and `removeAll` become (mirroring the already-added `syncEntity`/`removeEntity`):

```ts
  async syncAll(command: SyncAllCommand): Promise<SyncResult[]> {
    const settings = (await this.deps.settingsService.load()) ?? this.deps.settingsService.getDefaults();
    const enabledAdapters = this.enabledAdapters(settings).filter((adapter) =>
      command.adapterId ? adapter.adapterId === command.adapterId : true,
    );
    const entities = await this.deps.entityRepository.list();
    const results: SyncResult[] = [];
    for (const entity of entities) {
      const includesProject = entity.scopes.includes('project');
      for (const adapter of enabledAdapters) {
        const destinations = await adapter.resolveEntityDestinations({ entity, linkedRepos: settings.linkedRepos });
        for (const destination of destinations) {
          results.push(await this.syncDestination(adapter.adapterId, this.entitySourcePath(entity, this.deps.workspacePath), destination.destination));
        }
        if (includesProject && settings.linkedRepos.length === 0) {
          results.push({ adapter: adapter.adapterId, destination: null, status: 'ok', details: { skipped: 'no-linked-repos' } });
        }
      }
    }
    return results;
  }

  async removeAll(command: RemoveAllCommand): Promise<SyncResult[]> {
    const adapter = this.deps.adapters.get(command.adapterId);
    if (!adapter) return [];
    const settings = (await this.deps.settingsService.load()) ?? this.deps.settingsService.getDefaults();
    const entities = await this.deps.entityRepository.list();
    const results: SyncResult[] = [];
    for (const entity of entities) {
      const destinations = await adapter.resolveEntityDestinations({ entity, linkedRepos: settings.linkedRepos });
      for (const destination of destinations) {
        results.push(await this.removeDestination(adapter.adapterId, destination.destination));
      }
    }
    return results;
  }
```

For `countDestinations` and `planDestinations`, apply the **identical mechanical swap** in place: `this.deps.customizationRepository.list()` → `this.deps.entityRepository.list()`; loop variable `customization` → `entity`; `adapter.resolveDestinations({ customization, linkedRepos })` → `adapter.resolveEntityDestinations({ entity, linkedRepos })`; `customization.frontmatter.scopes` → `entity.scopes`; `this.customizationSourcePath(customization, …)` → `this.entitySourcePath(entity, …)`.

- [ ] **Step 3: Delete the now-dead single-item + resolve paths**

- Remove `syncOne`, `removeOne`, `SyncOneCommand`, `RemoveOneCommand`, and the private `customizationSourcePath` from `adapter-manager.ts`.
- Remove `resolveDestinations` from the `Adapter` port (`adapter.ts`) and from `ClaudeAdapter` (`claude-adapter.ts`), along with the now-unused `Customization` imports and `SUBFOLDER_BY_TYPE`/`fileName` logic that only served the old method. Keep `resolveEntityDestinations`.

- [ ] **Step 4: Update the AdapterManager test helper + tests**

- In `adapter-manager.helpers.ts`: construct `new InMemoryEntityRepository()` instead of `InMemoryCustomizationRepository`, name it `entityRepository`, pass it to `AdapterManager`, and expose `registerEntity(entity)` (was `registerCustomization`).
- In the `adapter-manager.*.test.ts` suite and any `claude-adapter` end-to-end tests, seed canonical entities with `registerEntity(...)` using the canonical fixture (see Task 4/6), and update destination expectations: skills/agents are unchanged; **an instruction now yields two destinations (`~/.claude/CLAUDE.md` and `~/AGENTS.md`)**; commands no longer appear.
- Delete the per-type `resolveDestinations` tests now superseded by `claude-adapter.entity-destinations.test.ts` (Task 6): `claude-adapter.{skill,agent,command}-*.test.ts`, `claude-adapter.contract.test.ts`, `claude-adapter.special-chars.test.ts`, `claude-adapter.global-instruction.test.ts`. Migrate the true end-to-end symlink tests (`claude-adapter.e2e.test.ts`, `global-instruction.e2e.test.ts`, `disable-claude-external-symlink.e2e.test.ts`) to drive `syncEntity`/`syncAll` with canonical entities; keep whichever assertions still describe real behavior.

- [ ] **Step 5: Update the composition root (partial)**

In `index.ts`, change the `AdapterManager` construction to pass `entityRepository` (the `FsEntityRepository` created in Task 9) instead of `customizationRepository`. Leave the (now-unused) `CustomizationService`/`SchemaValidator`/`FsCustomizationRepository` lines for Step 8.

- [ ] **Step 6: Run node suite + typecheck (Phase 15.A gate)**

Run: `npm run typecheck && npx vitest run --project node`
Expected: PASS.

- [ ] **Step 7: Commit Phase 15.A**

```bash
git add -A
git commit -m "refactor(sync): AdapterManager enumerates EntityRepository; drop customization sync path"
```

#### Phase 15.B — delete the `Customization` model

- [ ] **Step 8: Delete the dead main-process modules**

```bash
git rm \
  src/main/application/services/customization-service.ts \
  src/main/application/services/customization-plugin-helpers.ts \
  src/main/application/services/schema-validator.ts \
  src/main/application/ports/customization-repository.ts \
  src/main/infrastructure/customization/fs-customization-repository.ts \
  src/main/infrastructure/customization/in-memory-customization-repository.ts \
  src/main/infrastructure/customization/normalize-frontmatter.ts \
  src/main/application/schemas/common.ts \
  src/main/application/schemas/skill.ts \
  src/main/application/schemas/agent.ts \
  src/main/application/schemas/command.ts \
  src/main/application/schemas/global-instruction.ts \
  src/main/domain/customization-id.ts \
  src/main/domain/command-id.ts
```

Also delete their orphaned tests: `tests/main/application/services/customization-service.test.ts` and its `__tests__/customization-service.*.test.ts`, `__tests__/schema-validator.*.test.ts`, `tests/main/infrastructure/customization/fs-customization-repository*.test.ts`, `tests/main/infrastructure/customization/normalize-frontmatter.test.ts`, `tests/main/domain/customization-id.test.ts`, `tests/main/domain/command-id.test.ts`.

> Retain `src/main/domain/customization-source.ts` — its `CustomizationSource`/`pluginSource` are still used by the untouched `hook`/`mcp` code (Phase 1 will rename it). Retain `src/main/application/markdown/frontmatter.ts` — `EntitySerializer` uses it. Before deleting `common.ts`, run `grep -rn "schemas/common" src` to confirm no surviving importer (hook/mcp/manifest schemas do not use it); if one does, keep only the shared helper it needs.

> Legacy note: the old `normalize-frontmatter` migrated a singular `scope` key to `scopes[]`. `EntitySerializer.readScopes` (Task 3) already defaults a missing `scopes` to `['personal']`. If preserving the singular-`scope` migration matters for existing files, add a `fm['scope']` fallback to `readScopes` before deleting `normalize-frontmatter.ts`.

- [ ] **Step 9: Finish the composition root**

In `index.ts`, remove the construction of `SchemaValidator`, `CustomizationService`, `FsCustomizationRepository`, and any `InMemoryCustomizationRepository`/`normalize` imports. The `EntityValidator`/`FsEntityRepository`/`EntityService` wiring from Task 9 and the `entityRepository`-based `AdapterManager` from Step 5 are the only persistence wiring that remains for `.md` entities.

- [ ] **Step 10: Repoint `SyncResult` imports and delete `shared/customization.ts`**

Run `grep -rln "shared/customization.js" src tests`. Every remaining hit now imports only `SyncResult`/`SyncStatus`/`SyncResultDetails` (the `Customization*` types have no more importers). In each, change the import path from `'../../shared/customization.js'` (adjust depth) to `'.../shared/sync-result.js'` — notably `src/shared/ipc-contract.ts` and `src/main/application/services/adapter-manager.ts`. Then:

```bash
git rm src/shared/customization.ts
```

- [ ] **Step 11: Full gate**

Run: `npm run typecheck && npm run lint && npx vitest run`
Expected: PASS. Typecheck will flag any lingering `Customization`/`CustomizationType`/`CustomizationFrontmatter`/`CustomizationScope` importer — fix each (there should be none in `src/` after the above).

- [ ] **Step 12: Commit Phase 15.B**

```bash
git add -A
git commit -m "refactor: delete the Customization model, repository, schemas, and umbrella service"
```

---

### Task 16: Full verification + end-to-end wire check

The two Vitest projects were independently green throughout, but the renderer↔main wire was only exercised by mocks. This task proves the real wire and the release gate.

- [ ] **Step 1: Release gate**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all PASS; coverage at or above thresholds (**lines 80 / functions 76 / statements 78 / branches 66**). If a threshold regressed because deleted tests removed coverage, add focused tests to the new `entity`/`serializer`/`repository`/`service` suites until green — do not lower thresholds.

- [ ] **Step 2: Confirm no `Customization` vocabulary remains in source**

Run: `grep -rn "Customization\b\|CustomizationFrontmatter\|shared/customization" src | grep -v "customization-source\|CustomizationListScreen\|CustomizationEditor\|CustomizationViewDrawer\|use-customization-list"`
Expected: no hits except the intentionally-retained `customization-source.ts` and the deliberately-un-renamed renderer component *files* (decision #7). If anything else appears, migrate it.

- [ ] **Step 3: End-to-end wire check (build + Playwright)**

Run: `npm run test:e2e`
Expected: build succeeds and the Playwright suite passes. This is the first check that the renderer's canonical payloads match what the main-process handlers expect. If a spec references the removed command view or the `global-instruction.*` methods, update it.

- [ ] **Step 4: Manual smoke via `npm run dev`**

Launch the app (`npm run dev`) and verify against a scratch workspace:
- Skills list loads; create a skill, confirm `~/.superset-ai-app/skills/<name>/SKILL.md` exists and `~/.claude/skills/<name>` symlink resolves to it.
- Create/rename/delete a skill; confirm the symlink follows the rename and is removed on delete.
- Agents list behaves the same (`agents/<name>.md` → `~/.claude/agents/<name>.md`).
- Instructions screen: save the OGS template; confirm `~/.superset-ai-app/instructions/default.md` is **frontmatter-free** and both `~/.claude/CLAUDE.md` and `~/AGENTS.md` symlink to it.
- The left rail shows **no** "Prompts/Commands" entry and shows "Instructions".
- A plugin-provided skill still appears (read-only, plugin badge) and cannot be edited/deleted.

- [ ] **Step 5: Update docs**

Update `docs/reference/architecture.md`, `docs/reference/ipc-contract.md`, and `docs/reference/customization-schema.md` to describe the `Entity` model, the `instruction.*` namespace (and removed `command.*`/`global-instruction.*`), and the instruction dual-symlink behavior. Update `CLAUDE.md`'s "Per-entity facades" paragraph to reference `EntityService`/`EntityRepository` and the removal of `Customization`.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "docs: describe the canonical Entity model (Phase 0) and update references"
```

---

## Self-Review

**1. Spec coverage (Phase 0, spec §8.1):**
- Introduce `Entity` + `Skill`/`Agent`/`Instruction` → Task 1 (+ concrete types), serializer Task 3. ✅
- Delete `Customization`/`CustomizationFrontmatter`/`customization-service` → Task 15.B. ✅
- Migrate the three `.md` entities to canonical (Claude serializer = symlink identity) → skill/agent symlink unchanged (Tasks 6/15.A); instruction symlinks a frontmatter-free file (Tasks 3/5/6). ✅
- Fold command → skill (`explicitOnly` ↔ `disable-model-invocation`) → `Skill.explicitOnly` + serializer mapping (Tasks 1/3); command entity/view removed (Tasks 12/13). Per the locked decision, no on-disk migration of existing `commands/*.md`. ✅ (documented divergence)
- Reshape global-instruction → instruction with `activation` (+ AGENTS.md emission) → Tasks 1/11/6/14. ✅
- Renderer ripple → Tasks 13/14. ✅

**2. Placeholder scan:** No "TBD/implement later". Two deliberate "copy the exact imports from the existing file" instructions (Task 8 step 1; Task 15.A count/plan swap) — these are deterministic, not placeholders, and used only where the source module path could not be quoted verbatim. Test-file *edits* in Tasks 9–15 are described as precise transformations (delete cases X, build canonical fixture Y) rather than full re-listings, because those test files were not quoted verbatim during discovery; every *new* file and every *product* file is given in full.

**3. Type consistency (checked across tasks):** `entityUrn(kind, name)`, `EntitySource`/`WORKSPACE_SOURCE`, `EntityMetadata.version`, `Skill.content`/`Skill.explicitOnly`, `Agent.systemPrompt`, `Instruction.content`/`Instruction.activation` are used identically in the serializer (T3), repository (T4/T5), service (T7), facades (T9/T10/T11), and renderer (T14). `EntityService.save({ entity, isCreate })` / `.delete({ urn, removeSymlinks })` and `AdapterManager.syncEntity({ entity })` / `.removeEntity({ entity })` are consistent between definition (T6/T7) and all callers. IPC payload keys (`skill`/`agent`/`instruction`) match between handlers (T9/T11) and the renderer editor's `SAVE_BY_KIND` (T14). `EntityValidator` emits `details.errors` (fixed) to match the editor's toast.

**Known deviations / follow-ups (intentional, not gaps):**
- Instruction metadata is *synthesized* (version `'0.0.0'`, empty timestamps), not read from file stat — avoids a `FileSystemPort` change. The instruction screen shows `metadata.version` (`v0.0.0`) accordingly.
- `AGENTS.md` emission rides on the Claude adapter's `resolveEntityDestinations` for Phase 0 (only one adapter exists). Phase 2 will move it to a dedicated neutral emitter.
- `ext` remains an opaque `Record<string, unknown>` (spec open question §11) — per-tool typing is Phase 2.
- Renderer component *filenames* keep the `Customization*` names (decision #7); the `Customization` *types* are fully removed.
- Existing `commands/*.md` and any `~/.claude/commands/*` symlinks are orphaned by design (no migration).

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-07-01-canonical-entity-model-phase-0.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints for review.

**Which approach?**

