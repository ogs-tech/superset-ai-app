# MCP Library Entity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `mcp` entity to the library that adopts the user's existing MCP servers from their real Claude config files, lets the user create/edit/remove/enable/disable the servers they own, shows plugin-provided servers read-only, and surfaces each server's health inline.

**Architecture:** "Live-config broker" — no workspace source-of-truth copy. The app reads/writes the real files (`~/.claude.json` top-level `mcpServers`, `~/.claude.json` `projects[path].mcpServers`, `<repo>/.mcp.json`) and reads plugin `.mcp.json` files read-only. Writes are surgical (mutate only the targeted key), atomic (tmp+rename), backed up, and fail-safe. Health is joined from the existing read-only `ClaudeRuntimePort`.

**Tech Stack:** TypeScript (strict, ESM, `.js` import extensions), zod, Electron IPC (`ipc:call` envelope), React + MUI + react-query, Vitest (node + jsdom projects).

**Spec:** `docs/superpowers/specs/2026-06-07-mcp-entity-design.md`

**Conventions to respect (verified against the codebase):**
- Imports use `.js` extensions even for `.ts` sources.
- Strict TS: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. Build optional props with `...(x !== undefined ? { x } : {})`.
- Domain errors extend `DomainError(kind, message, details)`; the dispatcher maps `kind` verbatim.
- Infra writes mirror `src/main/infrastructure/settings/claude-settings-file.ts`: `proper-lockfile` lock → read raw → `.bak` backup → write `.tmp` → `rename`.
- Infra fs tests use `mkdtemp(os.tmpdir())` + `rm(..., { recursive: true, force: true })` (see `tests/main/infrastructure/settings/claude-settings-file.test.ts`).
- Run a single test file: `npx vitest run <path>`. Lint: `npm run lint`. Typecheck: `npm run typecheck`.

**Phasing (each phase ends green and shippable):**
- **Phase 1 — Read/adopt:** domain + schema + port + config-store READ + plugin reader + service `list` with health + IPC `mcp.list`/`mcp.get` + read-only renderer list. Ships a read-only MCP browser.
- **Phase 2 — Write CRUD:** config-store `upsert`/`remove` (safety) + service `save`/`delete` + IPC + editor UI.
- **Phase 3 — Enable/disable:** disabled stash + disabled-list + service `setEnabled` + IPC + toggle UI.

---

## PHASE 1 — Read / adopt

### Task 1: Domain — `McpLocation`

**Files:**
- Create: `src/main/domain/mcp-location.ts`
- Test: `tests/main/domain/mcp-location.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/main/domain/mcp-location.test.ts
import { describe, it, expect } from 'vitest';
import {
  type McpLocation,
  locationScope,
  locationRepoPath,
} from '../../../src/main/domain/mcp-location.js';

describe('McpLocation', () => {
  it('maps each kind to its scope tag', () => {
    expect(locationScope({ kind: 'global' })).toBe('global');
    expect(locationScope({ kind: 'project-local', repoPath: '/r' })).toBe('project-local');
    expect(locationScope({ kind: 'project-shared', repoPath: '/r' })).toBe('project-shared');
    expect(locationScope({ kind: 'plugin', pluginId: 'p', pluginDir: '/d' })).toBe('plugin');
  });

  it('extracts repoPath only for project kinds', () => {
    expect(locationRepoPath({ kind: 'global' })).toBeUndefined();
    expect(locationRepoPath({ kind: 'project-local', repoPath: '/r' })).toBe('/r');
    expect(locationRepoPath({ kind: 'project-shared', repoPath: '/r' })).toBe('/r');
  });

  it('satisfies the union exhaustively (compile + runtime)', () => {
    const all: McpLocation[] = [
      { kind: 'global' },
      { kind: 'project-local', repoPath: '/r' },
      { kind: 'project-shared', repoPath: '/r' },
      { kind: 'plugin', pluginId: 'p', pluginDir: '/d' },
    ];
    expect(all.map(locationScope)).toEqual(['global', 'project-local', 'project-shared', 'plugin']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/main/domain/mcp-location.test.ts`
Expected: FAIL — cannot find module `mcp-location.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/main/domain/mcp-location.ts

/** Identifies exactly where an MCP server definition physically lives. */
export type McpLocation =
  | { kind: 'global' }
  | { kind: 'project-local'; repoPath: string }
  | { kind: 'project-shared'; repoPath: string }
  | { kind: 'plugin'; pluginId: string; pluginDir: string };

export type McpScope = McpLocation['kind'];

export function locationScope(loc: McpLocation): McpScope {
  return loc.kind;
}

export function locationRepoPath(loc: McpLocation): string | undefined {
  return loc.kind === 'project-local' || loc.kind === 'project-shared'
    ? loc.repoPath
    : undefined;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/main/domain/mcp-location.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/domain/mcp-location.ts tests/main/domain/mcp-location.test.ts
git commit -m "feat(mcp): add McpLocation domain type"
```

---

### Task 2: Domain — `McpServerId` (location + name, round-trippable)

**Files:**
- Create: `src/main/domain/mcp-errors.ts`
- Create: `src/main/domain/mcp-server-id.ts`
- Test: `tests/main/domain/mcp-server-id.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/main/domain/mcp-server-id.test.ts
import { describe, it, expect } from 'vitest';
import { mcpServerId, parseMcpServerId } from '../../../src/main/domain/mcp-server-id.js';
import { McpServerIdInvalidError } from '../../../src/main/domain/mcp-errors.js';

describe('McpServerId', () => {
  it('round-trips every location kind, including plugin names with hyphens', () => {
    const refs = [
      { location: { kind: 'global' as const }, name: 'pencil' },
      { location: { kind: 'project-local' as const, repoPath: '/a/b' }, name: 'clickup' },
      { location: { kind: 'project-shared' as const, repoPath: '/a/b' }, name: 'figma' },
      {
        location: { kind: 'plugin' as const, pluginId: 'serena', pluginDir: '/d' },
        name: 'plugin-serena-serena',
      },
    ];
    for (const ref of refs) {
      expect(parseMcpServerId(mcpServerId(ref))).toEqual(ref);
    }
  });

  it('produces an opaque, url-safe string', () => {
    const id = mcpServerId({ location: { kind: 'global' }, name: 'x' });
    expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('throws McpServerIdInvalidError on garbage', () => {
    expect(() => parseMcpServerId('!!!not-base64!!!')).toThrow(McpServerIdInvalidError);
    expect(() => parseMcpServerId('')).toThrow(McpServerIdInvalidError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/main/domain/mcp-server-id.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/main/domain/mcp-errors.ts
import { DomainError } from './errors.js';

export class McpServerIdInvalidError extends DomainError {
  override readonly name = 'McpServerIdInvalidError';
  constructor(message: string, details?: { raw?: string }) {
    super('validation', message, details);
  }
}
```

```ts
// src/main/domain/mcp-server-id.ts
import type { McpLocation } from './mcp-location.js';
import { McpServerIdInvalidError } from './mcp-errors.js';

export interface McpServerRef {
  location: McpLocation;
  name: string;
}

const KINDS = new Set(['global', 'project-local', 'project-shared', 'plugin']);

export function mcpServerId(ref: McpServerRef): string {
  return Buffer.from(JSON.stringify(ref), 'utf8').toString('base64url');
}

export function parseMcpServerId(id: string): McpServerRef {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(id, 'base64url').toString('utf8'));
  } catch {
    throw new McpServerIdInvalidError(`Invalid MCP server id: '${id}'`, { raw: id });
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as { name?: unknown }).name !== 'string' ||
    typeof (parsed as { location?: unknown }).location !== 'object' ||
    (parsed as { location: { kind?: unknown } }).location === null ||
    !KINDS.has(String((parsed as { location: { kind?: unknown } }).location.kind))
  ) {
    throw new McpServerIdInvalidError(`Invalid MCP server id payload: '${id}'`, { raw: id });
  }
  return parsed as McpServerRef;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/main/domain/mcp-server-id.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/domain/mcp-errors.ts src/main/domain/mcp-server-id.ts tests/main/domain/mcp-server-id.test.ts
git commit -m "feat(mcp): add McpServerId (location+name, round-trippable)"
```

---

### Task 3: Schema — transport-discriminated server def

**Files:**
- Create: `src/main/application/schemas/mcp.ts`
- Test: `tests/main/application/schemas/mcp.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/main/application/schemas/mcp.test.ts
import { describe, it, expect } from 'vitest';
import { mcpServerDefSchema, transportOf } from '../../../../src/main/application/schemas/mcp.js';

describe('mcpServerDefSchema', () => {
  it('accepts a stdio server and reports transport stdio', () => {
    const def = { command: 'npx', args: ['-y', 'x'], env: { A: '1' } };
    const parsed = mcpServerDefSchema.parse(def);
    expect(transportOf(parsed)).toBe('stdio');
  });

  it('accepts http and sse servers', () => {
    expect(transportOf(mcpServerDefSchema.parse({ type: 'http', url: 'https://x.dev' }))).toBe('http');
    expect(transportOf(mcpServerDefSchema.parse({ type: 'sse', url: 'https://x.dev' }))).toBe('sse');
  });

  it('preserves unknown fields (passthrough)', () => {
    const parsed = mcpServerDefSchema.parse({ command: 'x', timeout: 30000, foo: 'bar' }) as Record<string, unknown>;
    expect(parsed['timeout']).toBe(30000);
    expect(parsed['foo']).toBe('bar');
  });

  it('rejects a def with neither command nor url', () => {
    expect(() => mcpServerDefSchema.parse({ type: 'stdio' })).toThrow();
    expect(() => mcpServerDefSchema.parse({})).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/main/application/schemas/mcp.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/main/application/schemas/mcp.ts
import { z } from 'zod';

const stdioServerSchema = z
  .object({
    command: z.string().min(1),
    args: z.array(z.string()).optional(),
    env: z.record(z.string()).optional(),
    type: z.literal('stdio').optional(),
  })
  .passthrough();

const httpServerSchema = z
  .object({
    type: z.literal('http'),
    url: z.string().url(),
    headers: z.record(z.string()).optional(),
  })
  .passthrough();

const sseServerSchema = z
  .object({
    type: z.literal('sse'),
    url: z.string().url(),
    headers: z.record(z.string()).optional(),
  })
  .passthrough();

// Order matters: stdio requires `command`, so an http/sse object (no command)
// falls through to the url-based variants.
export const mcpServerDefSchema = z.union([stdioServerSchema, httpServerSchema, sseServerSchema]);

export type McpServerDef = z.infer<typeof mcpServerDefSchema>;

export type McpTransport = 'stdio' | 'http' | 'sse';

export function transportOf(def: McpServerDef): McpTransport {
  const type = (def as { type?: unknown }).type;
  if (type === 'http' || type === 'sse') return type;
  return 'stdio';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/main/application/schemas/mcp.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/application/schemas/mcp.ts tests/main/application/schemas/mcp.test.ts
git commit -m "feat(mcp): add transport-discriminated server def schema"
```

---

### Task 4: Shared DTO (`src/shared/mcp.ts`)

**Files:**
- Create: `src/shared/mcp.ts`
- Test: `tests/shared/mcp.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/shared/mcp.test.ts
import { describe, it, expect } from 'vitest';
import { isPluginMcp, type McpServer } from '../../src/shared/mcp.js';

const base: McpServer = {
  id: 'abc',
  name: 'pencil',
  transport: 'stdio',
  def: { command: 'x' },
  scope: 'global',
  source: { kind: 'workspace' },
  enabled: true,
};

describe('shared/mcp', () => {
  it('isPluginMcp is true only for plugin source', () => {
    expect(isPluginMcp(base)).toBe(false);
    expect(
      isPluginMcp({
        ...base,
        scope: 'plugin',
        source: { kind: 'plugin', pluginId: 'serena', provenance: 'claude-code' },
      }),
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/shared/mcp.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/shared/mcp.ts

export type McpTransport = 'stdio' | 'http' | 'sse';
export type McpScope = 'global' | 'project-local' | 'project-shared' | 'plugin';
export type McpHealthState = 'ok' | 'warning' | 'error' | 'needs-auth';

export interface McpHealth {
  state: McpHealthState;
  detail?: string;
}

export type McpProvenance =
  | { kind: 'workspace' }
  | { kind: 'plugin'; pluginId: string; provenance: 'workspace-managed' | 'claude-code' };

/** A server as shown in the renderer. `def` is the raw, passthrough-preserved definition. */
export interface McpServer {
  id: string;
  name: string;
  transport: McpTransport;
  def: Record<string, unknown>;
  scope: McpScope;
  repoPath?: string;
  source: McpProvenance;
  enabled: boolean;
  health?: McpHealth;
}

/** Payload sent from the renderer to create/update a server (never plugin). */
export interface McpServerInput {
  id?: string;
  name: string;
  scope: 'global' | 'project-local' | 'project-shared';
  repoPath?: string;
  def: Record<string, unknown>;
}

export function isPluginMcp(server: McpServer): boolean {
  return server.source.kind === 'plugin';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/shared/mcp.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/mcp.ts tests/shared/mcp.test.ts
git commit -m "feat(mcp): add shared McpServer DTO"
```

