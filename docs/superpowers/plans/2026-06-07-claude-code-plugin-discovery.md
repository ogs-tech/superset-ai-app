# Claude Code Plugin Discovery + Diagnostics Sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Frontend tasks (A7, B2) MUST invoke `/frontend-design:frontend-design`** before writing renderer UI — the baseline code in each step is the contract (test IDs, props, data flow); frontend-design refines the visual treatment of the badge and the sync summary.

**Goal:** Make skills/agents/commands from plugins installed directly in Claude Code (`~/.claude/plugins/`) appear read-only in the existing list screens badged "via Claude Code" (Feature A), and let the Diagnostics "Atualizar" button run a symlink sync then refresh, surfacing a summary (Feature B).

**Architecture:** Respects the existing hexagonal split (`domain` / `application/{ports,services}` / `infrastructure` / `ipc`). A new read-only port + adapter parses the Claude Code registry; the existing plugin scanner is generalized to run over any plugin root dir (workspace cache **or** a Claude Code `installPath`); a three-tier merge (`workspace` > `workspace-managed` > `claude-code`) falls out of the scanner's internal dedup plus the services' existing `workspaceIds` filter. Feature B is a pure-renderer react-query mutation over the existing `adapter.syncAll` IPC.

**Tech Stack:** TypeScript (strict, ESM with `.js` import extensions, `verbatimModuleSyntax`), Electron main/preload/renderer, Vitest (node + jsdom projects), react-query, MUI + Emotion, zod.

---

## Scope note

This plan covers **two independent PRs** (the spec mandates this): **Feature A** (Tasks A1–A8) and **Feature B** (Tasks B1–B2). Each produces working, testable software on its own. Implement and merge Feature A first (it is the actual fix), then Feature B. Do **not** bundle them into one PR.

## File Structure

### Feature A — created

- `src/main/application/ports/claude-code-plugin-registry-port.ts` — port: read the Claude Code registry into descriptors.
- `src/main/infrastructure/plugins/claude-code-plugin-reader.ts` — adapter: parse `~/.claude/plugins/installed_plugins.json`.
- `tests/main/infrastructure/plugins/claude-code-plugin-reader.test.ts`
- `tests/main/application/services/claude-code-discovery.test.ts` — scanner + three-tier merge over a Claude Code root.

### Feature A — modified

- `src/main/domain/customization-source.ts` — add `PluginProvenance` + provenance marker on the plugin source variant.
- `src/main/application/services/plugin-provenance.ts` — generalize to scan **roots** (workspace-managed + claude-code); add `scan()`, keep `forScope()`.
- `src/main/application/services/customization-plugin-helpers.ts` — `collectPluginEntities` reads from a ref's `dir` and tags provenance.
- `src/main/application/services/skill-service.ts`, `agent-service.ts`, `command-service.ts` — build callbacks pass `provenance` into `pluginSource(...)`.
- `src/main/index.ts` — wire `ClaudeCodePluginReader` into the shared `PluginProvenanceService`.
- `src/renderer/hooks/use-customization-list.ts` — source type gains optional `provenance`.
- `src/renderer/components/PluginOriginBadge.tsx` — render "via Claude Code" for claude-code provenance.
- `src/renderer/components/ds/StatusPill.tsx` — add `'claude-code'` variant.
- `src/renderer/components/CustomizationListScreen.tsx`, `CustomizationViewDrawer.tsx` — pass `provenance` to the badge.
- Existing tests asserting the old `source` shape (Task A5).

### Feature B — created

- `src/renderer/hooks/use-sync-then-refresh.ts` — react-query mutation: `adapter.syncAll` → invalidate health → return `SyncResult[]`.
- `tests/renderer/hooks/use-sync-then-refresh.test.tsx`

### Feature B — modified

- `src/renderer/screens/health/HealthScreen.tsx` — "Atualizar" runs the mutation and renders a sync summary.
- `tests/renderer/screens/health/HealthScreen.test.tsx`

---

# FEATURE A — Inbound discovery of Claude Code plugins (PR 1)

## Task A1: Provenance marker on the customization source

**Files:**
- Modify: `src/main/domain/customization-source.ts`
- Test: `tests/main/domain/customization-source.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/main/domain/customization-source.test.ts`:

```typescript
import { PluginProvenance } from '../../../src/main/domain/customization-source.js';

describe('pluginSource provenance', () => {
  it('defaults provenance to workspace-managed', () => {
    const src = pluginSource(pluginId('superpowers'));
    expect(src).toEqual({
      kind: 'plugin',
      pluginId: 'superpowers',
      provenance: 'workspace-managed',
    });
  });

  it('carries an explicit claude-code provenance', () => {
    const src = pluginSource(pluginId('feature-dev'), 'claude-code');
    expect(src).toEqual({
      kind: 'plugin',
      pluginId: 'feature-dev',
      provenance: 'claude-code',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/main/domain/customization-source.test.ts`
Expected: FAIL — `pluginSource` returns no `provenance` field / `PluginProvenance` not exported.

- [ ] **Step 3: Update the implementation**

Replace the body of `src/main/domain/customization-source.ts` with:

```typescript
import type { PluginId } from './plugin-id.js';

export type PluginProvenance = 'workspace-managed' | 'claude-code';

export type CustomizationSource =
  | { kind: 'workspace' }
  | { kind: 'plugin'; pluginId: PluginId; provenance: PluginProvenance };

export const WORKSPACE_SOURCE: CustomizationSource = { kind: 'workspace' };

export function pluginSource(
  pluginId: PluginId,
  provenance: PluginProvenance = 'workspace-managed',
): CustomizationSource {
  return { kind: 'plugin', pluginId, provenance };
}

export function isPluginSource(
  source: CustomizationSource,
): source is { kind: 'plugin'; pluginId: PluginId; provenance: PluginProvenance } {
  return source.kind === 'plugin';
}

export function isWorkspaceSource(
  source: CustomizationSource,
): source is { kind: 'workspace' } {
  return source.kind === 'workspace';
}
```

The default keeps every existing caller (`skill/agent/command/hook` services, fixtures) correct without edits — they all build workspace-managed plugin sources today.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/main/domain/customization-source.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/domain/customization-source.ts tests/main/domain/customization-source.test.ts
git commit -m "feat(domain): add provenance marker to customization plugin source"
```

---

## Task A2: ClaudeCodePluginRegistry port + reader adapter

**Files:**
- Create: `src/main/application/ports/claude-code-plugin-registry-port.ts`
- Create: `src/main/infrastructure/plugins/claude-code-plugin-reader.ts`
- Test: `tests/main/infrastructure/plugins/claude-code-plugin-reader.test.ts`

- [ ] **Step 1: Write the port**

Create `src/main/application/ports/claude-code-plugin-registry-port.ts`:

```typescript
import type { PluginId } from '../../domain/plugin-id.js';