---

### Task 5: Port — `McpConfigPort`

**Files:**
- Create: `src/main/application/ports/mcp-config-port.ts`

(No test — pure interface, exercised by the store and service tests.)

- [ ] **Step 1: Write the interface**

```ts
// src/main/application/ports/mcp-config-port.ts
import type { McpLocation } from '../../domain/mcp-location.js';
import type { McpServerDef } from '../schemas/mcp.js';

/** A server read from a real config file, with its physical location. */
export interface RawMcpServer {
  location: McpLocation;
  name: string;
  def: McpServerDef;
  /** False only when the server is parked in the disabled stash / disabled list. */
  enabled: boolean;
}

export interface McpReadOptions {
  /** Linked repo paths whose <repo>/.mcp.json should be read (project-shared). */
  repoPaths: string[];
}

/**
 * Reads and writes MCP servers in the real Claude config files. Reads tolerate
 * missing files. Writes are surgical, atomic, backed up, and fail-safe.
 * Never handles plugin servers (those are read-only; see PluginMcpReader).
 */
export interface McpConfigPort {
  read(options: McpReadOptions): Promise<RawMcpServer[]>;
  upsert(location: McpLocation, name: string, def: McpServerDef): Promise<void>;
  remove(location: McpLocation, name: string): Promise<void>;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/main/application/ports/mcp-config-port.ts
git commit -m "feat(mcp): add McpConfigPort"
```

---

### Task 6: Infra — `FsMcpConfigStore` READ side

**Files:**
- Create: `src/main/infrastructure/mcp/fs-mcp-config-store.ts`
- Test: `tests/main/infrastructure/mcp/fs-mcp-config-store.read.test.ts`

The store mirrors `claude-settings-file.ts` but treats `~/.claude.json` as an opaque object (NO schema parse — it has ~70 keys we must preserve). Reads tolerate missing files.

- [ ] **Step 1: Write the failing test**

```ts
// tests/main/infrastructure/mcp/fs-mcp-config-store.read.test.ts
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FsMcpConfigStore } from '../../../../src/main/infrastructure/mcp/fs-mcp-config-store.js';

describe('FsMcpConfigStore.read', () => {
  let tmp: string;
  let claudeJsonPath: string;

  beforeEach(async () => {
    tmp = await mkdtemp(path.join(os.tmpdir(), 'mcp-store-read-'));
    claudeJsonPath = path.join(tmp, '.claude.json');
  });
  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it('returns [] when ~/.claude.json is missing', async () => {
    const store = new FsMcpConfigStore({ claudeJsonPath });
    expect(await store.read({ repoPaths: [] })).toEqual([]);
  });

  it('reads global + project-local servers and a repo .mcp.json (project-shared)', async () => {
    const repoPath = path.join(tmp, 'repo');
    await mkdir(repoPath, { recursive: true });
    await writeFile(
      claudeJsonPath,
      JSON.stringify({
        numStartups: 7,
        mcpServers: { pencil: { command: 'pencil-mcp' } },
        projects: {
          [repoPath]: { mcpServers: { clickup: { type: 'http', url: 'https://c.dev' } } },
        },
      }),
      'utf8',
    );
    await writeFile(
      path.join(repoPath, '.mcp.json'),
      JSON.stringify({ mcpServers: { figma: { type: 'sse', url: 'https://f.dev' } } }),
      'utf8',
    );

    const store = new FsMcpConfigStore({ claudeJsonPath });
    const servers = await store.read({ repoPaths: [repoPath] });

    const byName = Object.fromEntries(servers.map((s) => [s.name, s]));
    expect(byName['pencil']?.location).toEqual({ kind: 'global' });
    expect(byName['clickup']?.location).toEqual({ kind: 'project-local', repoPath });
    expect(byName['figma']?.location).toEqual({ kind: 'project-shared', repoPath });
    expect(servers.every((s) => s.enabled)).toBe(true);
  });

  it('skips malformed server defs without throwing', async () => {
    await writeFile(
      claudeJsonPath,
      JSON.stringify({ mcpServers: { good: { command: 'x' }, bad: { nope: true } } }),
      'utf8',
    );
    const store = new FsMcpConfigStore({ claudeJsonPath });
    const servers = await store.read({ repoPaths: [] });
    expect(servers.map((s) => s.name)).toEqual(['good']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/main/infrastructure/mcp/fs-mcp-config-store.read.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation (read side only)**

```ts
// src/main/infrastructure/mcp/fs-mcp-config-store.ts
import fs from 'node:fs/promises';
import path from 'node:path';
import type { McpConfigPort, McpReadOptions, RawMcpServer } from '../../application/ports/mcp-config-port.js';
import type { McpLocation } from '../../domain/mcp-location.js';
import { mcpServerDefSchema, type McpServerDef } from '../../application/schemas/mcp.js';

export interface FsMcpConfigStorePaths {
  claudeJsonPath: string;
}

interface ClaudeJsonShape {
  mcpServers?: Record<string, unknown>;
  projects?: Record<string, { mcpServers?: Record<string, unknown> } | undefined>;
}

function parseDef(raw: unknown): McpServerDef | undefined {
  const result = mcpServerDefSchema.safeParse(raw);
  return result.success ? result.data : undefined;
}

export class FsMcpConfigStore implements McpConfigPort {
  constructor(private readonly paths: FsMcpConfigStorePaths) {}

  async read(options: McpReadOptions): Promise<RawMcpServer[]> {
    const out: RawMcpServer[] = [];
    const root = await this.readClaudeJson();

    for (const [name, raw] of Object.entries(root.mcpServers ?? {})) {
      const def = parseDef(raw);
      if (def) out.push({ location: { kind: 'global' }, name, def, enabled: true });
    }

    for (const [repoPath, block] of Object.entries(root.projects ?? {})) {
      for (const [name, raw] of Object.entries(block?.mcpServers ?? {})) {
        const def = parseDef(raw);
        if (def) {
          out.push({ location: { kind: 'project-local', repoPath }, name, def, enabled: true });
        }
      }
    }

    for (const repoPath of options.repoPaths) {
      const shared = await this.readMcpJson(path.join(repoPath, '.mcp.json'));
      for (const [name, raw] of Object.entries(shared)) {
        const def = parseDef(raw);
        if (def) {
          out.push({ location: { kind: 'project-shared', repoPath }, name, def, enabled: true });
        }
      }
    }

    return out;
  }

  async upsert(_location: McpLocation, _name: string, _def: McpServerDef): Promise<void> {
    throw new Error('not implemented (Phase 2)');
  }

  async remove(_location: McpLocation, _name: string): Promise<void> {
    throw new Error('not implemented (Phase 2)');
  }

  private async readClaudeJson(): Promise<ClaudeJsonShape> {
    const raw = await fs.readFile(this.paths.claudeJsonPath, 'utf8').catch((err: unknown) => {
      if (isNotFound(err)) return undefined;
      throw err;
    });
    if (raw === undefined) return {};
    return JSON.parse(raw) as ClaudeJsonShape;
  }

  private async readMcpJson(file: string): Promise<Record<string, unknown>> {
    const raw = await fs.readFile(file, 'utf8').catch((err: unknown) => {
      if (isNotFound(err)) return undefined;
      throw err;
    });
    if (raw === undefined) return {};
    const json = JSON.parse(raw) as { mcpServers?: Record<string, unknown> };
    return json.mcpServers ?? {};
  }
}

function isNotFound(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 'ENOENT'
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/main/infrastructure/mcp/fs-mcp-config-store.read.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/infrastructure/mcp/fs-mcp-config-store.ts tests/main/infrastructure/mcp/fs-mcp-config-store.read.test.ts
git commit -m "feat(mcp): FsMcpConfigStore read side (global + project-local + project-shared)"
```

---

### Task 7: Expose plugin roots from `PluginProvenanceService`

**Files:**
- Modify: `src/main/application/services/plugin-provenance.ts`
- Test: `tests/main/application/services/plugin-provenance.roots.test.ts`

We need plugin install dirs to read their `.mcp.json`. `PluginProvenanceService` already computes them privately in `listRoots`. Expose them.

- [ ] **Step 1: Write the failing test**

```ts
// tests/main/application/services/plugin-provenance.roots.test.ts
import { describe, it, expect } from 'vitest';
import { PluginProvenanceService } from '../../../../src/main/application/services/plugin-provenance.js';

describe('PluginProvenanceService.roots', () => {
  it('returns [] when no deps are configured', async () => {
    const svc = new PluginProvenanceService();
    expect(await svc.roots('personal')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/main/application/services/plugin-provenance.roots.test.ts`
Expected: FAIL — `roots` is not a function.

- [ ] **Step 3: Implement — export the type and add the method**

In `src/main/application/services/plugin-provenance.ts`, change the `PluginRoot` interface declaration from `interface PluginRoot {` to `export interface PluginRoot {` (around line 26), and add this public method inside the class (e.g. right after `scan`):

```ts
  /** Every installed plugin's root dir for a scope (workspace-managed + claude-code). */
  async roots(scope: Scope): Promise<PluginRoot[]> {
    if (!this.deps) return [];
    return this.listRoots(scope);
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/main/application/services/plugin-provenance.roots.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/application/services/plugin-provenance.ts tests/main/application/services/plugin-provenance.roots.test.ts
git commit -m "feat(mcp): expose plugin roots from PluginProvenanceService"
```

---

### Task 8: Infra — `PluginMcpReader` (read-only plugin servers)

**Files:**
- Create: `src/main/infrastructure/mcp/plugin-mcp-reader.ts`
- Test: `tests/main/infrastructure/mcp/plugin-mcp-reader.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/main/infrastructure/mcp/plugin-mcp-reader.test.ts
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PluginMcpReader } from '../../../../src/main/infrastructure/mcp/plugin-mcp-reader.js';
import type { PluginRoot } from '../../../../src/main/application/services/plugin-provenance.js';

describe('PluginMcpReader', () => {
  let tmp: string;
  beforeEach(async () => {
    tmp = await mkdtemp(path.join(os.tmpdir(), 'plugin-mcp-reader-'));
  });
  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it('reads each plugin .mcp.json into read-only servers', async () => {
    const dir = path.join(tmp, 'serena');
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, '.mcp.json'),
      JSON.stringify({ mcpServers: { serena: { command: 'serena-mcp' } } }),
      'utf8',
    );
    const roots: PluginRoot[] = [{ pluginId: 'serena' as never, dir, provenance: 'claude-code' }];

    const reader = new PluginMcpReader({ listRoots: async () => roots });
    const servers = await reader.read('personal');

    expect(servers).toHaveLength(1);
    expect(servers[0]?.name).toBe('serena');
    expect(servers[0]?.location).toEqual({ kind: 'plugin', pluginId: 'serena', pluginDir: dir });
    expect(servers[0]?.provenance).toBe('claude-code');
  });

  it('skips plugins without a .mcp.json', async () => {
    const dir = path.join(tmp, 'noop');
    await mkdir(dir, { recursive: true });
    const reader = new PluginMcpReader({
      listRoots: async () => [{ pluginId: 'noop' as never, dir, provenance: 'workspace-managed' }],
    });
    expect(await reader.read('personal')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/main/infrastructure/mcp/plugin-mcp-reader.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/main/infrastructure/mcp/plugin-mcp-reader.ts
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Scope } from '../../application/ports/scope.js';
import type { PluginRoot } from '../../application/services/plugin-provenance.js';
import type { PluginProvenance } from '../../domain/customization-source.js';
import { mcpServerDefSchema, type McpServerDef } from '../../application/schemas/mcp.js';

export interface PluginMcpServer {
  location: { kind: 'plugin'; pluginId: string; pluginDir: string };
  name: string;
  def: McpServerDef;
  pluginId: string;
  provenance: PluginProvenance;
}

export interface PluginMcpReaderDeps {
  listRoots: (scope: Scope) => Promise<PluginRoot[]>;
}

export class PluginMcpReader {
  constructor(private readonly deps: PluginMcpReaderDeps) {}

  async read(scope: Scope): Promise<PluginMcpServer[]> {
    const out: PluginMcpServer[] = [];
    for (const root of await this.deps.listRoots(scope)) {
      const file = path.join(root.dir, '.mcp.json');
      let raw: string;
      try {
        raw = await fs.readFile(file, 'utf8');
      } catch {
        continue; // no .mcp.json for this plugin
      }
      let servers: Record<string, unknown>;
      try {
        servers = (JSON.parse(raw) as { mcpServers?: Record<string, unknown> }).mcpServers ?? {};
      } catch {
        continue; // malformed plugin file — skip whole plugin
      }
      for (const [name, def] of Object.entries(servers)) {
        const parsed = mcpServerDefSchema.safeParse(def);
        if (!parsed.success) continue;
        out.push({
          location: { kind: 'plugin', pluginId: String(root.pluginId), pluginDir: root.dir },
          name,
          def: parsed.data,
          pluginId: String(root.pluginId),
          provenance: root.provenance,
        });
      }
    }
    return out;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/main/infrastructure/mcp/plugin-mcp-reader.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/infrastructure/mcp/plugin-mcp-reader.ts tests/main/infrastructure/mcp/plugin-mcp-reader.test.ts
git commit -m "feat(mcp): add PluginMcpReader (read-only plugin servers)"
```

---

### Task 9: Service — `McpService.list` + `get` with health join

**Files:**
- Create: `src/main/application/services/mcp-service.ts`
- Test: `tests/main/application/services/mcp-service.test.ts`

The service joins config servers + plugin servers, maps to the shared `McpServer` DTO, and attaches health from `ClaudeRuntimePort`. Health name matching: user servers match by plain name; plugin servers match the runtime name `plugin-<pluginId>-<name>` (open item §11.2 — falls back to exact name).

- [ ] **Step 1: Write the failing test**

```ts
// tests/main/application/services/mcp-service.test.ts
import { describe, it, expect } from 'vitest';
import { McpService } from '../../../../src/main/application/services/mcp-service.js';
import type { McpConfigPort, RawMcpServer } from '../../../../src/main/application/ports/mcp-config-port.js';
import type { PluginMcpReader } from '../../../../src/main/infrastructure/mcp/plugin-mcp-reader.js';
import type { ClaudeRuntimePort } from '../../../../src/main/application/ports/claude-runtime-port.js';

function configPort(servers: RawMcpServer[]): McpConfigPort {
  return {
    read: async () => servers,
    upsert: async () => {},
    remove: async () => {},
  };
}

const noRuntime: ClaudeRuntimePort = {
  readMcpServers: async () => [],
  readMcpAuthAlerts: async () => [],
  readMcpRuntimeLogs: async () => [],
};

const noPlugins = { read: async () => [] } as unknown as PluginMcpReader;

describe('McpService.list', () => {
  it('maps a global stdio server to the DTO with transport + workspace source', async () => {
    const svc = new McpService({
      config: configPort([
        { location: { kind: 'global' }, name: 'pencil', def: { command: 'x' }, enabled: true },
      ]),
      plugins: noPlugins,
      runtime: noRuntime,
      linkedRepoPaths: async () => [],
    });

    const [server] = await svc.list();
    expect(server?.name).toBe('pencil');
    expect(server?.transport).toBe('stdio');
    expect(server?.scope).toBe('global');
    expect(server?.source).toEqual({ kind: 'workspace' });
    expect(server?.enabled).toBe(true);
  });

  it('attaches runtime-error health by exact name', async () => {
    const runtime: ClaudeRuntimePort = {
      readMcpServers: async () => [],
      readMcpAuthAlerts: async () => [],
      readMcpRuntimeLogs: async () => [{ server: 'pencil', state: 'error', detail: 'boom' }],
    };
    const svc = new McpService({
      config: configPort([
        { location: { kind: 'global' }, name: 'pencil', def: { command: 'x' }, enabled: true },
      ]),
      plugins: noPlugins,
      runtime,
      linkedRepoPaths: async () => [],
    });
    const [server] = await svc.list();
    expect(server?.health).toEqual({ state: 'error', detail: 'boom' });
  });

  it('marks plugin servers as plugin source and matches plugin runtime health name', async () => {
    const runtime: ClaudeRuntimePort = {
      readMcpServers: async () => [],
      readMcpAuthAlerts: async () => [{ name: 'plugin-serena-serena' }],
      readMcpRuntimeLogs: async () => [],
    };
    const plugins = {
      read: async () => [
        {
          location: { kind: 'plugin' as const, pluginId: 'serena', pluginDir: '/d' },
          name: 'serena',
          def: { command: 'x' },
          pluginId: 'serena',
          provenance: 'claude-code' as const,
        },
      ],
    } as unknown as PluginMcpReader;

    const svc = new McpService({
      config: configPort([]),
      plugins,
      runtime,
      linkedRepoPaths: async () => [],
    });
    const [server] = await svc.list();
    expect(server?.scope).toBe('plugin');
    expect(server?.source).toEqual({ kind: 'plugin', pluginId: 'serena', provenance: 'claude-code' });
    expect(server?.health).toEqual({ state: 'needs-auth' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/main/application/services/mcp-service.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation (`list` + `get`)**

```ts
// src/main/application/services/mcp-service.ts
import type { McpConfigPort, RawMcpServer } from '../ports/mcp-config-port.js';
import type { ClaudeRuntimePort } from '../ports/claude-runtime-port.js';
import type { PluginMcpReader, PluginMcpServer } from '../../infrastructure/mcp/plugin-mcp-reader.js';
import type { McpServer, McpHealth, McpScope } from '../../../shared/mcp.js';
import { transportOf } from '../schemas/mcp.js';
import { mcpServerId, parseMcpServerId, type McpServerRef } from '../../domain/mcp-server-id.js';
import { locationRepoPath } from '../../domain/mcp-location.js';

export interface McpServiceDeps {
  config: McpConfigPort;
  plugins: PluginMcpReader;
  runtime: ClaudeRuntimePort;
  /** Linked repo paths whose .mcp.json should be read. */
  linkedRepoPaths: () => Promise<string[]>;
}

export class McpService {
  constructor(private readonly deps: McpServiceDeps) {}

  async list(): Promise<McpServer[]> {
    const repoPaths = await this.deps.linkedRepoPaths();
    const [config, plugins] = await Promise.all([
      this.deps.config.read({ repoPaths }),
      this.deps.plugins.read('personal'),
    ]);
    const health = await this.buildHealthMap();

    const own = config.map((s) => this.toDto(s, { kind: 'workspace' }, health));
    const fromPlugins = plugins.map((s) => this.pluginToDto(s, health));
    return [...own, ...fromPlugins];
  }

  async get(id: string): Promise<McpServer | undefined> {
    const ref = parseMcpServerId(id);
    return (await this.list()).find((s) => s.id === mcpServerId(ref));
  }

  private toDto(
    raw: RawMcpServer,
    source: McpServer['source'],
    health: Map<string, McpHealth>,
  ): McpServer {
    const ref: McpServerRef = { location: raw.location, name: raw.name };
    const repoPath = locationRepoPath(raw.location);
    const found = health.get(raw.name);
    return {
      id: mcpServerId(ref),
      name: raw.name,
      transport: transportOf(raw.def),
      def: raw.def as Record<string, unknown>,
      scope: raw.location.kind as McpScope,
      ...(repoPath !== undefined ? { repoPath } : {}),
      source,
      enabled: raw.enabled,
      ...(found !== undefined ? { health: found } : {}),
    };
  }

  private pluginToDto(s: PluginMcpServer, health: Map<string, McpHealth>): McpServer {
    const ref: McpServerRef = { location: s.location, name: s.name };
    const runtimeName = `plugin-${s.pluginId}-${s.name}`;
    const found = health.get(runtimeName) ?? health.get(s.name);
    return {
      id: mcpServerId(ref),
      name: s.name,
      transport: transportOf(s.def),
      def: s.def as Record<string, unknown>,
      scope: 'plugin',
      source: { kind: 'plugin', pluginId: s.pluginId, provenance: s.provenance },
      enabled: true,
      ...(found !== undefined ? { health: found } : {}),
    };
  }

  private async buildHealthMap(): Promise<Map<string, McpHealth>> {
    const [logs, alerts] = await Promise.all([
      this.deps.runtime.readMcpRuntimeLogs(),
      this.deps.runtime.readMcpAuthAlerts(),
    ]);
    const map = new Map<string, McpHealth>();
    for (const log of logs) {
      map.set(log.server, {
        state: log.state,
        ...(log.detail !== undefined ? { detail: log.detail } : {}),
      });
    }
    // Auth-needed wins over an otherwise-ok status.
    for (const alert of alerts) map.set(alert.name, { state: 'needs-auth' });
    return map;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/main/application/services/mcp-service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/application/services/mcp-service.ts tests/main/application/services/mcp-service.test.ts
git commit -m "feat(mcp): McpService list/get with health join"
```

---

### Task 10: IPC — `mcp.list` / `mcp.get` handlers + wiring

**Files:**
- Create: `src/main/ipc/mcp-handlers.ts`
- Modify: `src/main/ipc/registry.ts`
- Test: `tests/main/ipc/mcp-handlers.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/main/ipc/mcp-handlers.test.ts
import { describe, it, expect } from 'vitest';
import { buildMcpHandlers } from '../../../src/main/ipc/mcp-handlers.js';
import type { McpService } from '../../../src/main/application/services/mcp-service.js';
import type { McpServer } from '../../../src/shared/mcp.js';

const server: McpServer = {
  id: 'id1',
  name: 'pencil',
  transport: 'stdio',
  def: { command: 'x' },
  scope: 'global',
  source: { kind: 'workspace' },
  enabled: true,
};

function fakeService(overrides: Partial<McpService> = {}): McpService {
  return {
    list: async () => [server],
    get: async () => server,
    ...overrides,
  } as unknown as McpService;
}

describe('mcp handlers', () => {
  it('mcp.list returns the servers', async () => {
    const handlers = buildMcpHandlers(fakeService());
    expect(await handlers['mcp.list']!(undefined)).toEqual([server]);
  });

  it('mcp.get validates id and returns the server', async () => {
    const handlers = buildMcpHandlers(fakeService());
    expect(await handlers['mcp.get']!({ id: 'id1' })).toEqual(server);
  });

  it('mcp.get rejects a missing id', async () => {
    const handlers = buildMcpHandlers(fakeService());
    await expect(handlers['mcp.get']!({})).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/main/ipc/mcp-handlers.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the handlers (list + get only for now)**

```ts
// src/main/ipc/mcp-handlers.ts
import type { IpcHandlers } from './dispatcher.js';
import type { McpService } from '../application/services/mcp-service.js';
import { asObject, asString } from './_validators.js';

export function buildMcpHandlers(service: McpService): IpcHandlers {
  return {
    'mcp.list': async () => service.list(),

    'mcp.get': async (params) => {
      const raw = asObject(params, 'mcp.get');
      return service.get(asString(raw['id'], 'id'));
    },
  };
}
```

- [ ] **Step 4: Wire into the registry**

In `src/main/ipc/registry.ts`:
1. Add import after the other handler imports (near line 26):
```ts
import { buildMcpHandlers } from './mcp-handlers.js';
import type { McpService } from '../application/services/mcp-service.js';
```
2. Add to `IpcDeps` (after `healthService: HealthService;`):
```ts
  mcpService: McpService;
```
3. Add to the destructuring in `buildHandlers` (after `healthService,`):
```ts
    mcpService,
```
4. Add to the returned handlers object (after `...buildHealthHandlers(healthService, notificationPort),`):
```ts
    ...buildMcpHandlers(mcpService),
```

- [ ] **Step 5: Run handler test + typecheck**

Run: `npx vitest run tests/main/ipc/mcp-handlers.test.ts`
Expected: PASS.
Run: `npm run typecheck`
Expected: FAIL — `index.ts` does not yet pass `mcpService` to `buildHandlers` (fixed in Task 11). This is expected; proceed to Task 11 before committing.

- [ ] **Step 6: Commit (after Task 11 makes typecheck green)** — see Task 11.

---

### Task 11: Composition — wire `McpService` in `index.ts`

**Files:**
- Modify: `src/main/index.ts`

- [ ] **Step 1: Add imports** (near the other service imports, e.g. after line 49):

```ts
import { FsMcpConfigStore } from './infrastructure/mcp/fs-mcp-config-store.js';
import { PluginMcpReader } from './infrastructure/mcp/plugin-mcp-reader.js';
import { McpService } from './application/services/mcp-service.js';
```

- [ ] **Step 2: Construct the service** after `claudeRuntimeReader` is created (after line 210):

```ts
  const mcpConfigStore = new FsMcpConfigStore({
    claudeJsonPath: join(homedir(), '.claude.json'),
  });
  const pluginMcpReader = new PluginMcpReader({
    listRoots: (scope) => pluginProvenance.roots(scope),
  });
  const mcpService = new McpService({
    config: mcpConfigStore,
    plugins: pluginMcpReader,
    runtime: claudeRuntimeReader,
    linkedRepoPaths: async () => {
      const settings = await settingsService.load();
      return (settings?.linkedRepos ?? []).map((r) => r.path);
    },
  });
```

- [ ] **Step 3: Pass it to `buildHandlers`** — add `mcpService,` to the object passed to `buildHandlers({ ... })` (after `healthService,`).

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit (Tasks 10 + 11 together)**

```bash
git add src/main/ipc/mcp-handlers.ts src/main/ipc/registry.ts src/main/index.ts tests/main/ipc/mcp-handlers.test.ts
git commit -m "feat(mcp): wire mcp.list/mcp.get IPC + McpService composition"
```

---

### Task 12: Renderer — nav entry + route

**Files:**
- Modify: `src/renderer/components/shell/nav.ts`
- Modify: `src/renderer/screens/Main.tsx`

- [ ] **Step 1: Add MCP to the nav**

In `src/renderer/components/shell/nav.ts`:
1. Add `Plug` to the lucide import list (line 1-4): add `Plug,` to the destructured icons.
2. Extend the union type (line 7):
```ts
export type LibrarySub = 'skills' | 'agents' | 'commands' | 'hooks' | 'global-instructions' | 'mcps';
```
3. Add to `LIBRARY_SUBS` (after the `global-instructions` entry):
```ts
  { sub: 'mcps', label: 'MCP', glyph: Plug },
```

- [ ] **Step 2: Route the screen**

In `src/renderer/screens/Main.tsx`:
1. Add import (after the `GlobalInstructionScreen` import):
```ts
import { McpList } from './mcps/McpList.js';
```
2. Add a case in the `biblioteca` switch (after `global-instructions`):
```ts
        case 'mcps':
          return <McpList />;
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: FAIL — `McpList` not found yet (created in Task 14). Expected; proceed.

(No commit yet — committed with Task 14.)

---

### Task 13: Renderer — `useMcpList` hook

**Files:**
- Create: `src/renderer/hooks/use-mcp-list.ts`
- Test: `tests/renderer/hooks/use-mcp-list.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/renderer/hooks/use-mcp-list.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useMcpList, mcpListQueryKey } from '../../../src/renderer/hooks/use-mcp-list.js';
import type { McpServer } from '../../../src/shared/mcp.js';

const server: McpServer = {
  id: 'id1', name: 'pencil', transport: 'stdio', def: { command: 'x' },
  scope: 'global', source: { kind: 'workspace' }, enabled: true,
};

beforeEach(() => {
  (globalThis as unknown as { window: { api: unknown } }).window = {
    api: { call: vi.fn(async () => ({ ok: true, data: [server] })) },
  } as never;
});

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useMcpList', () => {
  it('has a stable query key', () => {
    expect(mcpListQueryKey()).toEqual(['mcp', 'list']);
  });

  it('fetches the server list', async () => {
    const { result } = renderHook(() => useMcpList(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual([server]));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/renderer/hooks/use-mcp-list.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the hook**

```ts
// src/renderer/hooks/use-mcp-list.ts
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { callIpc } from '../lib/ipc.js';
import type { McpServer } from '../../shared/mcp.js';

export function mcpListQueryKey(): readonly unknown[] {
  return ['mcp', 'list'] as const;
}

export function useMcpList(): UseQueryResult<McpServer[]> {
  return useQuery<McpServer[]>({
    queryKey: mcpListQueryKey(),
    queryFn: () => callIpc<McpServer[]>('mcp.list', {}),
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/renderer/hooks/use-mcp-list.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/hooks/use-mcp-list.ts tests/renderer/hooks/use-mcp-list.test.tsx
git commit -m "feat(mcp): add useMcpList renderer hook"
```

---

### Task 14: Renderer — read-only `McpList` screen

**Files:**
- Create: `src/renderer/screens/mcps/McpList.tsx`
- Test: `tests/renderer/screens/mcps/McpList.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/renderer/screens/mcps/McpList.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { McpList } from '../../../../src/renderer/screens/mcps/McpList.js';
import type { McpServer } from '../../../../src/shared/mcp.js';

const servers: McpServer[] = [
  { id: 'a', name: 'pencil', transport: 'stdio', def: { command: 'x' }, scope: 'global', source: { kind: 'workspace' }, enabled: true,
    health: { state: 'error', detail: 'boom' } },
  { id: 'b', name: 'serena', transport: 'stdio', def: { command: 'x' }, scope: 'plugin',
    source: { kind: 'plugin', pluginId: 'serena', provenance: 'claude-code' }, enabled: true },
];

beforeEach(() => {
  (globalThis as unknown as { window: { api: unknown } }).window = {
    api: { call: vi.fn(async () => ({ ok: true, data: servers })) },
  } as never;
});

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <McpList />
    </QueryClientProvider>,
  );
}

describe('McpList', () => {
  it('lists servers with name and health', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByText('pencil')).toBeInTheDocument());
    expect(screen.getByText('serena')).toBeInTheDocument();
  });

  it('shows a read-only plugin badge for plugin servers', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('plugin-origin-badge-serena')).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/renderer/screens/mcps/McpList.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the screen**

```tsx
// src/renderer/screens/mcps/McpList.tsx
import { Box, CircularProgress, Container, Divider, Stack, Typography } from '@mui/material';
import { ScreenHeader } from '../../components/ds/ScreenHeader.js';
import { StatusPill } from '../../components/ds/StatusPill.js';
import { PluginOriginBadge } from '../../components/PluginOriginBadge.js';
import { useMcpList } from '../../hooks/use-mcp-list.js';
import type { McpHealthState, McpScope, McpServer } from '../../../shared/mcp.js';

const SCOPE_LABEL: Record<McpScope, string> = {
  global: 'Personal',
  'project-local': 'Project (local)',
  'project-shared': 'Project (shared)',
  plugin: 'Plugin',
};

const HEALTH_PILL: Record<McpHealthState, 'ok' | 'warning' | 'error'> = {
  ok: 'ok',
  warning: 'warning',
  error: 'error',
  'needs-auth': 'warning',
};

function HealthBadge({ server }: { server: McpServer }): React.ReactElement | null {
  if (!server.health) return null;
  return <StatusPill variant={HEALTH_PILL[server.health.state]} label={server.health.state} />;
}

export function McpList(): React.ReactElement {
  const { data, isLoading } = useMcpList();
  const servers = data ?? [];

  return (
    <Container component="main" data-testid="mcp-screen" maxWidth="lg" sx={{ py: 2.5 }}>
      <ScreenHeader
        kicker="Biblioteca"
        title="MCP"
        subtitle={data ? `${servers.length} server(s)` : undefined}
      />

      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={24} />
        </Box>
      )}

      {!isLoading && (
        <Stack divider={<Divider />} sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
          {servers.map((server) => (
            <Box
              key={server.id}
              data-testid={`mcp-row-${server.id}`}
              sx={{ p: 1.5, display: 'flex', gap: 1.5, alignItems: 'center', justifyContent: 'space-between' }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2">{server.name}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {server.transport} · {SCOPE_LABEL[server.scope]}
                </Typography>
                {server.health?.detail && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {server.health.detail}
                  </Typography>
                )}
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <HealthBadge server={server} />
                {server.source.kind === 'plugin' && (
                  <PluginOriginBadge
                    pluginId={server.source.pluginId}
                    provenance={server.source.provenance}
                  />
                )}
              </Stack>
            </Box>
          ))}
        </Stack>
      )}
    </Container>
  );
}
```

- [ ] **Step 4: Run test + typecheck**

Run: `npx vitest run tests/renderer/screens/mcps/McpList.test.tsx`
Expected: PASS.
Run: `npm run typecheck`
Expected: PASS (Task 12's `McpList` import now resolves).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/screens/mcps/McpList.tsx src/renderer/components/shell/nav.ts src/renderer/screens/Main.tsx tests/renderer/screens/mcps/McpList.test.tsx
git commit -m "feat(mcp): add read-only MCP list screen + nav entry"
```

---

### Task 15: Phase 1 gate — full suite + docs

**Files:**
- Modify: `docs/reference/ipc-contract.md`

- [ ] **Step 1: Document the `mcp.*` read methods** — add a section to `docs/reference/ipc-contract.md` matching the existing table style:

```markdown
### `mcp`

| Method | Params | Result |
|---|---|---|
| `mcp.list` | `{}` | `McpServer[]` (global + project-local + project-shared + plugin, with health) |
| `mcp.get` | `{ id: string }` | `McpServer \| undefined` |

`McpServer` is read-only when `source.kind === 'plugin'`. Write methods are added in later phases.
```

- [ ] **Step 2: Run the full suite + lint + typecheck**

Run: `npm run lint && npm run typecheck && npm test`
Expected: PASS (coverage thresholds hold).

- [ ] **Step 3: Commit**

```bash
git add docs/reference/ipc-contract.md
git commit -m "docs(mcp): document mcp.list/mcp.get; Phase 1 read-only browser complete"
```

---

## PHASE 2 — Write CRUD

### Task 16: Infra — `FsMcpConfigStore` WRITE side (`upsert` / `remove`)

**Files:**
- Modify: `src/main/infrastructure/mcp/fs-mcp-config-store.ts`
- Test: `tests/main/infrastructure/mcp/fs-mcp-config-store.write.test.ts`

Mirror `claude-settings-file.ts`: lock → read raw → `.bak` → mutate only the targeted key → `.tmp` → `rename`. `~/.claude.json` is mutated as an opaque object (preserve all sibling keys). `.mcp.json` writes the `mcpServers` map.

- [ ] **Step 1: Write the failing test**

```ts
// tests/main/infrastructure/mcp/fs-mcp-config-store.write.test.ts
import { mkdtemp, rm, writeFile, readFile, stat, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FsMcpConfigStore } from '../../../../src/main/infrastructure/mcp/fs-mcp-config-store.js';

describe('FsMcpConfigStore write', () => {
  let tmp: string;
  let claudeJsonPath: string;
  beforeEach(async () => {
    tmp = await mkdtemp(path.join(os.tmpdir(), 'mcp-store-write-'));
    claudeJsonPath = path.join(tmp, '.claude.json');
  });
  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it('upserts a global server while preserving every sibling key', async () => {
    await writeFile(
      claudeJsonPath,
      JSON.stringify({ numStartups: 9, projects: { '/x': { foo: 1 } }, mcpServers: { old: { command: 'o' } } }),
      'utf8',
    );
    const store = new FsMcpConfigStore({ claudeJsonPath });
    await store.upsert({ kind: 'global' }, 'pencil', { command: 'pencil-mcp' });

    const json = JSON.parse(await readFile(claudeJsonPath, 'utf8'));
    expect(json.numStartups).toBe(9);
    expect(json.projects).toEqual({ '/x': { foo: 1 } });
    expect(json.mcpServers.old).toEqual({ command: 'o' });
    expect(json.mcpServers.pencil).toEqual({ command: 'pencil-mcp' });
  });

  it('writes a .bak and cleans up the .tmp', async () => {
    await writeFile(claudeJsonPath, JSON.stringify({ a: 1 }), 'utf8');
    const store = new FsMcpConfigStore({ claudeJsonPath });
    await store.upsert({ kind: 'global' }, 'pencil', { command: 'x' });
    expect(await readFile(claudeJsonPath + '.bak', 'utf8')).toBe(JSON.stringify({ a: 1 }));
    await expect(stat(claudeJsonPath + '.tmp')).rejects.toThrow();
  });

  it('upserts a project-local server under projects[repoPath].mcpServers', async () => {
    await writeFile(claudeJsonPath, JSON.stringify({ projects: { '/repo': { history: [] } } }), 'utf8');
    const store = new FsMcpConfigStore({ claudeJsonPath });
    await store.upsert({ kind: 'project-local', repoPath: '/repo' }, 'clickup', { type: 'http', url: 'https://c.dev' });
    const json = JSON.parse(await readFile(claudeJsonPath, 'utf8'));
    expect(json.projects['/repo'].history).toEqual([]);
    expect(json.projects['/repo'].mcpServers.clickup).toEqual({ type: 'http', url: 'https://c.dev' });
  });

  it('upserts a project-shared server into <repo>/.mcp.json', async () => {
    const repoPath = path.join(tmp, 'repo');
    await mkdir(repoPath, { recursive: true });
    const store = new FsMcpConfigStore({ claudeJsonPath });
    await store.upsert({ kind: 'project-shared', repoPath }, 'figma', { type: 'sse', url: 'https://f.dev' });
    const json = JSON.parse(await readFile(path.join(repoPath, '.mcp.json'), 'utf8'));
    expect(json.mcpServers.figma).toEqual({ type: 'sse', url: 'https://f.dev' });
  });

  it('removes a server', async () => {
    await writeFile(claudeJsonPath, JSON.stringify({ mcpServers: { a: { command: 'a' }, b: { command: 'b' } } }), 'utf8');
    const store = new FsMcpConfigStore({ claudeJsonPath });
    await store.remove({ kind: 'global' }, 'a');
    const json = JSON.parse(await readFile(claudeJsonPath, 'utf8'));
    expect(json.mcpServers).toEqual({ b: { command: 'b' } });
  });

  it('aborts (throws) when ~/.claude.json is not valid JSON, leaving it untouched', async () => {
    await writeFile(claudeJsonPath, '{ broken', 'utf8');
    const store = new FsMcpConfigStore({ claudeJsonPath });
    await expect(store.upsert({ kind: 'global' }, 'x', { command: 'x' })).rejects.toThrow();
    expect(await readFile(claudeJsonPath, 'utf8')).toBe('{ broken');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/main/infrastructure/mcp/fs-mcp-config-store.write.test.ts`
Expected: FAIL — `upsert`/`remove` throw "not implemented".

- [ ] **Step 3: Implement the write side**

Add the lockfile import at the top of `src/main/infrastructure/mcp/fs-mcp-config-store.ts`:
```ts
import lockfile from 'proper-lockfile';
```
Replace the placeholder `upsert` and `remove` methods with:

```ts
  async upsert(location: McpLocation, name: string, def: McpServerDef): Promise<void> {
    if (location.kind === 'plugin') throw new Error('Cannot write a plugin MCP server');
    if (location.kind === 'project-shared') {
      await this.mutateMcpJson(path.join(location.repoPath, '.mcp.json'), (servers) => {
        servers[name] = def;
      });
      return;
    }
    await this.mutateClaudeJson((root) => {
      setServer(root, location, name, def);
    });
  }

  async remove(location: McpLocation, name: string): Promise<void> {
    if (location.kind === 'plugin') throw new Error('Cannot write a plugin MCP server');
    if (location.kind === 'project-shared') {
      await this.mutateMcpJson(path.join(location.repoPath, '.mcp.json'), (servers) => {
        delete servers[name];
      });
      return;
    }
    await this.mutateClaudeJson((root) => {
      deleteServer(root, location, name);
    });
  }

  private async mutateClaudeJson(mutate: (root: Record<string, unknown>) => void): Promise<void> {
    const filePath = this.paths.claudeJsonPath;
    await ensureFile(filePath);
    const release = await acquire(filePath);
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      const root = JSON.parse(raw) as Record<string, unknown>; // throws on bad JSON → abort
      await fs.writeFile(filePath + '.bak', raw, 'utf8');
      mutate(root);
      await atomicWrite(filePath, JSON.stringify(root, null, 2));
    } finally {
      await release();
    }
  }

  private async mutateMcpJson(
    filePath: string,
    mutate: (servers: Record<string, unknown>) => void,
  ): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await ensureFile(filePath);
    const release = await acquire(filePath);
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      const root = JSON.parse(raw) as { mcpServers?: Record<string, unknown> };
      await fs.writeFile(filePath + '.bak', raw, 'utf8');
      const servers = root.mcpServers ?? {};
      mutate(servers);
      root.mcpServers = servers;
      await atomicWrite(filePath, JSON.stringify(root, null, 2));
    } finally {
      await release();
    }
  }
```

Add these module-level helpers at the bottom of the file:

```ts
function setServer(
  root: Record<string, unknown>,
  location: Extract<McpLocation, { kind: 'global' | 'project-local' }>,
  name: string,
  def: McpServerDef,
): void {
  if (location.kind === 'global') {
    const servers = (root.mcpServers as Record<string, unknown>) ?? {};
    servers[name] = def;
    root.mcpServers = servers;
    return;
  }
  const projects = (root.projects as Record<string, Record<string, unknown>>) ?? {};
  const block = projects[location.repoPath] ?? {};
  const servers = (block.mcpServers as Record<string, unknown>) ?? {};
  servers[name] = def;
  block.mcpServers = servers;
  projects[location.repoPath] = block;
  root.projects = projects;
}

function deleteServer(
  root: Record<string, unknown>,
  location: Extract<McpLocation, { kind: 'global' | 'project-local' }>,
  name: string,
): void {
  if (location.kind === 'global') {
    const servers = root.mcpServers as Record<string, unknown> | undefined;
    if (servers) delete servers[name];
    return;
  }
  const projects = root.projects as Record<string, Record<string, unknown>> | undefined;
  const servers = projects?.[location.repoPath]?.mcpServers as Record<string, unknown> | undefined;
  if (servers) delete servers[name];
}

async function ensureFile(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, '{}', 'utf8');
  }
}

async function acquire(filePath: string): Promise<() => Promise<void>> {
  return lockfile.lock(filePath, { retries: { retries: 5, minTimeout: 100 }, stale: 10000 });
}

async function atomicWrite(filePath: string, content: string): Promise<void> {
  const tmpPath = filePath + '.tmp';
  await fs.writeFile(tmpPath, content, 'utf8');
  await fs.rename(tmpPath, filePath);
}
```

Note: the `parseDef`-based read remains; the bad-JSON abort works because `JSON.parse(raw)` throws before any write.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/main/infrastructure/mcp/fs-mcp-config-store.write.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/infrastructure/mcp/fs-mcp-config-store.ts tests/main/infrastructure/mcp/fs-mcp-config-store.write.test.ts
git commit -m "feat(mcp): FsMcpConfigStore write side (atomic, backup, fail-safe, surgical)"
```

---

### Task 17: Service — `save` / `delete` with plugin guard + validation

**Files:**
- Modify: `src/main/application/services/mcp-service.ts`
- Test: `tests/main/application/services/mcp-service.write.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/main/application/services/mcp-service.write.test.ts
import { describe, it, expect, vi } from 'vitest';
import { McpService } from '../../../../src/main/application/services/mcp-service.js';
import type { McpConfigPort } from '../../../../src/main/application/ports/mcp-config-port.js';
import type { PluginMcpReader } from '../../../../src/main/infrastructure/mcp/plugin-mcp-reader.js';
import type { ClaudeRuntimePort } from '../../../../src/main/application/ports/claude-runtime-port.js';
import { OperationNotAllowedForOriginError } from '../../../../src/main/domain/plugin-errors.js';
import { mcpServerId } from '../../../../src/main/domain/mcp-server-id.js';

const noRuntime: ClaudeRuntimePort = {
  readMcpServers: async () => [],
  readMcpAuthAlerts: async () => [],
  readMcpRuntimeLogs: async () => [],
};
const noPlugins = { read: async () => [] } as unknown as PluginMcpReader;

function makeService(config: McpConfigPort) {
  return new McpService({ config, plugins: noPlugins, runtime: noRuntime, linkedRepoPaths: async () => [] });
}

describe('McpService write', () => {
  it('save upserts a valid global stdio server', async () => {
    const upsert = vi.fn(async () => {});
    const svc = makeService({ read: async () => [], upsert, remove: async () => {} });
    await svc.save({
      server: { name: 'pencil', scope: 'global', def: { command: 'x' } },
      isCreate: true,
    });
    expect(upsert).toHaveBeenCalledWith({ kind: 'global' }, 'pencil', { command: 'x' });
  });

  it('save rejects an invalid def', async () => {
    const svc = makeService({ read: async () => [], upsert: async () => {}, remove: async () => {} });
    await expect(
      svc.save({ server: { name: 'bad', scope: 'global', def: { nope: true } } }),
    ).rejects.toThrow();
  });

  it('save of a project-shared server requires repoPath', async () => {
    const svc = makeService({ read: async () => [], upsert: async () => {}, remove: async () => {} });
    await expect(
      svc.save({ server: { name: 'figma', scope: 'project-shared', def: { type: 'sse', url: 'https://f.dev' } } }),
    ).rejects.toThrow(/repoPath/);
  });

  it('delete refuses a plugin-sourced id', async () => {
    const svc = makeService({ read: async () => [], upsert: async () => {}, remove: async () => {} });
    const pluginId = mcpServerId({
      location: { kind: 'plugin', pluginId: 'serena', pluginDir: '/d' },
      name: 'serena',
    });
    await expect(svc.delete({ id: pluginId })).rejects.toThrow(OperationNotAllowedForOriginError);
  });

  it('delete removes a workspace server by id', async () => {
    const remove = vi.fn(async () => {});
    const svc = makeService({ read: async () => [], upsert: async () => {}, remove });
    const id = mcpServerId({ location: { kind: 'global' }, name: 'pencil' });
    await svc.delete({ id });
    expect(remove).toHaveBeenCalledWith({ kind: 'global' }, 'pencil');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/main/application/services/mcp-service.write.test.ts`
Expected: FAIL — `save`/`delete` not defined.

- [ ] **Step 3: Implement `save` / `delete`**

Amend the existing `../schemas/mcp.js` import (added in Task 9) to also bring in `mcpServerDefSchema`:
```ts
import { transportOf, mcpServerDefSchema } from '../schemas/mcp.js';
```
Add the remaining imports at the top of `src/main/application/services/mcp-service.ts`:
```ts
import type { McpServerInput } from '../../../shared/mcp.js';
import { OperationNotAllowedForOriginError } from '../../domain/plugin-errors.js';
import { DomainError } from '../../domain/errors.js';
import type { McpLocation } from '../../domain/mcp-location.js';
```
Add these methods to the `McpService` class:

```ts
  async save(input: { server: McpServerInput; isCreate?: boolean }): Promise<{ ok: true }> {
    const { server } = input;
    const def = mcpServerDefSchema.parse(server.def); // throws validation on bad def
    const location = this.inputLocation(server);
    await this.deps.config.upsert(location, server.name, def);
    return { ok: true };
  }

  async delete(input: { id: string }): Promise<{ ok: true }> {
    const ref = parseMcpServerId(input.id);
    if (ref.location.kind === 'plugin') {
      throw new OperationNotAllowedForOriginError(
        `Cannot delete MCP server '${ref.name}' provided by plugin '${ref.location.pluginId}'`,
        { origin: 'plugin', operation: 'delete' },
      );
    }
    await this.deps.config.remove(ref.location, ref.name);
    return { ok: true };
  }

  private inputLocation(server: McpServerInput): McpLocation {
    if (server.scope === 'global') return { kind: 'global' };
    if (server.repoPath === undefined || server.repoPath.length === 0) {
      throw new DomainError('validation', `Missing 'repoPath' for scope '${server.scope}'`);
    }
    return { kind: server.scope, repoPath: server.repoPath };
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/main/application/services/mcp-service.write.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/application/services/mcp-service.ts tests/main/application/services/mcp-service.write.test.ts
git commit -m "feat(mcp): McpService save/delete with plugin guard + validation"
```

---

### Task 18: IPC — `mcp.save` / `mcp.delete`

**Files:**
- Modify: `src/main/ipc/mcp-handlers.ts`
- Modify: `tests/main/ipc/mcp-handlers.test.ts`

- [ ] **Step 1: Add failing tests** (append inside the existing `describe`):

```ts
  it('mcp.save passes the server input through', async () => {
    const save = vi.fn(async () => ({ ok: true as const }));
    const handlers = buildMcpHandlers(fakeService({ save } as never));
    const input = { name: 'pencil', scope: 'global', def: { command: 'x' } };
    await handlers['mcp.save']!({ server: input, isCreate: true });
    expect(save).toHaveBeenCalledWith({ server: input, isCreate: true });
  });

  it('mcp.delete validates id', async () => {
    const handlers = buildMcpHandlers(fakeService());
    await expect(handlers['mcp.delete']!({})).rejects.toThrow();
  });
```
Add `import { vi } from 'vitest';` to the test file's imports if not present (it imports `describe, it, expect` already — extend to include `vi`).

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/main/ipc/mcp-handlers.test.ts`
Expected: FAIL — `mcp.save`/`mcp.delete` undefined.

- [ ] **Step 3: Implement** — add to the object returned by `buildMcpHandlers`:

```ts
    'mcp.save': async (params) => {
      const raw = asObject(params, 'mcp.save');
      const server = asObject(raw['server'], 'server') as unknown as McpServerInput;
      const isCreate = typeof raw['isCreate'] === 'boolean' ? raw['isCreate'] : undefined;
      return service.save({ server, ...(isCreate !== undefined ? { isCreate } : {}) });
    },

    'mcp.delete': async (params) => {
      const raw = asObject(params, 'mcp.delete');
      return service.delete({ id: asString(raw['id'], 'id') });
    },
```
Add the import at the top of `mcp-handlers.ts`:
```ts
import type { McpServerInput } from '../../shared/mcp.js';
```

- [ ] **Step 4: Run to verify it passes + typecheck**

Run: `npx vitest run tests/main/ipc/mcp-handlers.test.ts`
Expected: PASS.
Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/ipc/mcp-handlers.ts tests/main/ipc/mcp-handlers.test.ts
git commit -m "feat(mcp): add mcp.save/mcp.delete IPC"
```

---

### Task 19: Renderer — editor (create/edit/delete) + mutations

**Files:**
- Create: `src/renderer/hooks/use-mcp-mutations.ts`
- Create: `src/renderer/screens/mcps/McpEditorDialog.tsx`
- Modify: `src/renderer/screens/mcps/McpList.tsx`
- Test: `tests/renderer/screens/mcps/McpEditorDialog.test.tsx`

- [ ] **Step 1: Write the mutations hook** (no separate test; covered via dialog test):

```ts
// src/renderer/hooks/use-mcp-mutations.ts
import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { callIpc } from '../lib/ipc.js';
import { mcpListQueryKey } from './use-mcp-list.js';
import type { McpServerInput } from '../../shared/mcp.js';

export function useSaveMcp(): UseMutationResult<{ ok: true }, Error, { server: McpServerInput; isCreate?: boolean }> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars) => callIpc<{ ok: true }>('mcp.save', vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: mcpListQueryKey() }),
  });
}

export function useDeleteMcp(): UseMutationResult<{ ok: true }, Error, { id: string }> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars) => callIpc<{ ok: true }>('mcp.delete', vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: mcpListQueryKey() }),
  });
}
```

- [ ] **Step 2: Write the failing dialog test**

```tsx
// tests/renderer/screens/mcps/McpEditorDialog.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { McpEditorDialog } from '../../../../src/renderer/screens/mcps/McpEditorDialog.js';

let call: ReturnType<typeof vi.fn>;
beforeEach(() => {
  call = vi.fn(async () => ({ ok: true, data: { ok: true } }));
  (globalThis as unknown as { window: { api: unknown } }).window = { api: { call } } as never;
});

function renderDialog(onClose = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <McpEditorDialog open mode="create" onClose={onClose} />
    </QueryClientProvider>,
  );
}

describe('McpEditorDialog', () => {
  it('creates a stdio server via mcp.save', async () => {
    const onClose = vi.fn();
    renderDialog(onClose);
    fireEvent.change(screen.getByTestId('mcp-name-input').querySelector('input')!, {
      target: { value: 'pencil' },
    });
    fireEvent.change(screen.getByTestId('mcp-command-input').querySelector('input')!, {
      target: { value: 'pencil-mcp' },
    });
    fireEvent.click(screen.getByTestId('mcp-save'));
    await waitFor(() =>
      expect(call).toHaveBeenCalledWith('mcp.save', expect.objectContaining({
        server: expect.objectContaining({ name: 'pencil', scope: 'global', def: { command: 'pencil-mcp' } }),
        isCreate: true,
      })),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run tests/renderer/screens/mcps/McpEditorDialog.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 4: Write the editor dialog**

```tsx
// src/renderer/screens/mcps/McpEditorDialog.tsx
import { useState } from 'react';
import {
  Button, Dialog, DialogActions, DialogContent, DialogTitle,
  MenuItem, Stack, TextField,
} from '@mui/material';
import { useSaveMcp } from '../../hooks/use-mcp-mutations.js';
import type { McpServer, McpServerInput, McpTransport } from '../../../shared/mcp.js';

type CreateScope = 'global' | 'project-local' | 'project-shared';

interface Props {
  open: boolean;
  mode: 'create' | 'edit';
  initial?: McpServer;
  onClose: () => void;
}

// Preserves passthrough fields (args/env/headers/timeout/…) from the existing
// def, swapping only the transport-primary key. Prevents data loss on edit.
function buildDef(
  base: Record<string, unknown>,
  transport: McpTransport,
  command: string,
  url: string,
): Record<string, unknown> {
  const def: Record<string, unknown> = { ...base };
  if (transport === 'stdio') {
    delete def['type'];
    delete def['url'];
    delete def['headers'];
    def['command'] = command;
  } else {
    delete def['command'];
    delete def['args'];
    delete def['env'];
    def['type'] = transport;
    def['url'] = url;
  }
  return def;
}

export function McpEditorDialog({ open, mode, initial, onClose }: Props): React.ReactElement {
  const save = useSaveMcp();
  const [name, setName] = useState(initial?.name ?? '');
  const [scope, setScope] = useState<CreateScope>(
    (initial?.scope as CreateScope) ?? 'global',
  );
  const [repoPath, setRepoPath] = useState(initial?.repoPath ?? '');
  const [transport, setTransport] = useState<McpTransport>(initial?.transport ?? 'stdio');
  const [command, setCommand] = useState(String(initial?.def?.['command'] ?? ''));
  const [url, setUrl] = useState(String(initial?.def?.['url'] ?? ''));

  const submit = (): void => {
    const server: McpServerInput = {
      name,
      scope,
      def: buildDef(initial?.def ?? {}, transport, command, url),
      ...(scope !== 'global' ? { repoPath } : {}),
      ...(initial?.id ? { id: initial.id } : {}),
    };
    save.mutate(
      { server, isCreate: mode === 'create' },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{mode === 'create' ? 'New MCP server' : 'Edit MCP server'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Name" data-testid="mcp-name-input" value={name}
            onChange={(e) => setName(e.target.value)} disabled={mode === 'edit'}
          />
          <TextField
            select label="Scope" data-testid="mcp-scope-input" value={scope}
            onChange={(e) => setScope(e.target.value as CreateScope)} disabled={mode === 'edit'}
          >
            <MenuItem value="global">Personal (global)</MenuItem>
            <MenuItem value="project-local">Project (local)</MenuItem>
            <MenuItem value="project-shared">Project (shared / .mcp.json)</MenuItem>
          </TextField>
          {scope !== 'global' && (
            <TextField
              label="Repo path" data-testid="mcp-repo-input" value={repoPath}
              onChange={(e) => setRepoPath(e.target.value)}
            />
          )}
          <TextField
            select label="Transport" data-testid="mcp-transport-input" value={transport}
            onChange={(e) => setTransport(e.target.value as McpTransport)}
          >
            <MenuItem value="stdio">stdio</MenuItem>
            <MenuItem value="http">http</MenuItem>
            <MenuItem value="sse">sse</MenuItem>
          </TextField>
          {transport === 'stdio' ? (
            <TextField
              label="Command" data-testid="mcp-command-input" value={command}
              onChange={(e) => setCommand(e.target.value)}
            />
          ) : (
            <TextField
              label="URL" data-testid="mcp-url-input" value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" data-testid="mcp-save" onClick={submit} disabled={save.isPending}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

- [ ] **Step 5: Wire create/edit/delete into `McpList.tsx`**

Add at the top of `McpList.tsx`:
```tsx
import { useState } from 'react';
import { Button, IconButton, Tooltip } from '@mui/material';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Icon } from '../../components/ds/Icon.js';
import { McpEditorDialog } from './McpEditorDialog.js';
import { useDeleteMcp } from '../../hooks/use-mcp-mutations.js';
```
Inside `McpList`, add state + delete hook:
```tsx
  const del = useDeleteMcp();
  const [editor, setEditor] = useState<{ mode: 'create' | 'edit'; server?: McpServer } | null>(null);
```
Add a "New" button to the `ScreenHeader` via its `actions` prop:
```tsx
        actions={
          <Button
            variant="outlined" size="small" data-testid="mcp-new"
            startIcon={<Icon glyph={Plus} size={16} />}
            onClick={() => setEditor({ mode: 'create' })}
          >
            New
          </Button>
        }
```
In each row's right-hand `Stack`, add edit/delete actions for non-plugin rows (before/after the badges):
```tsx
                {server.source.kind !== 'plugin' && (
                  <>
                    <Tooltip title="Edit">
                      <IconButton
                        size="small" data-testid={`mcp-edit-${server.id}`}
                        onClick={() => setEditor({ mode: 'edit', server })}
                      >
                        <Icon glyph={Pencil} size={16} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small" data-testid={`mcp-delete-${server.id}`}
                        onClick={() => del.mutate({ id: server.id })}
                      >
                        <Icon glyph={Trash2} size={16} />
                      </IconButton>
                    </Tooltip>
                  </>
                )}
```
At the end of the component (before the closing `</Container>`), render the dialog:
```tsx
      {editor && (
        <McpEditorDialog
          open mode={editor.mode}
          {...(editor.server ? { initial: editor.server } : {})}
          onClose={() => setEditor(null)}
        />
      )}
```

- [ ] **Step 6: Run dialog test + full renderer project + typecheck**

Run: `npx vitest run tests/renderer/screens/mcps/McpEditorDialog.test.tsx`
Expected: PASS.
Run: `npx vitest --project jsdom run`
Expected: PASS.
Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/hooks/use-mcp-mutations.ts src/renderer/screens/mcps/McpEditorDialog.tsx src/renderer/screens/mcps/McpList.tsx tests/renderer/screens/mcps/McpEditorDialog.test.tsx
git commit -m "feat(mcp): add MCP editor dialog with create/edit/delete"
```

---

### Task 20: Phase 2 gate — docs + full suite

**Files:**
- Modify: `docs/reference/ipc-contract.md`

- [ ] **Step 1: Extend the `mcp` table** with the write methods:

```markdown
| `mcp.save` | `{ server: McpServerInput; isCreate?: boolean }` | `{ ok: true }` |
| `mcp.delete` | `{ id: string }` | `{ ok: true }` |

`mcp.save`/`mcp.delete` throw `OperationNotAllowedForOriginError` (kind `validation`) for plugin-sourced servers. Writes to `~/.claude.json` are surgical (only `mcpServers` / `projects[path].mcpServers` are touched), atomic, and backed up to `<file>.bak`.
```

- [ ] **Step 2: Full suite + lint + typecheck**

Run: `npm run lint && npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add docs/reference/ipc-contract.md
git commit -m "docs(mcp): document write methods; Phase 2 CRUD complete"
```

---

## PHASE 3 — Enable / disable

### Task 21: Infra — `McpDisabledStash` (park/restore inline servers)

**Files:**
- Create: `src/main/infrastructure/mcp/mcp-disabled-stash.ts`
- Test: `tests/main/infrastructure/mcp/mcp-disabled-stash.test.ts`

The stash parks disabled inline (global / project-local) server defs in `~/.superset-ai-app/mcp-disabled.json`, keyed by the server id.

- [ ] **Step 1: Write the failing test**

```ts
// tests/main/infrastructure/mcp/mcp-disabled-stash.test.ts
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { McpDisabledStash } from '../../../../src/main/infrastructure/mcp/mcp-disabled-stash.js';

describe('McpDisabledStash', () => {
  let tmp: string;
  let stashPath: string;
  beforeEach(async () => {
    tmp = await mkdtemp(path.join(os.tmpdir(), 'mcp-stash-'));
    stashPath = path.join(tmp, 'mcp-disabled.json');
  });
  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it('parks a def and lists it; take() removes and returns it', async () => {
    const stash = new McpDisabledStash({ stashPath });
    await stash.park('id1', { command: 'x' });
    expect(await stash.list()).toEqual([{ id: 'id1', def: { command: 'x' } }]);
    expect(await stash.take('id1')).toEqual({ command: 'x' });
    expect(await stash.list()).toEqual([]);
  });

  it('persists across instances and tolerates a missing file', async () => {
    expect(await new McpDisabledStash({ stashPath }).list()).toEqual([]);
    await new McpDisabledStash({ stashPath }).park('id2', { type: 'http', url: 'https://x.dev' });
    const json = JSON.parse(await readFile(stashPath, 'utf8'));
    expect(json['id2']).toEqual({ type: 'http', url: 'https://x.dev' });
  });

  it('take() of an unknown id returns undefined', async () => {
    expect(await new McpDisabledStash({ stashPath }).take('nope')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/main/infrastructure/mcp/mcp-disabled-stash.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// src/main/infrastructure/mcp/mcp-disabled-stash.ts
import fs from 'node:fs/promises';
import path from 'node:path';
import type { McpServerDef } from '../../application/schemas/mcp.js';

export interface McpDisabledStashPaths {
  stashPath: string;
}

export interface StashedServer {
  id: string;
  def: McpServerDef;
}

export class McpDisabledStash {
  constructor(private readonly paths: McpDisabledStashPaths) {}

  async list(): Promise<StashedServer[]> {
    const map = await this.read();
    return Object.entries(map).map(([id, def]) => ({ id, def }));
  }

  async park(id: string, def: McpServerDef): Promise<void> {
    const map = await this.read();
    map[id] = def;
    await this.write(map);
  }

  async take(id: string): Promise<McpServerDef | undefined> {
    const map = await this.read();
    const def = map[id];
    if (def === undefined) return undefined;
    delete map[id];
    await this.write(map);
    return def;
  }

  private async read(): Promise<Record<string, McpServerDef>> {
    const raw = await fs.readFile(this.paths.stashPath, 'utf8').catch((err: unknown) => {
      if (typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 'ENOENT') {
        return undefined;
      }
      throw err;
    });
    if (raw === undefined) return {};
    return JSON.parse(raw) as Record<string, McpServerDef>;
  }

  private async write(map: Record<string, McpServerDef>): Promise<void> {
    await fs.mkdir(path.dirname(this.paths.stashPath), { recursive: true });
    const tmpPath = this.paths.stashPath + '.tmp';
    await fs.writeFile(tmpPath, JSON.stringify(map, null, 2), 'utf8');
    await fs.rename(tmpPath, this.paths.stashPath);
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/main/infrastructure/mcp/mcp-disabled-stash.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/infrastructure/mcp/mcp-disabled-stash.ts tests/main/infrastructure/mcp/mcp-disabled-stash.test.ts
git commit -m "feat(mcp): add McpDisabledStash for inline disable"
```

---

### Task 22: Config store — disabled-list for project-shared + read reflects disabled

**Files:**
- Modify: `src/main/infrastructure/mcp/fs-mcp-config-store.ts`
- Test: `tests/main/infrastructure/mcp/fs-mcp-config-store.disabled.test.ts`

For project-shared (`.mcp.json`) servers, disable is native: add the name to `~/.claude.json` → `projects[repoPath].disabledMcpjsonServers` (open item §11.1 — verify Claude honors it here). `read` must mark such servers `enabled: false`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/main/infrastructure/mcp/fs-mcp-config-store.disabled.test.ts
import { mkdtemp, rm, writeFile, readFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FsMcpConfigStore } from '../../../../src/main/infrastructure/mcp/fs-mcp-config-store.js';

describe('FsMcpConfigStore disabled list (project-shared)', () => {
  let tmp: string;
  let claudeJsonPath: string;
  let repoPath: string;
  beforeEach(async () => {
    tmp = await mkdtemp(path.join(os.tmpdir(), 'mcp-store-disabled-'));
    claudeJsonPath = path.join(tmp, '.claude.json');
    repoPath = path.join(tmp, 'repo');
    await mkdir(repoPath, { recursive: true });
    await writeFile(path.join(repoPath, '.mcp.json'), JSON.stringify({ mcpServers: { figma: { type: 'sse', url: 'https://f.dev' } } }), 'utf8');
  });
  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it('setDisabledShared adds the name to projects[repoPath].disabledMcpjsonServers', async () => {
    await writeFile(claudeJsonPath, JSON.stringify({ projects: { [repoPath]: {} } }), 'utf8');
    const store = new FsMcpConfigStore({ claudeJsonPath });
    await store.setDisabledShared(repoPath, 'figma', true);
    const json = JSON.parse(await readFile(claudeJsonPath, 'utf8'));
    expect(json.projects[repoPath].disabledMcpjsonServers).toEqual(['figma']);

    await store.setDisabledShared(repoPath, 'figma', false);
    const json2 = JSON.parse(await readFile(claudeJsonPath, 'utf8'));
    expect(json2.projects[repoPath].disabledMcpjsonServers).toEqual([]);
  });

  it('read marks a project-shared server disabled when in the disabled list', async () => {
    await writeFile(claudeJsonPath, JSON.stringify({ projects: { [repoPath]: { disabledMcpjsonServers: ['figma'] } } }), 'utf8');
    const store = new FsMcpConfigStore({ claudeJsonPath });
    const servers = await store.read({ repoPaths: [repoPath] });
    expect(servers.find((s) => s.name === 'figma')?.enabled).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/main/infrastructure/mcp/fs-mcp-config-store.disabled.test.ts`
Expected: FAIL — `setDisabledShared` undefined; read doesn't reflect disabled.

- [ ] **Step 3: Implement**

In `ClaudeJsonShape`, extend the project block type:
```ts
  projects?: Record<string, { mcpServers?: Record<string, unknown>; disabledMcpjsonServers?: string[] } | undefined>;
```
In `read`, when iterating project-shared servers, compute disabled from the claude.json project block. Replace the project-shared loop body with:
```ts
    for (const repoPath of options.repoPaths) {
      const disabled = new Set((root.projects?.[repoPath]?.disabledMcpjsonServers) ?? []);
      const shared = await this.readMcpJson(path.join(repoPath, '.mcp.json'));
      for (const [name, raw] of Object.entries(shared)) {
        const def = parseDef(raw);
        if (def) {
          out.push({ location: { kind: 'project-shared', repoPath }, name, def, enabled: !disabled.has(name) });
        }
      }
    }
```
(`root` is already read at the top of `read`; reuse it.) Add the method:
```ts
  async setDisabledShared(repoPath: string, name: string, disabled: boolean): Promise<void> {
    await this.mutateClaudeJson((root) => {
      const projects = (root.projects as Record<string, Record<string, unknown>>) ?? {};
      const block = projects[repoPath] ?? {};
      const list = new Set((block.disabledMcpjsonServers as string[] | undefined) ?? []);
      if (disabled) list.add(name);
      else list.delete(name);
      block.disabledMcpjsonServers = [...list];
      projects[repoPath] = block;
      root.projects = projects;
    });
  }
```
Add `setDisabledShared` to the `McpConfigPort` interface in `src/main/application/ports/mcp-config-port.ts`:
```ts
  setDisabledShared(repoPath: string, name: string, disabled: boolean): Promise<void>;
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/main/infrastructure/mcp/fs-mcp-config-store.disabled.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/infrastructure/mcp/fs-mcp-config-store.ts src/main/application/ports/mcp-config-port.ts tests/main/infrastructure/mcp/fs-mcp-config-store.disabled.test.ts
git commit -m "feat(mcp): native disabled list for project-shared servers"
```

---

### Task 23: Service — `setEnabled` (stash for inline, disabled-list for shared) + read merges stash

**Files:**
- Modify: `src/main/application/services/mcp-service.ts`
- Test: `tests/main/application/services/mcp-service.enabled.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/main/application/services/mcp-service.enabled.test.ts
import { describe, it, expect, vi } from 'vitest';
import { McpService } from '../../../../src/main/application/services/mcp-service.js';
import type { McpConfigPort } from '../../../../src/main/application/ports/mcp-config-port.js';
import type { PluginMcpReader } from '../../../../src/main/infrastructure/mcp/plugin-mcp-reader.js';
import type { ClaudeRuntimePort } from '../../../../src/main/application/ports/claude-runtime-port.js';
import type { McpDisabledStash } from '../../../../src/main/infrastructure/mcp/mcp-disabled-stash.js';
import { mcpServerId } from '../../../../src/main/domain/mcp-server-id.js';
import { OperationNotAllowedForOriginError } from '../../../../src/main/domain/plugin-errors.js';

const noRuntime: ClaudeRuntimePort = {
  readMcpServers: async () => [], readMcpAuthAlerts: async () => [], readMcpRuntimeLogs: async () => [],
};
const noPlugins = { read: async () => [] } as unknown as PluginMcpReader;

function makeStash(over: Partial<McpDisabledStash> = {}): McpDisabledStash {
  return { list: async () => [], park: async () => {}, take: async () => undefined, ...over } as unknown as McpDisabledStash;
}

function makePort(over: Partial<McpConfigPort> = {}): McpConfigPort {
  return { read: async () => [], upsert: async () => {}, remove: async () => {}, setDisabledShared: async () => {}, ...over } as McpConfigPort;
}

describe('McpService.setEnabled', () => {
  it('disabling a global inline server parks its def and removes it', async () => {
    const park = vi.fn(async () => {});
    const remove = vi.fn(async () => {});
    const config = makePort({
      read: async () => [{ location: { kind: 'global' }, name: 'pencil', def: { command: 'x' }, enabled: true }],
      remove,
    });
    const svc = new McpService({
      config, plugins: noPlugins, runtime: noRuntime, linkedRepoPaths: async () => [],
      disabledStash: makeStash({ park }),
    });
    const id = mcpServerId({ location: { kind: 'global' }, name: 'pencil' });
    await svc.setEnabled({ id, enabled: false });
    expect(park).toHaveBeenCalledWith(id, { command: 'x' });
    expect(remove).toHaveBeenCalledWith({ kind: 'global' }, 'pencil');
  });

  it('disabling a project-shared server uses the native disabled list', async () => {
    const setDisabledShared = vi.fn(async () => {});
    const config = makePort({
      read: async () => [{ location: { kind: 'project-shared', repoPath: '/r' }, name: 'figma', def: { type: 'sse', url: 'https://f.dev' }, enabled: true }],
      setDisabledShared,
    });
    const svc = new McpService({
      config, plugins: noPlugins, runtime: noRuntime, linkedRepoPaths: async () => ['/r'],
      disabledStash: makeStash(),
    });
    const id = mcpServerId({ location: { kind: 'project-shared', repoPath: '/r' }, name: 'figma' });
    await svc.setEnabled({ id, enabled: false });
    expect(setDisabledShared).toHaveBeenCalledWith('/r', 'figma', true);
  });

  it('enabling a parked inline server restores its def', async () => {
    const take = vi.fn(async () => ({ command: 'x' }));
    const upsert = vi.fn(async () => {});
    const config = makePort({ upsert });
    const svc = new McpService({
      config, plugins: noPlugins, runtime: noRuntime, linkedRepoPaths: async () => [],
      disabledStash: makeStash({ take }),
    });
    const id = mcpServerId({ location: { kind: 'global' }, name: 'pencil' });
    await svc.setEnabled({ id, enabled: true });
    expect(take).toHaveBeenCalledWith(id);
    expect(upsert).toHaveBeenCalledWith({ kind: 'global' }, 'pencil', { command: 'x' });
  });

  it('refuses to toggle a plugin server', async () => {
    const svc = new McpService({
      config: makePort(), plugins: noPlugins, runtime: noRuntime,
      linkedRepoPaths: async () => [], disabledStash: makeStash(),
    });
    const id = mcpServerId({ location: { kind: 'plugin', pluginId: 'serena', pluginDir: '/d' }, name: 'serena' });
    await expect(svc.setEnabled({ id, enabled: false })).rejects.toThrow(OperationNotAllowedForOriginError);
  });

  it('list includes parked inline servers as disabled', async () => {
    const id = mcpServerId({ location: { kind: 'global' }, name: 'parked' });
    const svc = new McpService({
      config: makePort(), plugins: noPlugins, runtime: noRuntime, linkedRepoPaths: async () => [],
      disabledStash: makeStash({ list: async () => [{ id, def: { command: 'p' } }] }),
    });
    const found = (await svc.list()).find((s) => s.name === 'parked');
    expect(found?.enabled).toBe(false);
    expect(found?.scope).toBe('global');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/main/application/services/mcp-service.enabled.test.ts`
Expected: FAIL — `disabledStash` not a constructor field; `setEnabled` undefined.

- [ ] **Step 3: Implement**

Add to `McpServiceDeps` in `src/main/application/services/mcp-service.ts` (OPTIONAL — Phase 1/2 test constructors omit it; it is always wired in production via Task 24):
```ts
  disabledStash?: McpDisabledStash;
```
Add the import:
```ts
import type { McpDisabledStash } from '../../infrastructure/mcp/mcp-disabled-stash.js';
```
In `list()`, after building `own` and `fromPlugins`, merge parked servers when a stash is present (parse each id back to a location):
```ts
    const stash = this.deps.disabledStash;
    const parked = stash
      ? (await stash.list()).map((entry) => {
          const ref = parseMcpServerId(entry.id);
          return this.toDto(
            { location: ref.location, name: ref.name, def: entry.def, enabled: false },
            { kind: 'workspace' },
            health,
          );
        })
      : [];
    return [...own, ...fromPlugins, ...parked];
```
Add the method:
```ts
  async setEnabled(input: { id: string; enabled: boolean }): Promise<{ ok: true }> {
    const ref = parseMcpServerId(input.id);
    if (ref.location.kind === 'plugin') {
      throw new OperationNotAllowedForOriginError(
        `Cannot toggle MCP server '${ref.name}' provided by plugin '${ref.location.pluginId}'`,
        { origin: 'plugin', operation: 'save' },
      );
    }
    if (ref.location.kind === 'project-shared') {
      await this.deps.config.setDisabledShared(ref.location.repoPath, ref.name, !input.enabled);
      return { ok: true };
    }
    // Inline (global / project-local): park ⇄ restore via the stash.
    const stash = this.deps.disabledStash;
    if (stash === undefined) {
      throw new DomainError('internal', 'MCP disabled stash is not configured');
    }
    if (input.enabled) {
      const def = await stash.take(input.id);
      if (def !== undefined) await this.deps.config.upsert(ref.location, ref.name, def);
      return { ok: true };
    }
    const current = (await this.deps.config.read({ repoPaths: await this.deps.linkedRepoPaths() })).find(
      (s) => s.name === ref.name && s.location.kind === ref.location.kind,
    );
    if (current !== undefined) {
      await stash.park(input.id, current.def);
      await this.deps.config.remove(ref.location, ref.name);
    }
    return { ok: true };
  }
```
(`DomainError` is already imported from Task 17.)

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/main/application/services/mcp-service.enabled.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/application/services/mcp-service.ts tests/main/application/services/mcp-service.enabled.test.ts
git commit -m "feat(mcp): McpService.setEnabled (stash for inline, disabled list for shared)"
```

---

### Task 24: IPC + composition — `mcp.setEnabled` + wire the stash

**Files:**
- Modify: `src/main/ipc/mcp-handlers.ts`
- Modify: `src/main/index.ts`
- Modify: `tests/main/ipc/mcp-handlers.test.ts`

- [ ] **Step 1: Add failing test** (append to the `describe`):

```ts
  it('mcp.setEnabled validates id and enabled', async () => {
    const setEnabled = vi.fn(async () => ({ ok: true as const }));
    const handlers = buildMcpHandlers(fakeService({ setEnabled } as never));
    await handlers['mcp.setEnabled']!({ id: 'id1', enabled: false });
    expect(setEnabled).toHaveBeenCalledWith({ id: 'id1', enabled: false });
    await expect(handlers['mcp.setEnabled']!({ id: 'id1' })).rejects.toThrow();
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/main/ipc/mcp-handlers.test.ts`
Expected: FAIL — `mcp.setEnabled` undefined.

- [ ] **Step 3: Implement the handler** — add to `buildMcpHandlers`:

```ts
    'mcp.setEnabled': async (params) => {
      const raw = asObject(params, 'mcp.setEnabled');
      return service.setEnabled({
        id: asString(raw['id'], 'id'),
        enabled: asBoolean(raw['enabled'], 'enabled'),
      });
    },
```
Add `asBoolean` to the import from `./_validators.js`.

- [ ] **Step 4: Wire the stash in `index.ts`**

Add import:
```ts
import { McpDisabledStash } from './infrastructure/mcp/mcp-disabled-stash.js';
```
Construct it (near the other mcp wiring) and pass it to `McpService`:
```ts
  const mcpDisabledStash = new McpDisabledStash({
    stashPath: join(workspacePath, 'mcp-disabled.json'),
  });
```
Add `disabledStash: mcpDisabledStash,` to the `new McpService({ ... })` options.

- [ ] **Step 5: Run test + typecheck**

Run: `npx vitest run tests/main/ipc/mcp-handlers.test.ts`
Expected: PASS.
Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/main/ipc/mcp-handlers.ts src/main/index.ts tests/main/ipc/mcp-handlers.test.ts
git commit -m "feat(mcp): add mcp.setEnabled IPC + wire disabled stash"
```

---

### Task 25: Renderer — enabled toggle

**Files:**
- Modify: `src/renderer/hooks/use-mcp-mutations.ts`
- Modify: `src/renderer/screens/mcps/McpList.tsx`
- Test: `tests/renderer/screens/mcps/McpList.toggle.test.tsx`

- [ ] **Step 1: Add the mutation** to `use-mcp-mutations.ts`:

```ts
export function useSetMcpEnabled(): UseMutationResult<{ ok: true }, Error, { id: string; enabled: boolean }> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars) => callIpc<{ ok: true }>('mcp.setEnabled', vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: mcpListQueryKey() }),
  });
}
```

- [ ] **Step 2: Write the failing test**

```tsx
// tests/renderer/screens/mcps/McpList.toggle.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { McpList } from '../../../../src/renderer/screens/mcps/McpList.js';
import type { McpServer } from '../../../../src/shared/mcp.js';

const servers: McpServer[] = [
  { id: 'a', name: 'pencil', transport: 'stdio', def: { command: 'x' }, scope: 'global', source: { kind: 'workspace' }, enabled: true },
];

let call: ReturnType<typeof vi.fn>;
beforeEach(() => {
  call = vi.fn(async (method: string) =>
    method === 'mcp.list' ? { ok: true, data: servers } : { ok: true, data: { ok: true } },
  );
  (globalThis as unknown as { window: { api: unknown } }).window = { api: { call } } as never;
});

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <McpList />
    </QueryClientProvider>,
  );
}

describe('McpList toggle', () => {
  it('toggling a server calls mcp.setEnabled', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('mcp-toggle-a')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('mcp-toggle-a').querySelector('input')!);
    await waitFor(() =>
      expect(call).toHaveBeenCalledWith('mcp.setEnabled', { id: 'a', enabled: false }),
    );
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run tests/renderer/screens/mcps/McpList.toggle.test.tsx`
Expected: FAIL — no toggle element.

- [ ] **Step 4: Add the toggle to `McpList.tsx`**

Add imports:
```tsx
import { Switch } from '@mui/material';
import { useSetMcpEnabled } from '../../hooks/use-mcp-mutations.js';
```
Add the hook inside the component:
```tsx
  const setEnabled = useSetMcpEnabled();
```
In each row's actions `Stack`, for non-plugin rows add the switch (before the edit button):
```tsx
                {server.source.kind !== 'plugin' && (
                  <Switch
                    size="small" data-testid={`mcp-toggle-${server.id}`}
                    checked={server.enabled}
                    onChange={(e) => setEnabled.mutate({ id: server.id, enabled: e.target.checked })}
                  />
                )}
```

- [ ] **Step 5: Run test + jsdom project + typecheck**

Run: `npx vitest run tests/renderer/screens/mcps/McpList.toggle.test.tsx`
Expected: PASS.
Run: `npx vitest --project jsdom run`
Expected: PASS.
Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/hooks/use-mcp-mutations.ts src/renderer/screens/mcps/McpList.tsx tests/renderer/screens/mcps/McpList.toggle.test.tsx
git commit -m "feat(mcp): add enable/disable toggle to MCP list"
```

---

### Task 26: Final gate — docs + architecture + full suite

**Files:**
- Modify: `docs/reference/ipc-contract.md`
- Modify: `docs/reference/architecture.md`

- [ ] **Step 1: Document `mcp.setEnabled`** in `docs/reference/ipc-contract.md`:

```markdown
| `mcp.setEnabled` | `{ id: string; enabled: boolean }` | `{ ok: true }` |

Disable semantics: project-shared servers use `projects[repoPath].disabledMcpjsonServers` in `~/.claude.json`; inline (global / project-local) servers are parked in `~/.superset-ai-app/mcp-disabled.json` and restored on enable.
```

- [ ] **Step 2: Note the subsystem** in `docs/reference/architecture.md` — add a short paragraph under the services/infrastructure section:

```markdown
- **MCP (live-config broker):** `mcp-service` is NOT a customization facade. It reads/writes MCP
  servers directly in the real Claude files (`~/.claude.json` `mcpServers` and
  `projects[path].mcpServers`, `<repo>/.mcp.json`) via `FsMcpConfigStore`, reads plugin
  `.mcp.json` files read-only via `PluginMcpReader`, parks disabled inline servers in
  `McpDisabledStash`, and joins health from the read-only `ClaudeRuntimePort`. Writes are
  surgical, atomic, and backed up.
```

- [ ] **Step 3: Run the full gate**

Run: `npm run lint && npm run typecheck && npm test`
Expected: PASS (coverage thresholds hold).

- [ ] **Step 4: Manual smoke test (real app)**

Run: `npm run dev`
Verify: the **MCP** entry appears in the Biblioteca rail; the list shows your real servers (`pencil`, plugin servers read-only with "via Claude Code"/plugin badges, broken ones with health badges); creating a global stdio server writes only `mcpServers` in `~/.claude.json` (check `~/.claude.json.bak` was created); editing, deleting, and toggling work and survive a refresh.

- [ ] **Step 5: Commit**

```bash
git add docs/reference/ipc-contract.md docs/reference/architecture.md
git commit -m "docs(mcp): final docs; Phase 3 enable/disable complete"
```

---

## Self-review notes (for the implementer)

- **Open items carried from the spec (verify during Phase 1/3):**
  1. §11.1 — confirm Claude honors `projects[path].disabledMcpjsonServers` from `~/.claude.json` (Task 22). If not, switch `setDisabledShared` to write `<repo>/.claude/settings.json`.
  2. §11.2 — confirm the plugin runtime health name format `plugin-<pluginId>-<name>` (Task 9 `pluginToDto`). Adjust the matcher if Claude uses a different segment (e.g. marketplace-qualified id).
  3. §11.3 — the surgical-write tests (Task 16) assert sibling-key preservation; run the manual smoke test (Task 26) against your real, large `~/.claude.json` before trusting it.
- **Coverage:** new `src/main/application`, `ipc`, `infrastructure`, and `renderer/screens` files are all under the coverage `include` globs; every file ships with tests, so the 80/76/78/66 thresholds should hold. If a renderer branch dips coverage, add an assertion rather than lowering the ratchet.
- **Deliberate v1 reduction vs spec §8:** the editor exposes only the transport-primary field (`command` for stdio, `url` for http/sse). Secondary fields (`args`, `env`, `headers`, and any other keys) are **preserved on edit** via `buildDef` (passthrough), but are not yet individually editable in the form. Structured editing of `args`/`env`/`headers` is a fast follow — call it out to the user during review if it must land in v1.