/**
 * A single plugin installed directly by Claude Code (`~/.claude/plugins/`).
 * `installPath` points verbatim at the plugin content; it is used as-is and is
 * never reconstructed from id/version.
 */
export interface ClaudeCodePluginDescriptor {
  pluginId: PluginId;
  marketplace: string;
  installPath: string;
  version: string;
  scope: 'user';
}

export interface ClaudeCodePluginRegistryPort {
  list(): Promise<ClaudeCodePluginDescriptor[]>;
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/main/infrastructure/plugins/claude-code-plugin-reader.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { ClaudeCodePluginReader } from '../../../../src/main/infrastructure/plugins/claude-code-plugin-reader.js';
import { InMemoryFileSystem } from '../../../../src/main/infrastructure/filesystem/in-memory-filesystem.js';

const REGISTRY = '/home/.claude/plugins/installed_plugins.json';

const reader = (fs: InMemoryFileSystem) =>
  new ClaudeCodePluginReader({ registryPath: REGISTRY, fs });

const validRegistry = JSON.stringify({
  version: 2,
  plugins: {
    'feature-dev@claude-plugins-official': [
      {
        scope: 'user',
        installPath: '/home/.claude/plugins/cache/claude-plugins-official/feature-dev/unknown',
        version: 'unknown',
        installedAt: '2026-06-06T20:39:35.422Z',
        lastUpdated: '2026-06-06T20:39:35.422Z',
      },
    ],
    'code-review@claude-plugins-official': [
      {
        scope: 'user',
        installPath: '/home/.claude/plugins/cache/claude-plugins-official/code-review/unknown',
        version: 'unknown',
        installedAt: '2026-06-06T20:39:35.422Z',
        lastUpdated: '2026-06-06T20:39:35.422Z',
      },
    ],
  },
});

describe('ClaudeCodePluginReader', () => {
  it('returns an empty list when the registry file is missing', async () => {
    const fs = new InMemoryFileSystem();
    expect(await reader(fs).list()).toEqual([]);
  });

  it('treats corrupt JSON as empty without throwing', async () => {
    const fs = new InMemoryFileSystem();
    fs.createFile(REGISTRY, '{ not valid json');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await reader(fs).list()).toEqual([]);
    warn.mockRestore();
  });

  it('parses each install into a descriptor, using installPath verbatim', async () => {
    const fs = new InMemoryFileSystem();
    fs.createFile(REGISTRY, validRegistry);
    const descriptors = await reader(fs).list();
    expect(descriptors).toContainEqual({
      pluginId: 'feature-dev',
      marketplace: 'claude-plugins-official',
      installPath: '/home/.claude/plugins/cache/claude-plugins-official/feature-dev/unknown',
      version: 'unknown',
      scope: 'user',
    });
    expect(descriptors).toHaveLength(2);
  });

  it('skips installs whose plugin name is not a valid PluginId', async () => {
    const fs = new InMemoryFileSystem();
    fs.createFile(
      REGISTRY,
      JSON.stringify({
        version: 2,
        plugins: {
          'Bad_Name@mp': [{ scope: 'user', installPath: '/x', version: '1' }],
        },
      }),
    );
    expect(await reader(fs).list()).toEqual([]);
  });

  it('skips installs with a non-user scope', async () => {
    const fs = new InMemoryFileSystem();
    fs.createFile(
      REGISTRY,
      JSON.stringify({
        version: 2,
        plugins: {
          'feature-dev@mp': [{ scope: 'project', installPath: '/x', version: '1' }],
        },
      }),
    );
    expect(await reader(fs).list()).toEqual([]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/main/infrastructure/plugins/claude-code-plugin-reader.test.ts`
Expected: FAIL — module `claude-code-plugin-reader.js` not found.

- [ ] **Step 4: Write the adapter**

Create `src/main/infrastructure/plugins/claude-code-plugin-reader.ts`:

```typescript
import { z } from 'zod';
import type { FileSystemPort } from '../../application/ports/filesystem-port.js';
import type {
  ClaudeCodePluginDescriptor,
  ClaudeCodePluginRegistryPort,
} from '../../application/ports/claude-code-plugin-registry-port.js';
import { tryPluginId } from '../../domain/plugin-id.js';

const installSchema = z
  .object({
    scope: z.string(),
    installPath: z.string().min(1),
    version: z.string().optional(),
  })
  .passthrough();

const registrySchema = z
  .object({
    plugins: z.record(z.string(), z.array(installSchema)),
  })
  .passthrough();

/**
 * Reads Claude Code's `installed_plugins.json` registry and returns one
 * descriptor per `scope: "user"` install. Never throws on a missing or corrupt
 * registry — both yield an empty list so the entity lists never break.
 */
export class ClaudeCodePluginReader implements ClaudeCodePluginRegistryPort {
  constructor(
    private readonly deps: {
      registryPath: string;
      fs: Pick<FileSystemPort, 'readFile'>;
    },
  ) {}

  async list(): Promise<ClaudeCodePluginDescriptor[]> {
    let raw: string;
    try {
      raw = await this.deps.fs.readFile(this.deps.registryPath);
    } catch {
      return []; // Missing file — Claude Code not installed / no plugins.
    }

    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      console.warn('[ClaudeCodePluginReader] installed_plugins.json is not valid JSON; ignoring');
      return [];
    }

    const parsed = registrySchema.safeParse(json);
    if (!parsed.success) {
      console.warn('[ClaudeCodePluginReader] installed_plugins.json has an unexpected shape; ignoring');
      return [];
    }

    const out: ClaudeCodePluginDescriptor[] = [];
    for (const [key, installs] of Object.entries(parsed.data.plugins)) {
      const at = key.lastIndexOf('@');
      if (at <= 0) continue; // No "<plugin>@<marketplace>" separator.
      const name = key.slice(0, at);
      const marketplace = key.slice(at + 1);
      const idResult = tryPluginId(name);
      if (!idResult.ok) continue; // Plugin name is not a valid PluginId.

      for (const install of installs) {
        if (install.scope !== 'user') continue;
        out.push({
          pluginId: idResult.value,
          marketplace,
          installPath: install.installPath,
          version: install.version ?? 'unknown',
          scope: 'user',
        });
      }
    }
    return out;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/main/infrastructure/plugins/claude-code-plugin-reader.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/main/application/ports/claude-code-plugin-registry-port.ts \
  src/main/infrastructure/plugins/claude-code-plugin-reader.ts \
  tests/main/infrastructure/plugins/claude-code-plugin-reader.test.ts
git commit -m "feat(plugins): read Claude Code installed_plugins.json registry"
```

---

## Task A3: Generalize PluginProvenanceService to scan plugin roots

This replaces the hard-coded "workspace cache only" scan with a tier-ordered list of **roots** (each a `{ pluginId, dir, provenance }`), so the same enumeration runs over a Claude Code `installPath`. `forScope()` is preserved for the write-blocking path (`assertNotPluginSourced`).

**Files:**
- Modify: `src/main/application/services/plugin-provenance.ts`
- Test: `tests/main/application/services/plugin-provenance.test.ts` (existing — must stay green)

- [ ] **Step 1: Write the failing test**

Append to `tests/main/application/services/plugin-provenance.test.ts`:

```typescript
import type { ClaudeCodePluginRegistryPort } from '../../../../src/main/application/ports/claude-code-plugin-registry-port.js';

describe('PluginProvenanceService.scan — roots', () => {
  it('enumerates a Claude Code installPath and tags claude-code provenance', async () => {
    const cache = new FakePluginCachePort();
    const fs = new InMemoryFileSystem();
    fs.createFile('/cc/feature-dev/agents/code-reviewer.md', agentFile('code-reviewer'));
    fs.createFile('/cc/feature-dev/commands/feature-dev.md', skillFile('feature-dev'));

    const claudeCodeRegistry: ClaudeCodePluginRegistryPort = {
      list: async () => [
        {
          pluginId: pluginId('feature-dev'),
          marketplace: 'claude-plugins-official',
          installPath: '/cc/feature-dev',
          version: 'unknown',
          scope: 'user',
        },
      ],
    };

    const svc = new PluginProvenanceService({ cache, fs, claudeCodeRegistry });
    const refs = await svc.scan('personal');

    expect(refs).toContainEqual({
      type: 'agent',
      name: 'code-reviewer',
      pluginId: 'feature-dev',
      dir: '/cc/feature-dev',
      provenance: 'claude-code',
    });
    expect(refs.find((r) => r.type === 'command')?.provenance).toBe('claude-code');
  });

  it('shadows a claude-code ref when a workspace-managed plugin provides the same type/name', async () => {
    const cache = new FakePluginCachePort();
    const fs = new InMemoryFileSystem();
    const pid = pluginId('p');
    cache.seedMeta('personal', {
      version: 2,
      plugins: [
        { id: 'p', origin: 'imported', installedAt: FROZEN.toISOString(), scope: 'personal', enabled: true },
      ],
    });
    // Workspace-managed dir is `${scope}/plugins/${id}` per FakePluginCachePort.
    fs.createFile('personal/plugins/p/agents/dup.md', agentFile('dup'));
    fs.createFile('/cc/q/agents/dup.md', agentFile('dup'));

    const claudeCodeRegistry: ClaudeCodePluginRegistryPort = {
      list: async () => [
        { pluginId: pluginId('q'), marketplace: 'mp', installPath: '/cc/q', version: '1', scope: 'user' },
      ],
    };

    const svc = new PluginProvenanceService({ cache, fs, claudeCodeRegistry });
    const refs = (await svc.scan('personal')).filter((r) => r.name === 'dup');
    expect(refs).toHaveLength(1);
    expect(refs[0]?.provenance).toBe('workspace-managed');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/main/application/services/plugin-provenance.test.ts`
Expected: FAIL — `scan` is not a function / `PluginEntityRef` not exported.

- [ ] **Step 3: Rewrite `plugin-provenance.ts`**

Replace the entire file `src/main/application/services/plugin-provenance.ts` with:

```typescript
import { join } from 'node:path';
import type { PluginId } from '../../domain/plugin-id.js';
import type { PluginCachePort } from '../ports/plugin-cache-port.js';
import type { FileSystemPort } from '../ports/filesystem-port.js';
import type { Scope } from '../ports/scope.js';
import type { ClaudeCodePluginRegistryPort } from '../ports/claude-code-plugin-registry-port.js';
import type { PluginProvenance } from '../../domain/customization-source.js';

export interface ProvenanceKey {
  type: 'skill' | 'agent' | 'command';
  name: string;
}

export type ProvenanceMap = Map<string, PluginId>;

/** A single plugin-provided entity, resolved to the dir it must be read from. */
export interface PluginEntityRef {
  type: 'skill' | 'agent' | 'command';
  name: string;
  pluginId: PluginId;
  dir: string;
  provenance: PluginProvenance;
}

interface PluginRoot {
  pluginId: PluginId;
  dir: string;
  provenance: PluginProvenance;
}

export function provenanceKey(key: ProvenanceKey): string {
  return `${key.type}/${key.name}`;
}

export interface PluginProvenanceDeps {
  cache: PluginCachePort;
  fs: FileSystemPort;
  /** Optional: when present, Claude Code plugins are discovered for the personal scope. */
  claudeCodeRegistry?: ClaudeCodePluginRegistryPort;
}

/**
 * Computes plugin provenance by scanning each installed plugin's skills/,
 * agents/ and commands/ across two registries, in tier order:
 *   1. workspace-managed (~/.superset-ai-app/plugins)
 *   2. claude-code       (~/.claude/plugins, personal scope only)
 * A {type/name} present in a higher tier shadows the same key in a lower tier.
 * Plugin-provided customizations are read-only; their lifecycle owns the files.
 */
export class PluginProvenanceService {
  constructor(private readonly deps?: PluginProvenanceDeps) {}

  /** Backward-compatible {type/name} → PluginId map (first/higher tier wins). */
  async forScope(scope: Scope): Promise<ProvenanceMap> {
    const map: ProvenanceMap = new Map();
    for (const ref of await this.scan(scope)) {
      map.set(provenanceKey({ type: ref.type, name: ref.name }), ref.pluginId);
    }
    return map;
  }

  /** Every plugin-provided entity, deduped by {type/name} keeping the higher tier. */
  async scan(scope: Scope): Promise<PluginEntityRef[]> {
    if (!this.deps) return [];
    const out: PluginEntityRef[] = [];
    const seen = new Set<string>();
    for (const root of await this.listRoots(scope)) {
      for (const ref of await this.scanRoot(root)) {
        const k = provenanceKey({ type: ref.type, name: ref.name });
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(ref);
      }
    }
    return out;
  }

  private async listRoots(scope: Scope): Promise<PluginRoot[]> {
    const { cache, claudeCodeRegistry } = this.deps!;
    const roots: PluginRoot[] = [];

    // Tier 1 — workspace-managed plugins.
    try {
      const meta = await cache.readMeta(scope);
      for (const entry of meta.plugins) {
        const pid = entry.id as PluginId;
        roots.push({
          pluginId: pid,
          dir: cache.pluginDir(scope, pid),
          provenance: 'workspace-managed',
        });
      }
    } catch {
      // No workspace meta — skip this tier.
    }

    // Tier 2 — Claude Code plugins (registry scope "user" → app personal).
    if (scope === 'personal' && claudeCodeRegistry) {
      try {
        for (const d of await claudeCodeRegistry.list()) {
          roots.push({ pluginId: d.pluginId, dir: d.installPath, provenance: 'claude-code' });
        }
      } catch {
        // Registry unavailable — skip this tier.
      }
    }

    return roots;
  }

  private async scanRoot(root: PluginRoot): Promise<PluginEntityRef[]> {
    const { fs } = this.deps!;
    const refs: PluginEntityRef[] = [];
    const push = (type: PluginEntityRef['type'], name: string): void => {
      refs.push({ type, name, pluginId: root.pluginId, dir: root.dir, provenance: root.provenance });
    };

    // skills/<name>/ — each entry is a directory holding SKILL.md.
    await scanDir(fs, join(root.dir, 'skills'), (entry) => {
      if (entry.startsWith('.')) return;
      push('skill', entry);
    });
    // agents/<name>.md
    await scanDir(fs, join(root.dir, 'agents'), (entry) => {
      if (entry.startsWith('.') || !entry.endsWith('.md')) return;
      push('agent', entry.replace(/\.md$/, ''));
    });
    // commands/<name>.md
    await scanDir(fs, join(root.dir, 'commands'), (entry) => {
      if (entry.startsWith('.') || !entry.endsWith('.md')) return;
      push('command', entry.replace(/\.md$/, ''));
    });

    return refs;
  }
}

async function scanDir(
  fs: FileSystemPort,
  dir: string,
  onEntry: (entry: string) => void,
): Promise<void> {
  try {
    if (!(await fs.pathExists(dir))) return;
    for (const entry of await fs.readdir(dir)) onEntry(entry);
  } catch {
    // Dir removed since meta was written, or unreadable — skip.
  }
}
```

- [ ] **Step 4: Run the provenance test to verify it passes**

Run: `npx vitest run tests/main/application/services/plugin-provenance.test.ts`
Expected: the new `scan` tests PASS. **Note:** two existing assertions in this file (lines ~189 and ~303, `source: { kind: 'plugin', pluginId: pluginId('p') }`) will now FAIL because the source gained `provenance`. Fix them in Task A5 — leave them red for now and proceed.

- [ ] **Step 5: Commit**

```bash
git add src/main/application/services/plugin-provenance.ts tests/main/application/services/plugin-provenance.test.ts
git commit -m "refactor(plugins): scan plugin roots across workspace + claude-code tiers"
```

---

## Task A4: Collect plugin entities from a ref's dir + provenance

Generalizes `collectPluginEntities` to read each entity from its ref's `dir` (workspace cache **or** Claude Code installPath) and thread provenance into `build`. The three-tier merge in the services then needs **no logic change** — it already filters plugin entities by `workspaceIds`, and `scan()` already deduped wm-before-cc.

**Files:**
- Modify: `src/main/application/services/customization-plugin-helpers.ts`
- Modify: `src/main/application/services/skill-service.ts`
- Modify: `src/main/application/services/agent-service.ts`
- Modify: `src/main/application/services/command-service.ts`
- Test: `tests/main/application/services/claude-code-discovery.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/main/application/services/claude-code-discovery.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { SkillService } from '../../../../src/main/application/services/skill-service.js';
import { CustomizationService } from '../../../../src/main/application/services/customization-service.js';
import { PluginProvenanceService } from '../../../../src/main/application/services/plugin-provenance.js';
import { InMemoryCustomizationRepository } from '../../../../src/main/infrastructure/customization/in-memory-customization-repository.js';
import { InMemoryFileSystem } from '../../../../src/main/infrastructure/filesystem/in-memory-filesystem.js';
import { FixedClock } from '../../../../src/main/infrastructure/clock/fixed-clock.js';
import { FakePluginCachePort } from '../../../../src/main/application/services/__fixtures__/fake-plugin-cache-port.js';
import { pluginId } from '../../../../src/main/domain/plugin-id.js';
import type { AdapterManager } from '../../../../src/main/application/services/adapter-manager.js';
import type { ClaudeCodePluginRegistryPort } from '../../../../src/main/application/ports/claude-code-plugin-registry-port.js';

const FROZEN = new Date('2026-06-07T10:00:00.000Z');

const fakeAdapterManager = () =>
  ({ syncOne: vi.fn().mockResolvedValue([]), syncAll: vi.fn().mockResolvedValue([]) }) as unknown as AdapterManager;

const skillFile = (name: string) =>
  `---\nname: ${name}\ntype: skill\ndescription: cc skill\nscopes:\n  - personal\nversion: 1.0.0\ncreatedAt: ${FROZEN.toISOString()}\nupdatedAt: ${FROZEN.toISOString()}\n---\ncc skill body\n`;

const registry = (installPath: string): ClaudeCodePluginRegistryPort => ({
  list: async () => [
    { pluginId: pluginId('feature-dev'), marketplace: 'mp', installPath, version: '1', scope: 'user' },
  ],
});

const makeSkillService = (fs: InMemoryFileSystem, claudeCodeRegistry: ClaudeCodePluginRegistryPort) => {
  const cache = new FakePluginCachePort();
  const base = new CustomizationService(
    new InMemoryCustomizationRepository(),
    new FixedClock(FROZEN),
    fakeAdapterManager(),
    { validate: () => {} } as never,
  );
  const provenance = new PluginProvenanceService({ cache, fs, claudeCodeRegistry });
  return new SkillService(base, { provenance, cache, fs });
};

describe('SkillService — Claude Code discovery', () => {
  it('lists a Claude Code skill, read-only, tagged claude-code', async () => {
    const fs = new InMemoryFileSystem();
    fs.createFile('/cc/feature-dev/skills/research/SKILL.md', skillFile('research'));
    const skills = makeSkillService(fs, registry('/cc/feature-dev'));

    const listed = await skills.list('personal');
    const research = listed.find((s) => s.id === 'research');
    expect(research?.source).toEqual({
      kind: 'plugin',
      pluginId: 'feature-dev',
      provenance: 'claude-code',
    });
  });
});
```

> Note: confirm `CustomizationService`'s constructor arity against `skill-service` usage in the existing `plugin-provenance.test.ts` (it wires `(repo, clock, adapterManager, schemaValidator)`). Mirror that wiring exactly; if the existing test uses a real `SchemaValidator`, import and use it instead of the `{ validate }` stub.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/main/application/services/claude-code-discovery.test.ts`
Expected: FAIL — currently `collectPluginEntities` reads from `cache.pluginDir`, not the installPath, so the skill is not found.

- [ ] **Step 3: Rewrite `collectPluginEntities`**

In `src/main/application/services/customization-plugin-helpers.ts`, replace the imports + `PluginEntitySpec` + `collectPluginEntities` (keep `assertNotPluginSourced` untouched) with:

```typescript
import { join } from 'node:path';
import type { PluginProvenanceService } from './plugin-provenance.js';
import type { PluginCachePort } from '../ports/plugin-cache-port.js';
import type { FileSystemPort } from '../ports/filesystem-port.js';
import type { Scope } from '../ports/scope.js';
import type { PluginId } from '../../domain/plugin-id.js';
import type { PluginProvenance } from '../../domain/customization-source.js';
import type { ProvenanceKey, PluginEntityRef } from './plugin-provenance.js';
import { parseMarkdown } from '../markdown/frontmatter.js';
import { OperationNotAllowedForOriginError } from '../../domain/plugin-errors.js';
import { provenanceKey } from './plugin-provenance.js';

export interface PluginEntityDeps {
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
    provenance: PluginProvenance;
  }) => TEntity;
}

/**
 * Reads every plugin-provided entity of one type for a scope, across all tiers
 * (workspace-managed + claude-code). Each entity is read from the dir resolved
 * by the provenance scan, so the source registry is transparent here. Files
 * that are unreadable or unparseable are skipped silently.
 */
export async function collectPluginEntities<TEntity>(
  deps: PluginEntityDeps,
  spec: PluginEntitySpec<TEntity>,
  scope: Scope,
): Promise<TEntity[]> {
  const { provenance, fs } = deps;
  const type = spec.keyPrefix.replace(/\/$/, '') as PluginEntityRef['type'];
  const refs = await provenance.scan(scope);
  const out: TEntity[] = [];
  for (const ref of refs) {
    if (ref.type !== type) continue;
    const file = join(ref.dir, spec.relPath(ref.name));
    try {
      const raw = await fs.readFile(file);
      const { frontmatter, body } = parseMarkdown(raw);
      out.push(
        spec.build({
          name: ref.name,
          frontmatter,
          body,
          pluginId: ref.pluginId,
          provenance: ref.provenance,
        }),
      );
    } catch {
      // Plugin entity file unreadable or unparseable — skip silently.
    }
  }
  return out;
}
```

Keep the existing `assertNotPluginSourced` function below, unchanged — it still calls `deps.provenance.forScope(...)`.

- [ ] **Step 4: Thread provenance through the three service build callbacks**

In `src/main/application/services/skill-service.ts`, update the `build` callback inside `collectPluginSkills`:

```typescript
        build: ({ name, frontmatter, body, pluginId, provenance }) => ({
          id: skillId(name),
          frontmatter: frontmatter as SkillFrontmatter,
          source: pluginSource(pluginId, provenance),
          body,
        }),
```

In `src/main/application/services/agent-service.ts`, inside `collectPluginAgents`:

```typescript
        build: ({ name, frontmatter, body, pluginId, provenance }) => ({
          id: agentId(name),
          frontmatter: frontmatter as AgentFrontmatter,
          source: pluginSource(pluginId, provenance),
          body,
        }),
```

In `src/main/application/services/command-service.ts`, inside `collectPluginCommands`:

```typescript
        build: ({ name, frontmatter, body, pluginId, provenance }) => ({
          id: commandId(name),
          frontmatter: {
            ...(frontmatter as Partial<CommandFrontmatter>),
            name,
            type: 'command',
          } as CommandFrontmatter,
          source: pluginSource(pluginId, provenance),
          body,
        }),
```

- [ ] **Step 5: Run the new test to verify it passes**

Run: `npx vitest run tests/main/application/services/claude-code-discovery.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/main/application/services/customization-plugin-helpers.ts \
  src/main/application/services/skill-service.ts \
  src/main/application/services/agent-service.ts \
  src/main/application/services/command-service.ts \
  tests/main/application/services/claude-code-discovery.test.ts
git commit -m "feat(plugins): collect plugin entities from any root with provenance"
```

---

## Task A5: Fix existing source-shape assertions

The provenance marker changed the plugin `source` shape. Update the assertions that pinned the old shape.

**Files:**
- Modify: `tests/main/application/services/plugin-provenance.test.ts`
- Modify: `tests/main/application/services/hook-service.test.ts`

- [ ] **Step 1: Find every stale assertion**

Run: `grep -rn "kind: 'plugin', pluginId" tests/main`
Expected hits: `plugin-provenance.test.ts` (~2), `hook-service.test.ts` (~1). The renderer tests under `tests/renderer` keep the old shape because the renderer field is optional (Task A7) — do **not** touch them here.

- [ ] **Step 2: Update each main-side assertion**

In `tests/main/application/services/plugin-provenance.test.ts`, both occurrences of:

```typescript
          source: { kind: 'plugin', pluginId: pluginId('p') },
```

become:

```typescript
          source: { kind: 'plugin', pluginId: pluginId('p'), provenance: 'workspace-managed' },
```

In `tests/main/application/services/hook-service.test.ts`, line ~193:

```typescript
      expect(listed[0]?.source).toEqual({ kind: 'plugin', pluginId: pid });
```

becomes:

```typescript
      expect(listed[0]?.source).toEqual({
        kind: 'plugin',
        pluginId: pid,
        provenance: 'workspace-managed',
      });
```

- [ ] **Step 3: Run the full node project to confirm green**

Run: `npx vitest --project node run`
Expected: PASS (all node tests). If any other assertion pinned the plugin source shape, fix it the same way (add `provenance: 'workspace-managed'`).

- [ ] **Step 4: Commit**

```bash
git add tests/main/application/services/plugin-provenance.test.ts tests/main/application/services/hook-service.test.ts
git commit -m "test: align plugin source assertions with provenance marker"
```

---

## Task A6: Wire the Claude Code reader into the composition root

**Files:**
- Modify: `src/main/index.ts:108-167`

- [ ] **Step 1: Construct the reader after `pluginCache`**

In `src/main/index.ts`, immediately after the `pluginCache` construction (the `new PluginCacheFile({...})` block ending at line ~117), add:

```typescript
  const claudeCodePluginReader = new ClaudeCodePluginReader({
    registryPath: join(homedir(), '.claude', 'plugins', 'installed_plugins.json'),
    fs: nodeFsAdapter,
  });
```

- [ ] **Step 2: Pass it into the shared provenance service**

Change the `pluginProvenance` construction (line ~164) to:

```typescript
  const pluginProvenance = new PluginProvenanceService({
    cache: pluginCache,
    fs: nodeFsAdapter,
    claudeCodeRegistry: claudeCodePluginReader,
  });
```

All three services (`skill`, `agent`, `command`) already share this `pluginProvenance` instance, so they all gain Claude Code discovery from this single change. `hookService` does **not** use `pluginProvenance` and is unaffected (hooks are the deferred extension — Task A8).

- [ ] **Step 3: Add the import**

Near the other infrastructure imports (around line 26), add:

```typescript
import { ClaudeCodePluginReader } from './infrastructure/plugins/claude-code-plugin-reader.js';
```

- [ ] **Step 4: Verify typecheck + build**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Manual smoke test**

Run: `npm run dev`, open Skills/Agents/Commands. Plugins you installed via Claude Code's `/plugin` (e.g. `feature-dev`, `code-review`) should now appear read-only. (The badge styling lands in A7; for now they appear with the existing plugin badge showing the plugin id.)

- [ ] **Step 6: Commit**

```bash
git add src/main/index.ts
git commit -m "feat(plugins): discover Claude Code plugins in skill/agent/command lists"
```

---

## Task A7: Renderer badge — "via Claude Code"

**INVOKE `/frontend-design:frontend-design` FIRST.** The code below fixes the contract (test IDs, props, provenance plumbing); frontend-design owns the visual treatment (color, label wording, tooltip) of the new variant.

**Files:**
- Modify: `src/renderer/hooks/use-customization-list.ts:9`
- Modify: `src/renderer/components/ds/StatusPill.tsx`
- Modify: `src/renderer/components/PluginOriginBadge.tsx`
- Modify: `src/renderer/components/CustomizationListScreen.tsx:134-151`
- Modify: `src/renderer/components/CustomizationViewDrawer.tsx:22-43`
- Test: `tests/renderer/components/PluginOriginBadge.test.tsx` (new)

- [ ] **Step 1: Extend the renderer source type**

In `src/renderer/hooks/use-customization-list.ts`, change the `source` field (line 9):

```typescript
  source:
    | { kind: 'workspace' }
    | {
        kind: 'plugin';
        pluginId: string;
        provenance?: 'workspace-managed' | 'claude-code';
      };
```

`provenance` is **optional** so existing renderer tests/fixtures that omit it stay valid; the badge defaults to workspace-managed.

- [ ] **Step 2: Write the failing badge test**

Create `tests/renderer/components/PluginOriginBadge.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { PluginOriginBadge } from '../../../src/renderer/components/PluginOriginBadge.js';
import { renderWithTheme } from '../test-utils.js';

describe('<PluginOriginBadge>', () => {
  it('shows the plugin id for a workspace-managed plugin', () => {
    renderWithTheme(<PluginOriginBadge pluginId="superpowers" />);
    expect(screen.getByTestId('plugin-origin-badge-superpowers')).toHaveTextContent('superpowers');
  });

  it('shows "via Claude Code" for a claude-code plugin', () => {
    renderWithTheme(<PluginOriginBadge pluginId="feature-dev" provenance="claude-code" />);
    const badge = screen.getByTestId('plugin-origin-badge-feature-dev');
    expect(badge).toHaveTextContent(/via claude code/i);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/renderer/components/PluginOriginBadge.test.tsx`
Expected: FAIL — `provenance` prop unknown / no "via Claude Code" text.

- [ ] **Step 4: Add the `'claude-code'` StatusPill variant**

In `src/renderer/components/ds/StatusPill.tsx`, add `'claude-code'` to the union (line 3-9):

```typescript
export type StatusPillVariant =
  | 'synced'
  | 'unsynced'
  | 'plugin'
  | 'claude-code'
  | 'error'
  | 'ok'
  | 'warning';
```

and add a case in `color()` (the `switch`) before `case 'error'`:

```typescript
    case 'claude-code':
      return theme.palette.secondary.main;
```

(frontend-design may pick a different token; `secondary.main` is a safe default distinct from `plugin`'s `info.main`.)

- [ ] **Step 5: Render provenance in `PluginOriginBadge`**

Replace `src/renderer/components/PluginOriginBadge.tsx` with:

```typescript
import { Tooltip } from '@mui/material';
import { StatusPill } from './ds/StatusPill.js';

interface PluginOriginBadgeProps {
  pluginId: string;
  provenance?: 'workspace-managed' | 'claude-code';
}

export function PluginOriginBadge({
  pluginId,
  provenance = 'workspace-managed',
}: PluginOriginBadgeProps): React.ReactElement {
  const isClaudeCode = provenance === 'claude-code';
  const label = isClaudeCode ? 'via Claude Code' : pluginId;
  const tooltip = isClaudeCode
    ? `Provided by plugin '${pluginId}' installed in Claude Code (read-only)`
    : `Provided by plugin '${pluginId}' (read-only)`;
  return (
    <Tooltip title={tooltip}>
      <span data-testid={`plugin-origin-badge-${pluginId}`}>
        <StatusPill variant={isClaudeCode ? 'claude-code' : 'plugin'} label={label} />
      </span>
    </Tooltip>
  );
}
```

- [ ] **Step 6: Pass provenance from the two call sites**

In `src/renderer/components/CustomizationListScreen.tsx`, both `<PluginOriginBadge .../>` usages (lines ~137 and ~150) become:

```typescript
              <PluginOriginBadge
                pluginId={item.source.pluginId}
                {...(item.source.provenance ? { provenance: item.source.provenance } : {})}
              />
```

In `src/renderer/components/CustomizationViewDrawer.tsx`, replace the `pluginId` derivation (lines ~23-24) and the badge usage (line ~37):

```typescript
  const pluginSource = entity?.source.kind === 'plugin' ? entity.source : null;
```

```typescript
        pluginSource ? (
          <PluginOriginBadge
            pluginId={pluginSource.pluginId}
            {...(pluginSource.provenance ? { provenance: pluginSource.provenance } : {})}
          />
        ) : undefined
```

and update the read-only notice condition that used `pluginId` (line ~43) to use `pluginSource?.pluginId`:

```typescript
          {pluginSource && <ReadOnlyNotice pluginId={pluginSource.pluginId} />}
```

> The `{...(x ? { provenance: x } : {})}` spread is required by `exactOptionalPropertyTypes` — you cannot pass `provenance={undefined}` to an optional prop.

- [ ] **Step 7: Run the renderer tests**

Run: `npx vitest --project jsdom run tests/renderer/components/PluginOriginBadge.test.tsx tests/renderer/components/CustomizationViewDrawer.test.tsx tests/renderer/screens/skills/SkillList.test.tsx`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/renderer/hooks/use-customization-list.ts \
  src/renderer/components/ds/StatusPill.tsx \
  src/renderer/components/PluginOriginBadge.tsx \
  src/renderer/components/CustomizationListScreen.tsx \
  src/renderer/components/CustomizationViewDrawer.tsx \
  tests/renderer/components/PluginOriginBadge.test.tsx
git commit -m "feat(ui): badge Claude Code plugin entities as 'via Claude Code'"
```

---

## Task A8: (Extension — optional, deferred) Hook discovery from external plugins

Hooks are **out of the v1 core** (spec §3, §Scope). Their discovery path differs from skills/agents/commands and must be confirmed on disk before implementing. Do this task **only** if explicitly requested; otherwise skip — Feature A is complete and shippable after A7.

- [ ] **Step 1: Confirm the on-disk hooks location**

Run: `cat ~/.claude/plugins/cache/*/feature-dev/*/\.claude-plugin/plugin.json 2>/dev/null; find ~/.claude/plugins/cache -maxdepth 4 -name 'hooks*' -o -name 'hooks.json' 2>/dev/null | head`
Determine whether hooks live in `.claude-plugin/plugin.json` (a `hooks` field) or a separate `hooks/` file. Record the finding before writing any code.

- [ ] **Step 2: STOP and write a follow-up spec**

Because the shape is uncertain and `hook-service` does not use `PluginProvenanceService` (it reads from `claudeSettingsFile`), wiring claude-code hook discovery is a separate design. Capture the on-disk finding in `docs/superpowers/specs/` and plan it as its own task rather than forcing it here.

---

## Feature A self-check before opening PR 1

Run the full gate:

```bash
npm run lint && npm run typecheck && npm test
```

Expected: all green. Then open PR 1 (`git`/`gh`), scoped to Feature A only.

---

# FEATURE B — Auto-sync on Diagnostics refresh (PR 2)

> Start this **after** PR 1 is merged, from a fresh branch off `main`.

## Task B1: `useSyncThenRefresh` mutation hook

**Files:**
- Create: `src/renderer/hooks/use-sync-then-refresh.ts`
- Test: `tests/renderer/hooks/use-sync-then-refresh.test.tsx` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/renderer/hooks/use-sync-then-refresh.test.tsx`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { useSyncThenRefresh } from '../../../src/renderer/hooks/use-sync-then-refresh.js';
import { healthQueryKey } from '../../../src/renderer/hooks/use-health-report.js';
import { mockApi, ok, makeTestQueryClient, type CallSpy } from '../test-utils.js';
import type { SyncResult } from '../../../src/shared/customization.js';

let call: CallSpy;

beforeEach(() => {
  call = mockApi();
});

const wrapper = (client = makeTestQueryClient()) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { Wrapper, client };
};

describe('useSyncThenRefresh', () => {
  it('calls adapter.syncAll and returns the SyncResult[]', async () => {
    const results: SyncResult[] = [
      { adapter: 'claude', destination: '/a', status: 'ok' },
      { adapter: 'claude', destination: '/b', status: 'conflict', details: { backupPath: '/b.bak' } },
    ];
    call.mockResolvedValueOnce(ok(results));

    const { Wrapper } = wrapper();
    const { result } = renderHook(() => useSyncThenRefresh('personal'), { wrapper: Wrapper });

    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(call).toHaveBeenCalledWith('adapter.syncAll', {});
    expect(result.current.data).toEqual(results);
  });

  it('invalidates the health query after a successful sync', async () => {
    call.mockResolvedValueOnce(ok([]));
    const { Wrapper, client } = wrapper();
    let invalidated: readonly unknown[] | null = null;
    const original = client.invalidateQueries.bind(client);
    client.invalidateQueries = ((filters: { queryKey: readonly unknown[] }) => {
      invalidated = filters.queryKey;
      return original(filters);
    }) as typeof client.invalidateQueries;

    const { result } = renderHook(() => useSyncThenRefresh('personal'), { wrapper: Wrapper });
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidated).toEqual(healthQueryKey('personal'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/renderer/hooks/use-sync-then-refresh.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the hook**

Create `src/renderer/hooks/use-sync-then-refresh.ts`:

```typescript
import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { callIpc } from '../lib/ipc.js';
import { healthQueryKey, type HealthScope } from './use-health-report.js';
import type { SyncResult } from '../../shared/customization.js';

/**
 * Runs the outbound symlink sync (`adapter.syncAll`) then invalidates the
 * health query so the Diagnostics report reflects the freshly reconciled
 * `~/.claude/`. The sync write is surfaced via the returned `SyncResult[]`
 * (see HealthScreen summary) — never silent.
 */
export function useSyncThenRefresh(
  scope: HealthScope = 'personal',
): UseMutationResult<SyncResult[], unknown, void> {
  const qc = useQueryClient();
  return useMutation<SyncResult[], unknown, void>({
    mutationFn: () => callIpc<SyncResult[]>('adapter.syncAll', {}),
    onSettled: async () => {
      // Refresh even on partial/total failure — the report must reflect reality.
      await qc.invalidateQueries({ queryKey: healthQueryKey(scope) });
    },
  });
}
```

> `onSettled` (not `onSuccess`) implements the spec's "still attempt the refetch" on error. The success test passes because `onSettled` also runs on success.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/renderer/hooks/use-sync-then-refresh.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/hooks/use-sync-then-refresh.ts tests/renderer/hooks/use-sync-then-refresh.test.tsx
git commit -m "feat(health): add sync-then-refresh mutation hook"
```

---

## Task B2: Wire "Atualizar" to sync + render the summary

**INVOKE `/frontend-design:frontend-design` FIRST** for the summary surface. The code below fixes the contract (test IDs, behavior, data flow); frontend-design owns the visual treatment of the summary block.

**Files:**
- Modify: `src/renderer/screens/health/HealthScreen.tsx`
- Test: `tests/renderer/screens/health/HealthScreen.test.tsx`

- [ ] **Step 1: Write the failing tests**

Append to `tests/renderer/screens/health/HealthScreen.test.tsx`:

```typescript
import type { SyncResult } from '../../../../src/shared/customization.js';

describe('<HealthScreen> sync-on-refresh', () => {
  it('does not call adapter.syncAll on initial mount', async () => {
    call.mockResolvedValue(ok(reportWith([])));
    renderWithQuery(<HealthScreen />);
    await screen.findByTestId('health-screen');
    expect(call).not.toHaveBeenCalledWith('adapter.syncAll', expect.anything());
  });

  it('runs adapter.syncAll then refetches the report when Atualizar is clicked', async () => {
    const sync: SyncResult[] = [{ adapter: 'claude', destination: '/a', status: 'ok' }];
    call.mockImplementation((method: string) => {
      if (method === 'adapter.syncAll') return Promise.resolve(ok(sync));
      return Promise.resolve(ok(reportWith([])));
    });

    renderWithQuery(<HealthScreen />);
    await screen.findByTestId('health-screen');

    call.mockClear();
    await userEvent.click(screen.getByTestId('health-refresh'));

    await waitFor(() => expect(call).toHaveBeenCalledWith('adapter.syncAll', {}));
    expect(call).toHaveBeenCalledWith('health.getReport', { scope: 'personal' });
  });

  it('renders a summary of the SyncResult[] after sync', async () => {
    const sync: SyncResult[] = [
      { adapter: 'claude', destination: '/a', status: 'ok' },
      { adapter: 'claude', destination: '/b', status: 'conflict', details: { backupPath: '/b.bak' } },
      { adapter: 'claude', destination: '/c', status: 'error', message: 'boom' },
    ];
    call.mockImplementation((method: string) => {
      if (method === 'adapter.syncAll') return Promise.resolve(ok(sync));
      return Promise.resolve(ok(reportWith([])));
    });

    renderWithQuery(<HealthScreen />);
    await screen.findByTestId('health-screen');
    await userEvent.click(screen.getByTestId('health-refresh'));

    const summary = await screen.findByTestId('health-sync-summary');
    expect(summary).toHaveTextContent(/1.*ok/i);
    expect(summary).toHaveTextContent(/1.*conflict/i);
    expect(summary).toHaveTextContent(/1.*error/i);
  });
});
```

Add `waitFor` to the existing testing-library import at the top of the file:

```typescript
import { screen, waitFor } from '@testing-library/react';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/renderer/screens/health/HealthScreen.test.tsx`
Expected: FAIL — button still calls `refetch()` only; no `health-sync-summary`.

- [ ] **Step 3: Wire the mutation into HealthScreen**

In `src/renderer/screens/health/HealthScreen.tsx`:

Add imports near the top:

```typescript
import { useSyncThenRefresh } from '../../hooks/use-sync-then-refresh.js';
import type { SyncResult } from '../../../shared/customization.js';
```

Inside the component, after the `useHealthReport` line, add:

```typescript
  const sync = useSyncThenRefresh('personal');
```

Replace the "Atualizar" button's `disabled`/`onClick` with:

```typescript
            disabled={isFetching || sync.isPending}
            onClick={() => sync.mutate()}
```

Add a summary block immediately **after** the `<ScreenHeader .../>` closing tag (before the `isLoading` block):

```typescript
      {sync.data && <SyncSummary results={sync.data} />}
```

Add the `SyncSummary` component at the bottom of the file (frontend-design refines its look; keep the `data-testid` and the three counts):

```typescript
function SyncSummary({ results }: { results: SyncResult[] }): React.ReactElement {
  const okCount = results.filter((r) => r.status === 'ok').length;
  const conflicts = results.filter((r) => r.status === 'conflict').length;
  const errors = results.filter((r) => r.status === 'error').length;
  return (
    <Box
      data-testid="health-sync-summary"
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        p: 1.5,
        mb: 3,
        display: 'flex',
        gap: 2,
        alignItems: 'center',
      }}
    >
      <Typography variant="body2">
        Sincronização concluída: <strong>{okCount}</strong> ok
        {conflicts > 0 && (
          <>
            {' · '}
            <strong>{conflicts}</strong> conflito(s) com backup
          </>
        )}
        {errors > 0 && (
          <>
            {' · '}
            <strong>{errors}</strong> erro(s)
          </>
        )}
      </Typography>
    </Box>
  );
}
```

- [ ] **Step 4: Run the HealthScreen tests to verify they pass**

Run: `npx vitest run tests/renderer/screens/health/HealthScreen.test.tsx`
Expected: PASS (including the pre-existing "refetches when Refresh is clicked" test — it asserts `health.getReport` is called, which still holds because `onSettled` invalidates the health query).

> If the old test `refetches when Refresh is clicked` now fails because it expected **only** `health.getReport`, update it to also expect `adapter.syncAll` (the click now syncs first). Mirror the new test's `call.mockImplementation` branch so `adapter.syncAll` resolves.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/screens/health/HealthScreen.tsx tests/renderer/screens/health/HealthScreen.test.tsx
git commit -m "feat(health): sync symlinks on Atualizar and surface a summary"
```

---

## Feature B self-check before opening PR 2

```bash
npm run lint && npm run typecheck && npm test
```

Expected: all green. Open PR 2, scoped to Feature B only.

---

## Plan self-review (author's notes)

- **Spec coverage:** Feature A §Architecture(1) → A2; (2) "parameterized root" → A3/A4; (3) provenance marker → A1 + A7; (4) three-tier dedup → A3 (`scan` dedup) + A4 (service filter). Error handling (missing/corrupt registry, missing installPath, unparseable file) → A2 tests + A3 `scanDir`/A4 `try/catch`. Scope mapping user→personal → A3 `listRoots`. Hooks extension → A8 (deferred, as the spec marks it). Feature B behavior/transparency/error-handling/testing → B1 + B2.
- **Type consistency:** `PluginEntityRef`, `PluginProvenance`, `pluginSource(pluginId, provenance)`, `collectPluginEntities` `build` args (`+provenance`), and the renderer optional `provenance` are used identically across all tasks.
- **Known cross-cutting break handled explicitly:** the `source` shape change is absorbed by the default param (A1), the main-side assertion fixes (A5), and the optional renderer field (A7). The two `pluginSource` symbols (`customization-source.ts` vs `plugin-source.ts`) are kept distinct — only the former is touched.
- **Risk / trade-off:** generalizing the scanner (A3) is the riskiest change; it is gated by the existing `plugin-provenance.test.ts` staying green plus the new root tests. The alternative (a parallel claude-code-only collection path) was rejected because it duplicates the skills/agents/commands enumeration the spec explicitly says to reuse.
