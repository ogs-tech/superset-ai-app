# Cursor Adapter — Generated Files & Global Instruction (Plan B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Prerequisite:** Plan A (`2026-07-02-cursor-adapter-symlink-core.md`) is merged. This plan assumes `CursorAdapter`, the `adapters.cursor` setting, and the Settings toggle already exist.

**Goal:** Make the global `instruction` reach Cursor by *generating* a real `<repo>/AGENTS.md` in each linked repo (a "write" destination), with marker-based ownership so the app can safely overwrite, remove, and health-check the files it owns — and warn the user when no repo is linked.

**Architecture:** Introduce a `strategy` discriminant on `AdapterDestination`: `'symlink'` (today's behaviour, used by Claude and by Cursor skills/agents) and `'write'` (renders content and writes a generated file, used by Cursor's `instruction → AGENTS.md`). A new `FileMaterializer` (infrastructure) writes generated files, using a marker comment as its first line to distinguish app-owned files from the user's own — the ownership signal lives *in the file*, so no separate manifest. `AdapterManager` branches on `strategy` for sync/remove/count and gains `planGeneratedFiles()` / `removeAdapterGeneratedFiles()` / `removeAllGeneratedFiles()`. A `GeneratedFileCollector` health-checks each generated file and emits a "link a repo" warning. The Settings screen shows a matching banner.

**Tech Stack:** TypeScript (strict, ESM `.js` specifiers), Electron, Vitest (node + jsdom), React + MUI. Generated-file I/O goes through `WritableFileSystemPort`; timestamps through `ClockPort`.

## Global Constraints

- **Import specifiers use `.js`**; **strict TS** (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, …).
- **Hexagonal rule:** `FileMaterializer` is infrastructure and depends on `WritableFileSystemPort` + `ClockPort`; `AdapterManager` depends on the `FileMaterializer` type (application service) — no `node:fs` in services.
- **UI copy in pt-BR; identifiers/types/IPC in English.** No i18n framework.
- **Release gate:** `npm run lint && npm run typecheck && npm test` green at the end of every task.
- **Marker constant (verbatim):** `<!-- Managed by Superset AI — edits will be overwritten -->` — it MUST be the first line of every generated file so `content.startsWith(MARKER)` is a reliable ownership test.
- **Ownership rule:** the app only ever overwrites/removes a generated file whose content starts with the marker. A file without the marker is the user's — back it up before overwrite, never delete it.
- **`instruction` is frontmatter-free** on disk (its whole file is the body); the generated `AGENTS.md` is `MARKER` + blank line + that body. No frontmatter stripping is needed (there is none), contrary to the original spec wording written before the Entity refactor.
- **Backup scheme** mirrors `SymlinkManager`: `<workspace>/_backups/<UTC-timestamp>/<relative-path>`. `FileMaterializer` replicates this locally rather than refactoring `SymlinkManager` (no opportunistic refactor inside a feature).

---

## File Structure

**Created:**
- `src/main/application/services/file-materializer.ts` — writes/removes/validates generated files with marker ownership + backup-on-conflict. (Application service, symmetric to `SymlinkManager`.)
- `src/main/application/entity/agents-file.ts` — `GENERATED_FILE_MARKER` const + `renderAgentsFile(instruction)` pure renderer.
- `src/main/application/services/health/generated-file-collector.ts` — health checks for generated files + the "link a repo" warning.
- Tests: `tests/main/application/services/file-materializer.test.ts`, `tests/main/application/entity/agents-file.test.ts`, `tests/main/application/services/health/generated-file-collector.test.ts`, `tests/main/infrastructure/adapters/__tests__/cursor-adapter.agents-md.e2e.test.ts`, `tests/main/application/services/__tests__/adapter-manager.write-strategy.test.ts`, `tests/renderer/screens/settings/cursor-notice.test.tsx`.

**Modified:**
- `src/main/application/ports/adapter.ts` — `AdapterDestination` becomes a discriminated union on `strategy`.
- `src/main/infrastructure/adapters/claude-adapter.ts` — tag every destination `strategy: 'symlink'`.
- `src/main/infrastructure/adapters/cursor-adapter.ts` — tag skill/agent `symlink`; add `instruction → write` (per-repo AGENTS.md with rendered content).
- `src/main/application/services/__fixtures__/fake-adapter.ts` — tag destinations `strategy: 'symlink'`.
- `src/main/application/services/adapter-manager.ts` — inject `FileMaterializer`; branch sync/remove/count on `strategy`; `planDestinations` filters symlink; add `planGeneratedFiles`, `removeAdapterGeneratedFiles`, `removeAllGeneratedFiles`; export `GeneratedFilePlanEntry`.
- `src/main/application/services/workspace-teardown.ts` — also remove generated files on factory reset.
- `src/main/ipc/registry.ts` — `adapter.setEnabled` disable path also removes generated files; aggregate counts.
- `src/shared/health.ts` — add `'generated-file'` to `HealthCategory`.
- `src/renderer/screens/health/HealthScreen.tsx` — label + order for `'generated-file'`.
- `src/renderer/screens/Settings.tsx` — "link a repo" banner in the Adapters card.
- `src/main/index.ts` — construct `FileMaterializer`, pass to `AdapterManager`; add `GeneratedFileCollector`.
- Destination-shape test sweep (add `strategy: 'symlink'` to expected literals): `tests/main/infrastructure/adapters/__tests__/claude-adapter.entity-destinations.test.ts`, `tests/main/infrastructure/adapters/__tests__/cursor-adapter.entity-destinations.test.ts`.

---

### Task 1: `FileMaterializer` + marker/renderer for generated files

`FileMaterializer` is the write-side twin of `SymlinkManager`, keyed by a marker comment for ownership.

**Files:**
- Create: `src/main/application/entity/agents-file.ts`
- Create: `src/main/application/services/file-materializer.ts`
- Test: `tests/main/application/entity/agents-file.test.ts`
- Test: `tests/main/application/services/file-materializer.test.ts`

**Interfaces:**
- Consumes: `WritableFileSystemPort`, `ClockPort`, `DomainError`/`ioError`.
- Produces:
  - `GENERATED_FILE_MARKER: string` and `renderAgentsFile(instruction: Instruction): string` (marker + `\n\n` + body, body newline-normalised).
  - `class FileMaterializer` with `write({ destination, content }): Promise<FileMaterializeResult>`, `removeIfOwned({ destination }): Promise<{ removed: boolean }>`, `validate({ destination, content }): Promise<GeneratedFileState>`.
  - `type GeneratedFileState = 'ok' | 'missing' | 'drift' | 'foreign'`.
  - `interface FileMaterializeResult { status: 'ok' | 'conflict'; details?: { backupPath?: string; action?: 'overwritten' } }`.

- [ ] **Step 1: Write the failing `agents-file` test**

Create `tests/main/application/entity/agents-file.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { GENERATED_FILE_MARKER, renderAgentsFile } from '../../../../src/main/application/entity/agents-file.js';
import { WORKSPACE_SOURCE, type Instruction } from '../../../../src/shared/entity.js';

const instruction = (content: string): Instruction => ({
  urn: 'urn:instruction:default', kind: 'instruction', name: 'default', description: '',
  scopes: ['personal'], metadata: { version: '0.0.0', createdAt: '', updatedAt: '' },
  source: WORKSPACE_SOURCE, content, activation: 'always',
});

describe('renderAgentsFile', () => {
  it('prepends the marker as the first line', () => {
    const out = renderAgentsFile(instruction('Always reply in pt-BR.'));
    expect(out.startsWith(GENERATED_FILE_MARKER)).toBe(true);
  });

  it('separates the marker from the body with a blank line and preserves the body', () => {
    const out = renderAgentsFile(instruction('Line 1\nLine 2'));
    expect(out).toBe(`${GENERATED_FILE_MARKER}\n\nLine 1\nLine 2\n`);
  });

  it('does not double a trailing newline already present in the body', () => {
    const out = renderAgentsFile(instruction('Body\n'));
    expect(out).toBe(`${GENERATED_FILE_MARKER}\n\nBody\n`);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/main/application/entity/agents-file.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `agents-file.ts`**

Create `src/main/application/entity/agents-file.ts`:

```ts
import type { Instruction } from '../../../shared/entity.js';

/** First line of every app-generated file; the ownership signal. Keep verbatim. */
export const GENERATED_FILE_MARKER = '<!-- Managed by Superset AI — edits will be overwritten -->';

/**
 * Renders an `AGENTS.md` from the global instruction: the marker, a blank line,
 * then the instruction body (frontmatter-free on disk). The trailing newline is
 * normalised so the output is byte-stable for drift detection.
 */
export function renderAgentsFile(instruction: Instruction): string {
  const body = instruction.content.endsWith('\n') ? instruction.content : `${instruction.content}\n`;
  return `${GENERATED_FILE_MARKER}\n\n${body}`;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/main/application/entity/agents-file.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing `FileMaterializer` test**

Create `tests/main/application/services/file-materializer.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { FileMaterializer } from '../../../../src/main/application/services/file-materializer.js';
import { GENERATED_FILE_MARKER } from '../../../../src/main/application/entity/agents-file.js';
import { InMemoryFileSystem } from '../../../../src/main/infrastructure/filesystem/in-memory-filesystem.js';
import { FixedClock } from '../../../../src/main/infrastructure/clock/fixed-clock.js';

const WS = '/workspace';
const owned = (body: string) => `${GENERATED_FILE_MARKER}\n\n${body}\n`;

const make = () => {
  const fs = new InMemoryFileSystem();
  const materializer = new FileMaterializer(fs, new FixedClock(new Date('2026-07-02T10:00:00.000Z')), WS);
  return { fs, materializer };
};

describe('FileMaterializer.write', () => {
  it('creates a new file when the destination is empty', async () => {
    const { fs, materializer } = make();
    const result = await materializer.write({ destination: '/repos/app/AGENTS.md', content: owned('hi') });
    expect(result.status).toBe('ok');
    expect(await fs.readFile('/repos/app/AGENTS.md')).toBe(owned('hi'));
  });

  it('overwrites an app-owned file without a backup', async () => {
    const { fs, materializer } = make();
    fs.createFile('/repos/app/AGENTS.md', owned('old'));
    const result = await materializer.write({ destination: '/repos/app/AGENTS.md', content: owned('new') });
    expect(result.status).toBe('ok');
    expect(result.details?.backupPath).toBeUndefined();
    expect(await fs.readFile('/repos/app/AGENTS.md')).toBe(owned('new'));
  });

  it('backs up a foreign file before overwriting, reporting conflict', async () => {
    const { fs, materializer } = make();
    fs.createFile('/repos/app/AGENTS.md', 'user hand-written content\n');
    const result = await materializer.write({ destination: '/repos/app/AGENTS.md', content: owned('new') });
    expect(result.status).toBe('conflict');
    expect(result.details?.backupPath).toContain('/workspace/_backups/');
    expect(await fs.readFile(result.details!.backupPath!)).toBe('user hand-written content\n');
    expect(await fs.readFile('/repos/app/AGENTS.md')).toBe(owned('new'));
  });
});

describe('FileMaterializer.removeIfOwned', () => {
  it('removes an owned file', async () => {
    const { fs, materializer } = make();
    fs.createFile('/repos/app/AGENTS.md', owned('x'));
    expect(await materializer.removeIfOwned({ destination: '/repos/app/AGENTS.md' })).toEqual({ removed: true });
    expect(await fs.pathExists('/repos/app/AGENTS.md')).toBe(false);
  });

  it('leaves a foreign file untouched', async () => {
    const { fs, materializer } = make();
    fs.createFile('/repos/app/AGENTS.md', 'not ours\n');
    expect(await materializer.removeIfOwned({ destination: '/repos/app/AGENTS.md' })).toEqual({ removed: false });
    expect(await fs.pathExists('/repos/app/AGENTS.md')).toBe(true);
  });

  it('is a no-op when the file is absent', async () => {
    const { materializer } = make();
    expect(await materializer.removeIfOwned({ destination: '/nope/AGENTS.md' })).toEqual({ removed: false });
  });
});

describe('FileMaterializer.validate', () => {
  it('returns ok / drift / missing / foreign', async () => {
    const { fs, materializer } = make();
    const content = owned('current');
    expect(await materializer.validate({ destination: '/a/AGENTS.md', content })).toBe('missing');
    fs.createFile('/a/AGENTS.md', content);
    expect(await materializer.validate({ destination: '/a/AGENTS.md', content })).toBe('ok');
    fs.createFile('/b/AGENTS.md', owned('stale'));
    expect(await materializer.validate({ destination: '/b/AGENTS.md', content })).toBe('drift');
    fs.createFile('/c/AGENTS.md', 'foreign\n');
    expect(await materializer.validate({ destination: '/c/AGENTS.md', content })).toBe('foreign');
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run tests/main/application/services/file-materializer.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 7: Implement `FileMaterializer`**

Create `src/main/application/services/file-materializer.ts`:

```ts
import { dirname, relative, resolve } from 'node:path';
import type { WritableFileSystemPort } from '../ports/writable-filesystem-port.js';
import type { ClockPort } from '../ports/clock-port.js';
import { GENERATED_FILE_MARKER } from '../entity/agents-file.js';
import { DomainError, ioError } from '../../domain/errors.js';

export type GeneratedFileState = 'ok' | 'missing' | 'drift' | 'foreign';

export interface FileMaterializeResult {
  status: 'ok' | 'conflict';
  details?: { backupPath?: string; action?: 'overwritten' };
}

/**
 * Write-side twin of SymlinkManager for app-generated files (e.g. <repo>/AGENTS.md).
 * Ownership is signalled by GENERATED_FILE_MARKER on the file's first line: the app
 * only overwrites/removes files it owns; a foreign file is backed up before overwrite
 * and never deleted. Backup scheme mirrors SymlinkManager: <workspace>/_backups/<ts>/<rel>.
 */
export class FileMaterializer {
  constructor(
    private readonly fs: WritableFileSystemPort,
    private readonly clock: ClockPort,
    private readonly workspacePath: string,
  ) {}

  async write(args: { destination: string; content: string }): Promise<FileMaterializeResult> {
    const dest = resolve(args.destination);
    try {
      await this.fs.mkdir(dirname(dest), { recursive: true });
      const stat = await this.fs.lstat(dest);
      if (stat.kind === 'none') {
        await this.fs.writeFile(dest, args.content);
        return { status: 'ok' };
      }
      const existing = await this.fs.readFile(dest);
      if (this.isOwned(existing)) {
        await this.fs.writeFile(dest, args.content);
        return { status: 'ok' };
      }
      const backupPath = await this.backup(dest, existing);
      await this.fs.writeFile(dest, args.content);
      return { status: 'conflict', details: { backupPath, action: 'overwritten' } };
    } catch (err) {
      if (err instanceof DomainError) throw err;
      if (err instanceof Error) {
        const details: { code?: string } = {};
        const code = (err as { code?: string }).code;
        if (code !== undefined) details.code = code;
        throw ioError({ message: err.message, details });
      }
      throw err;
    }
  }

  async removeIfOwned(args: { destination: string }): Promise<{ removed: boolean }> {
    const dest = resolve(args.destination);
    const stat = await this.fs.lstat(dest);
    if (stat.kind === 'none') return { removed: false };
    const existing = await this.fs.readFile(dest);
    if (!this.isOwned(existing)) return { removed: false };
    await this.fs.unlink(dest);
    return { removed: true };
  }

  async validate(args: { destination: string; content: string }): Promise<GeneratedFileState> {
    const dest = resolve(args.destination);
    const stat = await this.fs.lstat(dest);
    if (stat.kind === 'none') return 'missing';
    const existing = await this.fs.readFile(dest);
    if (!this.isOwned(existing)) return 'foreign';
    return existing === args.content ? 'ok' : 'drift';
  }

  private isOwned(content: string): boolean {
    return content.startsWith(GENERATED_FILE_MARKER);
  }

  private async backup(destinationPath: string, content: string): Promise<string> {
    let relativeTarget = relative(this.workspacePath, destinationPath);
    if (relativeTarget.startsWith('..')) {
      relativeTarget = destinationPath.replace(/^\/+/, '');
      if (relativeTarget === '') {
        throw ioError({
          message: `Cannot derive backup path for: ${destinationPath}`,
          details: { reason: 'backup-path-undeterminable' },
        });
      }
    }
    const backupPath = await this.nextBackupPath(relativeTarget, this.timestampForNow());
    await this.fs.mkdir(dirname(backupPath), { recursive: true });
    await this.fs.writeFile(backupPath, content);
    return backupPath;
  }

  private timestampForNow(): string {
    const now = this.clock.now();
    const pad = (v: number) => String(v).padStart(2, '0');
    return (
      `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
      `T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`
    );
  }

  private async nextBackupPath(relativeTarget: string, timestamp: string): Promise<string> {
    let attempt = 0;
    while (true) {
      const suffix = attempt === 0 ? '' : `-${attempt}`;
      const backupPath = resolve(this.workspacePath, '_backups', `${timestamp}${suffix}`, relativeTarget);
      if (!(await this.fs.pathExists(backupPath))) return backupPath;
      attempt += 1;
    }
  }
}
```

- [ ] **Step 8: Run it to verify it passes, then commit**

Run: `npx vitest run tests/main/application/services/file-materializer.test.ts tests/main/application/entity/agents-file.test.ts`
Expected: PASS.

```bash
git add src/main/application/entity/agents-file.ts src/main/application/services/file-materializer.ts tests/main/application/entity/agents-file.test.ts tests/main/application/services/file-materializer.test.ts
git commit -m "feat(cursor): add FileMaterializer and AGENTS.md renderer with marker ownership"
```

---

### Task 2: `strategy` discriminant on the port + `AdapterManager` write plumbing

Introduce the discriminant and teach `AdapterManager` to branch — **without any adapter emitting `write` destinations yet** (that arrives in Task 4). Everything stays behaviourally identical; only shapes change. This is where the destination-shape test sweep happens.

**Files:**
- Modify: `src/main/application/ports/adapter.ts`
- Modify: `src/main/infrastructure/adapters/claude-adapter.ts`
- Modify: `src/main/infrastructure/adapters/cursor-adapter.ts`
- Modify: `src/main/application/services/__fixtures__/fake-adapter.ts`
- Modify: `src/main/application/services/adapter-manager.ts`
- Modify: `src/main/index.ts`
- Sweep: `tests/main/infrastructure/adapters/__tests__/claude-adapter.entity-destinations.test.ts`, `.../cursor-adapter.entity-destinations.test.ts`
- Test: `tests/main/application/services/__tests__/adapter-manager.write-strategy.test.ts`

**Interfaces:**
- Consumes: `FileMaterializer` (Task 1).
- Produces:
  - `AdapterDestination = { scope; destination; strategy: 'symlink' } | { scope; destination; strategy: 'write'; content: string }`.
  - `AdapterManagerDeps` gains `fileMaterializer: FileMaterializer`.
  - `AdapterManager.planGeneratedFiles(): Promise<GeneratedFilePlanEntry[]>` where `GeneratedFilePlanEntry = { adapterId: string; destination: string; content: string }`.
  - `planDestinations()` now returns only `strategy: 'symlink'` entries.
  - `syncDestination`/`removeDestination` take the full `AdapterDestination` and branch on `strategy`.

- [ ] **Step 1: Change the port to a discriminated union**

Replace `src/main/application/ports/adapter.ts` body:

```ts
import type { LinkedRepo } from '../../../shared/settings.js';
import type { Entity } from '../../../shared/entity.js';

export type AdapterDestination =
  | { scope: 'personal' | 'project'; destination: string; strategy: 'symlink' }
  | { scope: 'personal' | 'project'; destination: string; strategy: 'write'; content: string };

export interface Adapter {
  adapterId: string;
  resolveEntityDestinations(args: {
    entity: Entity;
    linkedRepos: LinkedRepo[];
  }): Promise<AdapterDestination[]> | AdapterDestination[];
}
```

- [ ] **Step 2: Run typecheck to see the blast radius**

Run: `npm run typecheck`
Expected: errors in `claude-adapter.ts`, `cursor-adapter.ts`, `fake-adapter.ts` (destinations missing `strategy`), and in the two `*.entity-destinations.test.ts` files (expected literals missing `strategy`). This list drives Steps 3-5.

- [ ] **Step 3: Tag adapter destinations `strategy: 'symlink'`**

In `src/main/infrastructure/adapters/claude-adapter.ts`, add `strategy: 'symlink'` to all four `push`/return objects. The instruction return becomes:

```ts
    if (kind === 'instruction') {
      return [
        { scope: 'personal', destination: join(this.homedir, '.claude/CLAUDE.md'), strategy: 'symlink' },
        { scope: 'personal', destination: join(this.homedir, 'AGENTS.md'), strategy: 'symlink' },
      ];
    }
```

and the skill/agent pushes:

```ts
    if (scopes.includes('personal')) {
      out.push({ scope: 'personal', destination: join(this.homedir, subfolder, fileName), strategy: 'symlink' });
    }
    if (scopes.includes('project')) {
      for (const repo of args.linkedRepos) {
        out.push({ scope: 'project', destination: join(repo.path, subfolder, fileName), strategy: 'symlink' });
      }
    }
```

In `src/main/infrastructure/adapters/cursor-adapter.ts`, add `strategy: 'symlink'` to both skill/agent pushes (same edit; leave the `instruction → []` for Task 4). In `src/main/application/services/__fixtures__/fake-adapter.ts`, add `strategy: 'symlink'` to both pushes:

```ts
    if (scopes.includes('personal')) {
      out.push({ scope: 'personal', destination: this.personalDestination, strategy: 'symlink' });
    }
    if (scopes.includes('project')) {
      for (const repo of args.linkedRepos) {
        out.push({ scope: 'project', destination: this.projectDestinationTemplate(repo.path), strategy: 'symlink' });
      }
    }
```

- [ ] **Step 4: Update the destination-shape test expectations**

In `tests/main/infrastructure/adapters/__tests__/claude-adapter.entity-destinations.test.ts` and `tests/main/infrastructure/adapters/__tests__/cursor-adapter.entity-destinations.test.ts`, add `strategy: 'symlink'` to every expected destination literal. Example (claude, first case):

```ts
    expect(adapter.resolveEntityDestinations({ entity: skill, linkedRepos: [] })).toEqual([
      { scope: 'personal', destination: '/home/u/.claude/skills/demo', strategy: 'symlink' },
    ]);
```

Apply the same addition to every `toEqual([...])` destination in both files (skills, agents, instruction, multi-scope). The `preserves spaces and accents` case in the claude test reads `personal?.destination` only — no change needed there.

- [ ] **Step 5: Branch `AdapterManager` on `strategy` and inject the materializer**

In `src/main/application/services/adapter-manager.ts`:

(a) Add the import and dep:

```ts
import type { FileMaterializer } from './file-materializer.js';
```

```ts
export interface AdapterManagerDeps {
  settingsService: SettingsService;
  entityRepository: EntityRepository;
  symlinkManager: SymlinkManager;
  fileMaterializer: FileMaterializer;
  adapters: Map<string, Adapter>;
  workspacePath: string;
}
```

(b) Add the plan-entry type near `SymlinkPlanEntry`:

```ts
export interface GeneratedFilePlanEntry {
  adapterId: string;
  destination: string;
  content: string;
}
```

(c) In `syncAll` and `syncEntity`, pass the whole destination object to `syncDestination` (replace `destination.destination` with `destination`):

```ts
        for (const destination of destinations) {
          results.push(
            await this.syncDestination(
              adapter.adapterId,
              this.entitySourcePath(entity, this.deps.workspacePath),
              destination,
            ),
          );
        }
```

(In `syncEntity` the source is already computed as `source`; call `this.syncDestination(adapter.adapterId, source, destination)`.)

(d) In `removeEntity` and `removeAll`, pass the whole destination to `removeDestination` (replace `destination.destination` with `destination`):

```ts
      for (const destination of destinations) {
        results.push(await this.removeDestination(adapter.adapterId, destination));
      }
```

(e) Replace the `syncDestination` signature/body to branch:

```ts
  private async syncDestination(
    adapterId: string,
    source: string,
    dest: AdapterDestination,
  ): Promise<SyncResult> {
    if (dest.strategy === 'write') {
      return this.writeDestination(adapterId, dest);
    }
    try {
      const result = await this.deps.symlinkManager.create({ source, destination: dest.destination });
      const payload: SyncResult = { adapter: adapterId, destination: dest.destination, status: result.status };
      if (result.status === 'conflict') {
        payload.message = 'Overwrote existing destination and created a backup';
      }
      if (result.details !== undefined) payload.details = result.details;
      return payload;
    } catch (err) {
      return this.symlinkError(adapterId, dest.destination, err);
    }
  }

  private async writeDestination(adapterId: string, dest: Extract<AdapterDestination, { strategy: 'write' }>): Promise<SyncResult> {
    try {
      const result = await this.deps.fileMaterializer.write({ destination: dest.destination, content: dest.content });
      const payload: SyncResult = { adapter: adapterId, destination: dest.destination, status: result.status };
      if (result.status === 'conflict') payload.message = 'Overwrote an existing file and created a backup';
      if (result.details !== undefined) payload.details = result.details as SyncResultDetails;
      return payload;
    } catch (err) {
      return this.symlinkError(adapterId, dest.destination, err);
    }
  }
```

Extract the existing symlink-error mapping (currently inline in the old `syncDestination` catch) into a private helper reused by both branches:

```ts
  private symlinkError(adapterId: string, destination: string, err: unknown): SyncResult {
    if (err instanceof DomainError && err.kind === 'symlink_conflict') {
      return { adapter: adapterId, destination, status: 'conflict', message: err.message, details: err.details as SyncResultDetails };
    }
    if (err instanceof DomainError) {
      const payload: SyncResult = { adapter: adapterId, destination, status: 'error', message: err.message };
      if (err.details !== undefined) payload.details = err.details as SyncResultDetails;
      return payload;
    }
    return { adapter: adapterId, destination, status: 'error', message: err instanceof Error ? err.message : 'Unknown error' };
  }
```

(f) Replace `removeDestination` to take the full destination and branch:

```ts
  private async removeDestination(adapterId: string, dest: AdapterDestination): Promise<SyncResult> {
    try {
      const result =
        dest.strategy === 'write'
          ? await this.deps.fileMaterializer.removeIfOwned({ destination: dest.destination })
          : await this.deps.symlinkManager.removeIfExists({ destination: dest.destination });
      const payload: SyncResult = { adapter: adapterId, destination: dest.destination, status: 'ok' };
      if (!result.removed) payload.details = { skipped: 'not-found' };
      return payload;
    } catch (err) {
      return this.symlinkError(adapterId, dest.destination, err);
    }
  }
```

(g) In `planDestinations`, skip non-symlink destinations:

```ts
        for (const dest of destinations) {
          if (dest.strategy !== 'symlink') continue;
          entries.push({ adapterId: adapter.adapterId, source, destination: dest.destination, scope: dest.scope });
        }
```

(h) Add `planGeneratedFiles` after `planDestinations`:

```ts
  /** Read-only plan of every generated (write) destination across enabled adapters. */
  async planGeneratedFiles(): Promise<GeneratedFilePlanEntry[]> {
    const settings = (await this.deps.settingsService.load()) ?? this.deps.settingsService.getDefaults();
    const enabledAdapters = this.enabledAdapters(settings);
    const entities = await this.deps.entityRepository.list();
    const entries: GeneratedFilePlanEntry[] = [];
    for (const entity of entities) {
      for (const adapter of enabledAdapters) {
        const destinations = await adapter.resolveEntityDestinations({ entity, linkedRepos: settings.linkedRepos });
        for (const dest of destinations) {
          if (dest.strategy !== 'write') continue;
          entries.push({ adapterId: adapter.adapterId, destination: dest.destination, content: dest.content });
        }
      }
    }
    return entries;
  }
```

> Note: after this refactor, `AdapterDestination` must be imported in `adapter-manager.ts` (it already imports `Adapter`; extend to `import type { Adapter, AdapterDestination } from '../ports/adapter.js';`).

- [ ] **Step 6: Wire `FileMaterializer` into the composition root**

In `src/main/index.ts`, construct it after `symlinkManager` (line ~91) and pass to `AdapterManager`:

```ts
import { FileMaterializer } from './application/services/file-materializer.js';
```

```ts
  const symlinkManager = new SymlinkManager(new NodeFsAdapter(), clock, workspacePath);
  const nodeFsAdapter = new NodeFsAdapter();
  const fileMaterializer = new FileMaterializer(nodeFsAdapter, clock, workspacePath);
  const claudeAdapter = new ClaudeAdapter({ homedir: homedir() });
  const cursorAdapter = new CursorAdapter({ homedir: homedir() });
  const entityRepository = new FsEntityRepository(workspacePath);
  const adapterManager = new AdapterManager({
    settingsService,
    entityRepository,
    symlinkManager,
    fileMaterializer,
    workspacePath,
    adapters: new Map<string, Adapter>([
      [claudeAdapter.adapterId, claudeAdapter],
      [cursorAdapter.adapterId, cursorAdapter],
    ]),
  });
```

- [ ] **Step 7: Write the write-strategy manager test**

Create `tests/main/application/services/__tests__/adapter-manager.write-strategy.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { AdapterManager } from '../../../../../src/main/application/services/adapter-manager.js';
import { FileMaterializer } from '../../../../../src/main/application/services/file-materializer.js';
import { SymlinkManager } from '../../../../../src/main/application/services/symlink-manager.js';
import { InMemoryEntityRepository } from '../../../../../src/main/infrastructure/entity/in-memory-entity-repository.js';
import { InMemorySettingsRepository } from '../../../../../src/main/infrastructure/settings/in-memory-settings-repository.js';
import { InMemoryFileSystem } from '../../../../../src/main/infrastructure/filesystem/in-memory-filesystem.js';
import { FixedClock } from '../../../../../src/main/infrastructure/clock/fixed-clock.js';
import { SettingsService } from '../../../../../src/main/application/services/settings-service.js';
import { GENERATED_FILE_MARKER } from '../../../../../src/main/application/entity/agents-file.js';
import type { Adapter, AdapterDestination } from '../../../../../src/main/application/ports/adapter.js';
import type { Settings } from '../../../../../src/shared/settings.js';
import { WORKSPACE_SOURCE, type Entity, type Skill } from '../../../../../src/shared/entity.js';

// Minimal adapter that emits ONE write destination carrying content.
class WriteOnlyAdapter implements Adapter {
  readonly adapterId = 'writer';
  constructor(private readonly destination: string, private readonly content: string) {}
  resolveEntityDestinations(): AdapterDestination[] {
    return [{ scope: 'project', destination: this.destination, strategy: 'write', content: this.content }];
  }
}

const settings: Settings = {
  adapters: { claude: { enabled: true }, cursor: { enabled: true } },
  linkedRepos: [{ id: 'r', name: 'app', path: '/repos/app' }],
  ui: { theme: 'system' }, language: 'off',
};

const skill: Skill = {
  urn: 'urn:skill:demo', kind: 'skill', name: 'demo', description: 'd', scopes: ['project'],
  metadata: { version: '1.0.0', createdAt: '', updatedAt: '' }, source: WORKSPACE_SOURCE, content: 'b',
};

const setup = async () => {
  const settingsRepo = new InMemorySettingsRepository();
  await settingsRepo.save(settings);
  const settingsService = new SettingsService(settingsRepo);
  const entityRepository = new InMemoryEntityRepository();
  await entityRepository.save(skill as Entity);
  const fs = new InMemoryFileSystem();
  const clock = new FixedClock(new Date('2026-07-02T10:00:00.000Z'));
  const content = `${GENERATED_FILE_MARKER}\n\nhello\n`;
  const manager = new AdapterManager({
    settingsService, entityRepository,
    symlinkManager: new SymlinkManager(fs, clock, '/workspace'),
    fileMaterializer: new FileMaterializer(fs, clock, '/workspace'),
    workspacePath: '/workspace',
    adapters: new Map<string, Adapter>([['writer', new WriteOnlyAdapter('/repos/app/AGENTS.md', content)]]),
  });
  // Enable the 'writer' adapter via settings (enabledAdapters reads settings.adapters[id]).
  await settingsService.merge({ adapters: { cursor: { enabled: true } } });
  return { manager, fs, content };
};

describe('AdapterManager write-strategy sync', () => {
  it('materializes a write destination via syncAll', async () => {
    const { manager, fs, content } = await setup();
    // Register the writer adapter under an id present in settings by using cursor's slot:
    // simplest: assert planGeneratedFiles surfaces the write entry.
    const plan = await manager.planGeneratedFiles();
    expect(plan.length === 0 || plan[0]?.content === content).toBe(true);
    // Direct sync check through the materializer path:
    await fs; // no-op to keep fs referenced
  });
});
```

> The `WriteOnlyAdapter` is registered under id `'writer'`, which is not in `settings.adapters`, so `enabledAdapters` filters it out — `planGeneratedFiles` returns `[]`. To exercise the write path end-to-end, prefer the **Task 4 e2e test** (real `CursorAdapter` + `instruction`, registered under `'cursor'` which *is* enabled). Keep this task's test focused on the unit-level branch: assert `syncDestination` routes `strategy: 'write'` to the materializer by calling the private path through a public method. Simplest reliable assertion here: build the manager with the writer adapter **registered under `'cursor'`** so it is enabled:

Replace the adapters map and drop the merge line:

```ts
    adapters: new Map<string, Adapter>([['cursor', { ...new WriteOnlyAdapter('/repos/app/AGENTS.md', content), adapterId: 'cursor' }]]),
```

Then assert:

```ts
  it('materializes a write destination via syncAll', async () => {
    const { manager, fs, content } = await setup();
    const results = await manager.syncAll({ adapterId: 'cursor' });
    expect(results.some((r) => r.destination === '/repos/app/AGENTS.md' && r.status === 'ok')).toBe(true);
    expect(await fs.readFile('/repos/app/AGENTS.md')).toBe(content);
  });

  it('removeAll deletes the owned generated file', async () => {
    const { manager, fs } = await setup();
    await manager.syncAll({ adapterId: 'cursor' });
    await manager.removeAll({ adapterId: 'cursor' });
    expect(await fs.pathExists('/repos/app/AGENTS.md')).toBe(false);
  });
```

(Use whichever registration keeps the adapter enabled; the key requirement is `adapterId === 'cursor'` so `enabledAdapters` includes it.)

- [ ] **Step 8: Run the sweep + new test + full gate**

Run: `npm run typecheck && npx vitest run tests/main/application/services/__tests__/adapter-manager.write-strategy.test.ts tests/main/infrastructure/adapters/__tests__/claude-adapter.entity-destinations.test.ts tests/main/infrastructure/adapters/__tests__/cursor-adapter.entity-destinations.test.ts && npm test`
Expected: all green.

- [ ] **Step 9: Commit**

```bash
git add src/main/application/ports/adapter.ts src/main/infrastructure/adapters/ src/main/application/services/__fixtures__/fake-adapter.ts src/main/application/services/adapter-manager.ts src/main/index.ts tests/
git commit -m "feat(cursor): add write strategy to the adapter port and AdapterManager plumbing"
```

---

### Task 3: `CursorAdapter` emits the `instruction → AGENTS.md` write destination

Now that the plumbing exists, make Cursor actually generate `<repo>/AGENTS.md`.

**Files:**
- Modify: `src/main/infrastructure/adapters/cursor-adapter.ts`
- Modify: `tests/main/infrastructure/adapters/__tests__/cursor-adapter.entity-destinations.test.ts`
- Test: `tests/main/infrastructure/adapters/__tests__/cursor-adapter.agents-md.e2e.test.ts`

**Interfaces:**
- Consumes: `renderAgentsFile` (Task 1).
- Produces: for an `instruction` entity, `CursorAdapter` returns one `{ scope: 'project', destination: '<repo>/AGENTS.md', strategy: 'write', content: renderAgentsFile(instruction) }` per linked repo (and `[]` when no repos). Skills/agents unchanged.

- [ ] **Step 1: Update the destination test for instruction**

In `tests/main/infrastructure/adapters/__tests__/cursor-adapter.entity-destinations.test.ts`, replace the "returns [] for an instruction" case with:

```ts
  it('routes an instruction to a generated AGENTS.md in each linked repo', () => {
    const ins: Instruction = { urn: 'urn:instruction:default', kind: 'instruction', name: 'default',
      description: '', scopes: ['personal'], metadata: meta, source: WORKSPACE_SOURCE, content: 'Reply in pt-BR.', activation: 'always' };
    const linkedRepos: LinkedRepo[] = [
      { id: 'r1', name: 'app', path: '/repos/app' },
      { id: 'r2', name: 'lib', path: '/repos/lib' },
    ];
    const out = adapter.resolveEntityDestinations({ entity: ins, linkedRepos });
    expect(out).toEqual([
      { scope: 'project', destination: '/repos/app/AGENTS.md', strategy: 'write', content: `${GENERATED_FILE_MARKER}\n\nReply in pt-BR.\n` },
      { scope: 'project', destination: '/repos/lib/AGENTS.md', strategy: 'write', content: `${GENERATED_FILE_MARKER}\n\nReply in pt-BR.\n` },
    ]);
  });

  it('returns [] for an instruction when no repo is linked', () => {
    const ins: Instruction = { urn: 'urn:instruction:default', kind: 'instruction', name: 'default',
      description: '', scopes: ['personal'], metadata: meta, source: WORKSPACE_SOURCE, content: 'x', activation: 'always' };
    expect(adapter.resolveEntityDestinations({ entity: ins, linkedRepos: [] })).toEqual([]);
  });
```

Add the marker import at the top of the test file:

```ts
import { GENERATED_FILE_MARKER } from '../../../../../src/main/application/entity/agents-file.js';
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/main/infrastructure/adapters/__tests__/cursor-adapter.entity-destinations.test.ts`
Expected: FAIL — instruction currently resolves to `[]`.

- [ ] **Step 3: Implement the instruction branch**

In `src/main/infrastructure/adapters/cursor-adapter.ts`, add imports and handle `instruction` before the skill/agent guard:

```ts
import { renderAgentsFile } from '../../application/entity/agents-file.js';
import type { Entity, Instruction } from '../../../shared/entity.js';
```

```ts
  resolveEntityDestinations(args: {
    entity: Entity;
    linkedRepos: LinkedRepo[];
  }): AdapterDestination[] {
    const { kind, name, scopes } = args.entity;

    if (kind === 'instruction') {
      // Cursor has no home-level instruction file; the global instruction (scope
      // personal) is materialized as <repo>/AGENTS.md in every linked repo.
      const content = renderAgentsFile(args.entity as Instruction);
      return args.linkedRepos.map((repo) => ({
        scope: 'project' as const,
        destination: join(repo.path, 'AGENTS.md'),
        strategy: 'write' as const,
        content,
      }));
    }

    if (kind !== 'skill' && kind !== 'agent') {
      return [];
    }
    // …unchanged skill/agent symlink logic…
  }
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/main/infrastructure/adapters/__tests__/cursor-adapter.entity-destinations.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the end-to-end materialize test**

Create `tests/main/infrastructure/adapters/__tests__/cursor-adapter.agents-md.e2e.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CursorAdapter } from '../../../../../src/main/infrastructure/adapters/cursor-adapter.js';
import { ClaudeAdapter } from '../../../../../src/main/infrastructure/adapters/claude-adapter.js';
import { AdapterManager } from '../../../../../src/main/application/services/adapter-manager.js';
import { FileMaterializer } from '../../../../../src/main/application/services/file-materializer.js';
import { SymlinkManager } from '../../../../../src/main/application/services/symlink-manager.js';
import { SettingsService } from '../../../../../src/main/application/services/settings-service.js';
import { InMemoryEntityRepository } from '../../../../../src/main/infrastructure/entity/in-memory-entity-repository.js';
import { InMemorySettingsRepository } from '../../../../../src/main/infrastructure/settings/in-memory-settings-repository.js';
import { InMemoryFileSystem } from '../../../../../src/main/infrastructure/filesystem/in-memory-filesystem.js';
import { FixedClock } from '../../../../../src/main/infrastructure/clock/fixed-clock.js';
import { GENERATED_FILE_MARKER } from '../../../../../src/main/application/entity/agents-file.js';
import type { Adapter } from '../../../../../src/main/application/ports/adapter.js';
import type { Settings } from '../../../../../src/shared/settings.js';
import { WORKSPACE_SOURCE, type Entity, type Instruction } from '../../../../../src/shared/entity.js';

const instruction: Instruction = {
  urn: 'urn:instruction:default', kind: 'instruction', name: 'default', description: '',
  scopes: ['personal'], metadata: { version: '1.0.0', createdAt: '', updatedAt: '' },
  source: WORKSPACE_SOURCE, content: 'Reply in pt-BR.', activation: 'always',
};

const settings: Settings = {
  adapters: { claude: { enabled: true }, cursor: { enabled: true } },
  linkedRepos: [{ id: 'r', name: 'app', path: '/repos/app' }],
  ui: { theme: 'system' }, language: 'off',
};

describe('Cursor instruction → AGENTS.md (e2e)', () => {
  it('materializes AGENTS.md on syncAll and removes it on removeAll', async () => {
    const settingsRepo = new InMemorySettingsRepository();
    await settingsRepo.save(settings);
    const settingsService = new SettingsService(settingsRepo);
    const entityRepository = new InMemoryEntityRepository();
    await entityRepository.save(instruction as Entity);
    const fs = new InMemoryFileSystem();
    const clock = new FixedClock(new Date('2026-07-02T10:00:00.000Z'));
    const manager = new AdapterManager({
      settingsService, entityRepository,
      symlinkManager: new SymlinkManager(fs, clock, '/workspace'),
      fileMaterializer: new FileMaterializer(fs, clock, '/workspace'),
      workspacePath: '/workspace',
      adapters: new Map<string, Adapter>([
        ['claude', new ClaudeAdapter({ homedir: '/home/u' })],
        ['cursor', new CursorAdapter({ homedir: '/home/u' })],
      ]),
    });

    await manager.syncAll({ adapterId: 'cursor' });
    expect(await fs.readFile('/repos/app/AGENTS.md')).toBe(`${GENERATED_FILE_MARKER}\n\nReply in pt-BR.\n`);

    await manager.removeAll({ adapterId: 'cursor' });
    expect(await fs.pathExists('/repos/app/AGENTS.md')).toBe(false);
  });
});
```

- [ ] **Step 6: Run it, then commit**

Run: `npx vitest run tests/main/infrastructure/adapters/__tests__/cursor-adapter.agents-md.e2e.test.ts && npm run typecheck`
Expected: PASS + clean.

```bash
git add src/main/infrastructure/adapters/cursor-adapter.ts tests/main/infrastructure/adapters/__tests__/
git commit -m "feat(cursor): materialize the global instruction as per-repo AGENTS.md"
```

---

### Task 4: Generated-file lifecycle — count, disable-cleanup, factory reset

Generated files must be counted (for the disable modal), removed when the adapter is disabled, and removed on factory reset — the same guarantees symlinks already have.

**Files:**
- Modify: `src/main/application/services/adapter-manager.ts`
- Modify: `src/main/ipc/registry.ts`
- Modify: `src/main/application/services/workspace-teardown.ts`
- Test: `tests/main/application/services/__tests__/adapter-manager.generated-files.test.ts`
- Modify (assertions): whichever teardown test exists — see Step 7.

**Interfaces:**
- Produces on `AdapterManager`:
  - `removeAdapterGeneratedFiles(adapterId): Promise<RemoveAdapterResult>` — marker-guarded delete of every write destination for one adapter.
  - `removeAllGeneratedFiles(): Promise<RemoveAdapterResult>` — across all adapters.
  - `countDestinations` now also counts present, owned generated files.
- `WorkspaceTeardownService` constructor dep widens to `Pick<AdapterManager, 'removeAllAdapterSymlinks' | 'removeAllGeneratedFiles'>`.

- [ ] **Step 1: Write the failing lifecycle test**

Create `tests/main/application/services/__tests__/adapter-manager.generated-files.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CursorAdapter } from '../../../../../src/main/infrastructure/adapters/cursor-adapter.js';
import { AdapterManager } from '../../../../../src/main/application/services/adapter-manager.js';
import { FileMaterializer } from '../../../../../src/main/application/services/file-materializer.js';
import { SymlinkManager } from '../../../../../src/main/application/services/symlink-manager.js';
import { SettingsService } from '../../../../../src/main/application/services/settings-service.js';
import { InMemoryEntityRepository } from '../../../../../src/main/infrastructure/entity/in-memory-entity-repository.js';
import { InMemorySettingsRepository } from '../../../../../src/main/infrastructure/settings/in-memory-settings-repository.js';
import { InMemoryFileSystem } from '../../../../../src/main/infrastructure/filesystem/in-memory-filesystem.js';
import { FixedClock } from '../../../../../src/main/infrastructure/clock/fixed-clock.js';
import type { Adapter } from '../../../../../src/main/application/ports/adapter.js';
import type { Settings } from '../../../../../src/shared/settings.js';
import { WORKSPACE_SOURCE, type Entity, type Instruction } from '../../../../../src/shared/entity.js';

const instruction: Instruction = {
  urn: 'urn:instruction:default', kind: 'instruction', name: 'default', description: '',
  scopes: ['personal'], metadata: { version: '1.0.0', createdAt: '', updatedAt: '' },
  source: WORKSPACE_SOURCE, content: 'body', activation: 'always',
};
const settings: Settings = {
  adapters: { claude: { enabled: false }, cursor: { enabled: true } },
  linkedRepos: [{ id: 'r', name: 'app', path: '/repos/app' }],
  ui: { theme: 'system' }, language: 'off',
};

const setup = async () => {
  const settingsRepo = new InMemorySettingsRepository();
  await settingsRepo.save(settings);
  const settingsService = new SettingsService(settingsRepo);
  const entityRepository = new InMemoryEntityRepository();
  await entityRepository.save(instruction as Entity);
  const fs = new InMemoryFileSystem();
  const clock = new FixedClock(new Date('2026-07-02T10:00:00.000Z'));
  const manager = new AdapterManager({
    settingsService, entityRepository,
    symlinkManager: new SymlinkManager(fs, clock, '/workspace'),
    fileMaterializer: new FileMaterializer(fs, clock, '/workspace'),
    workspacePath: '/workspace',
    adapters: new Map<string, Adapter>([['cursor', new CursorAdapter({ homedir: '/home/u' })]]),
  });
  return { manager, fs };
};

describe('AdapterManager generated-file lifecycle', () => {
  it('counts a present owned generated file', async () => {
    const { manager } = await setup();
    await manager.syncAll({ adapterId: 'cursor' });
    expect(await manager.countDestinations('cursor')).toBe(1);
  });

  it('removeAdapterGeneratedFiles deletes owned files and reports the count', async () => {
    const { manager, fs } = await setup();
    await manager.syncAll({ adapterId: 'cursor' });
    const result = await manager.removeAdapterGeneratedFiles('cursor');
    expect(result.removed).toBe(1);
    expect(await fs.pathExists('/repos/app/AGENTS.md')).toBe(false);
  });

  it('removeAllGeneratedFiles clears every adapter', async () => {
    const { manager, fs } = await setup();
    await manager.syncAll({ adapterId: 'cursor' });
    const result = await manager.removeAllGeneratedFiles();
    expect(result.removed).toBe(1);
    expect(await fs.pathExists('/repos/app/AGENTS.md')).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/main/application/services/__tests__/adapter-manager.generated-files.test.ts`
Expected: FAIL — `removeAdapterGeneratedFiles`/`removeAllGeneratedFiles` don't exist; `countDestinations` returns 0 for a write file.

- [ ] **Step 3: Extend `countDestinations` to count generated files**

In `src/main/application/services/adapter-manager.ts`, inside the `for (const dest of destinations)` loop of `countDestinations`, branch:

```ts
      for (const dest of destinations) {
        try {
          if (dest.strategy === 'symlink') {
            const isWorkspaceLink = await this.deps.symlinkManager.isSymlinkToWorkspace(dest.destination, workspacePath);
            if (isWorkspaceLink) count++;
          } else {
            const state = await this.deps.fileMaterializer.validate({ destination: dest.destination, content: dest.content });
            if (state === 'ok' || state === 'drift') count++;
          }
        } catch {
          // skip
        }
      }
```

- [ ] **Step 4: Add the generated-file removal methods**

Add after `removeAdapterSymlinks` in `adapter-manager.ts`:

```ts
  /** Marker-guarded removal of every generated (write) file for one adapter. */
  async removeAdapterGeneratedFiles(adapterId: string): Promise<RemoveAdapterResult> {
    const adapter = this.deps.adapters.get(adapterId);
    if (!adapter) return { removed: 0, skipped: 0, errors: [] };

    const settings = (await this.deps.settingsService.load()) ?? this.deps.settingsService.getDefaults();
    const entities = await this.deps.entityRepository.list();
    let removed = 0;
    let skipped = 0;
    const errors: SymlinkError[] = [];

    for (const entity of entities) {
      const destinations = await adapter.resolveEntityDestinations({ entity, linkedRepos: settings.linkedRepos });
      for (const dest of destinations) {
        if (dest.strategy !== 'write') continue;
        try {
          const result = await this.deps.fileMaterializer.removeIfOwned({ destination: dest.destination });
          if (result.removed) removed++;
          else skipped++;
        } catch (err) {
          errors.push({
            destination: dest.destination,
            kind: err instanceof DomainError ? err.kind : 'internal',
            message: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }
    }
    return { removed, skipped, errors };
  }

  /** Removes every app-generated file across all adapters (factory reset). */
  async removeAllGeneratedFiles(): Promise<RemoveAdapterResult> {
    const aggregate: RemoveAdapterResult = { removed: 0, skipped: 0, errors: [] };
    for (const adapterId of this.deps.adapters.keys()) {
      const result = await this.removeAdapterGeneratedFiles(adapterId);
      aggregate.removed += result.removed;
      aggregate.skipped += result.skipped;
      aggregate.errors.push(...result.errors);
    }
    return aggregate;
  }
```

- [ ] **Step 5: Run the lifecycle test to verify it passes**

Run: `npx vitest run tests/main/application/services/__tests__/adapter-manager.generated-files.test.ts`
Expected: PASS.

- [ ] **Step 6: Aggregate generated-file removal into the disable handler**

In `src/main/ipc/registry.ts`, replace the disable branch of `adapter.setEnabled` (lines 219-224):

```ts
      if (!enabled) {
        let removeResult = { removed: 0, skipped: 0, errors: [] as { destination: string; kind: string; message: string }[] };
        if (removeSymlinks) {
          const links = await adapterManager.removeAdapterSymlinks(adapterId);
          const generated = await adapterManager.removeAdapterGeneratedFiles(adapterId);
          removeResult = {
            removed: links.removed + generated.removed,
            skipped: links.skipped + generated.skipped,
            errors: [...links.errors, ...generated.errors],
          };
        }
        await settingsService.merge({ adapters: { [adapterId]: { enabled: false } } });
        return removeResult;
      }
```

- [ ] **Step 7: Remove generated files on factory reset**

In `src/main/application/services/workspace-teardown.ts`, widen the dep type and call the new method before deleting the workspace:

```ts
  constructor(
    private readonly adapterManager: Pick<AdapterManager, 'removeAllAdapterSymlinks' | 'removeAllGeneratedFiles'>,
    private readonly fs: Pick<WritableFileSystemPort, 'remove'>,
    private readonly workspacePath: string,
    private readonly settings: Pick<ClaudeSettingsPort, 'mutate'>,
  ) {}

  async restore(): Promise<void> {
    await this.adapterManager.removeAllAdapterSymlinks();
    await this.adapterManager.removeAllGeneratedFiles();
    await this.fs.remove(this.workspacePath);
    await this.settings.mutate('personal', (s) => ({ ...s, extraKnownMarketplaces: {}, enabledPlugins: {} }));
  }
```

If a teardown unit test stubs `adapterManager`, add a `removeAllGeneratedFiles: vi.fn().mockResolvedValue({ removed: 0, skipped: 0, errors: [] })` to the stub (run `npm test` to find the file — likely `tests/main/application/services/workspace-teardown.test.ts` — and update its mock).

- [ ] **Step 8: Full gate + commit**

Run: `npm run typecheck && npm test`
Expected: green.

```bash
git add src/main/application/services/adapter-manager.ts src/main/ipc/registry.ts src/main/application/services/workspace-teardown.ts tests/
git commit -m "feat(cursor): count, disable-clean, and factory-reset generated files"
```

---

### Task 5: `GeneratedFileCollector` (health) + the link-a-repo Health warning

**Files:**
- Create: `src/main/application/services/health/generated-file-collector.ts`
- Modify: `src/shared/health.ts`
- Modify: `src/renderer/screens/health/HealthScreen.tsx`
- Modify: `src/main/index.ts`
- Test: `tests/main/application/services/health/generated-file-collector.test.ts`

**Interfaces:**
- Consumes: `AdapterManager.planGeneratedFiles`, `FileMaterializer.validate`, `SettingsService.load/getDefaults`, `ClockPort`.
- Produces: `class GeneratedFileCollector implements HealthCollector` with `category = 'generated-file'`. Emits one `HealthCheck` per generated file (`ok`/`missing`→error/`drift`→warning/`foreign`→warning) plus, when `adapters.cursor.enabled && linkedRepos.length === 0`, a single warning check advising the user to link a repo.
- `HealthCategory` gains `'generated-file'`.

- [ ] **Step 1: Add the category to the shared union**

In `src/shared/health.ts`:

```ts
export type HealthCategory = 'mcp-auth' | 'mcp-runtime' | 'config-drift' | 'symlink' | 'generated-file';
```

- [ ] **Step 2: Write the failing collector test**

Create `tests/main/application/services/health/generated-file-collector.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { GeneratedFileCollector } from '../../../../../src/main/application/services/health/generated-file-collector.js';
import { FixedClock } from '../../../../../src/main/infrastructure/clock/fixed-clock.js';
import type { GeneratedFilePlanEntry } from '../../../../../src/main/application/services/adapter-manager.js';
import type { GeneratedFileState } from '../../../../../src/main/application/services/file-materializer.js';
import type { Settings } from '../../../../../src/shared/settings.js';

const clock = new FixedClock(new Date('2026-07-02T10:00:00.000Z'));
const settings = (over: Partial<Settings>): Settings => ({
  adapters: { claude: { enabled: true }, cursor: { enabled: false } },
  linkedRepos: [{ id: 'r', name: 'app', path: '/repos/app' }],
  ui: { theme: 'system' }, language: 'off', ...over,
});

const make = (opts: {
  plan: GeneratedFilePlanEntry[];
  state: GeneratedFileState;
  settings: Settings;
}) =>
  new GeneratedFileCollector(
    { planGeneratedFiles: () => Promise.resolve(opts.plan) },
    { validate: () => Promise.resolve(opts.state) },
    { load: () => Promise.resolve(opts.settings), getDefaults: () => opts.settings },
    clock,
  );

describe('GeneratedFileCollector', () => {
  it('reports ok for a matching generated file', async () => {
    const collector = make({
      plan: [{ adapterId: 'cursor', destination: '/repos/app/AGENTS.md', content: 'x' }],
      state: 'ok',
      settings: settings({}),
    });
    const checks = await collector.collect('personal');
    expect(checks).toHaveLength(1);
    expect(checks[0]).toMatchObject({ category: 'generated-file', severity: 'ok', target: '/repos/app/AGENTS.md' });
  });

  it('reports error for a missing file and warning for drift/foreign', async () => {
    for (const [state, severity] of [['missing', 'error'], ['drift', 'warning'], ['foreign', 'warning']] as const) {
      const collector = make({
        plan: [{ adapterId: 'cursor', destination: '/repos/app/AGENTS.md', content: 'x' }],
        state,
        settings: settings({}),
      });
      const checks = await collector.collect('personal');
      expect(checks[0]?.severity).toBe(severity);
    }
  });

  it('warns when cursor is enabled but no repo is linked', async () => {
    const collector = make({
      plan: [],
      state: 'ok',
      settings: settings({ adapters: { claude: { enabled: true }, cursor: { enabled: true } }, linkedRepos: [] }),
    });
    const checks = await collector.collect('personal');
    expect(checks).toHaveLength(1);
    expect(checks[0]).toMatchObject({ severity: 'warning', id: 'generated-file:cursor:no-linked-repos' });
  });

  it('emits no notice when cursor is disabled', async () => {
    const collector = make({
      plan: [],
      state: 'ok',
      settings: settings({ adapters: { claude: { enabled: true }, cursor: { enabled: false } }, linkedRepos: [] }),
    });
    expect(await collector.collect('personal')).toEqual([]);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run tests/main/application/services/health/generated-file-collector.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the collector**

Create `src/main/application/services/health/generated-file-collector.ts`:

```ts
import type { HealthCheck, Severity } from '../../../../shared/health.js';
import type { Settings } from '../../../../shared/settings.js';
import type { ClockPort } from '../../ports/clock-port.js';
import type { GeneratedFilePlanEntry } from '../adapter-manager.js';
import type { GeneratedFileState } from '../file-materializer.js';
import type { HealthCollector } from './health-collector.js';

export interface GeneratedFilePlanner {
  planGeneratedFiles(): Promise<GeneratedFilePlanEntry[]>;
}
export interface GeneratedFileValidator {
  validate(args: { destination: string; content: string }): Promise<GeneratedFileState>;
}
export interface SettingsReader {
  load(): Promise<Settings | null>;
  getDefaults(): Settings;
}

interface Verdict {
  severity: Severity;
  title: string;
  remediation?: string;
}

function verdictFor(state: GeneratedFileState, destination: string): Verdict {
  switch (state) {
    case 'ok':
      return { severity: 'ok', title: `Generated file OK: ${destination}` };
    case 'missing':
      return { severity: 'error', title: `Generated file missing: ${destination}`, remediation: 'Re-sync the adapter to regenerate this file.' };
    case 'drift':
      return { severity: 'warning', title: `Generated file drifted: ${destination}`, remediation: 'Re-sync to overwrite manual edits.' };
    case 'foreign':
      return { severity: 'warning', title: `Unmanaged file blocks generation: ${destination}`, remediation: 'Remove or back up the file, then re-sync.' };
  }
}

export class GeneratedFileCollector implements HealthCollector {
  readonly category = 'generated-file' as const;

  constructor(
    private readonly planner: GeneratedFilePlanner,
    private readonly validator: GeneratedFileValidator,
    private readonly settings: SettingsReader,
    private readonly clock: ClockPort,
  ) {}

  // Global source: validates every planned generated file across all scopes.
  async collect(): Promise<HealthCheck[]> {
    const observedAt = this.clock.now().toISOString();
    const checks: HealthCheck[] = [];

    for (const entry of await this.planner.planGeneratedFiles()) {
      const state = await this.validator.validate({ destination: entry.destination, content: entry.content });
      const verdict = verdictFor(state, entry.destination);
      checks.push({
        id: `generated-file:${entry.adapterId}:${entry.destination}`,
        category: 'generated-file',
        severity: verdict.severity,
        title: verdict.title,
        target: entry.destination,
        observedAt,
        ...(verdict.remediation !== undefined ? { remediation: verdict.remediation } : {}),
      });
    }

    const settings = (await this.settings.load()) ?? this.settings.getDefaults();
    if (settings.adapters.cursor.enabled && settings.linkedRepos.length === 0) {
      checks.push({
        id: 'generated-file:cursor:no-linked-repos',
        category: 'generated-file',
        severity: 'warning',
        title: 'Cursor: no linked repository',
        detail:
          'Your personal skills and agents reach Cursor, but the global instruction and project-scoped items are not synced until you link a repository.',
        remediation: 'Link a repository in Settings to sync the global instruction and project-scoped customizations to Cursor.',
        observedAt,
      });
    }
    return checks;
  }
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npx vitest run tests/main/application/services/health/generated-file-collector.test.ts`
Expected: PASS.

- [ ] **Step 6: Register the collector + label it in the renderer**

In `src/main/index.ts`, add to `healthCollectors` (after `SymlinkCollector`):

```ts
import { GeneratedFileCollector } from './application/services/health/generated-file-collector.js';
```

```ts
  const healthCollectors: HealthCollector[] = [
    new McpAuthCollector(claudeRuntimeReader, clock),
    new McpRuntimeCollector(claudeRuntimeReader, clock),
    new ConfigDriftCollector(pluginService, clock),
    new SymlinkCollector(adapterManager, symlinkManager, clock),
    new GeneratedFileCollector(adapterManager, fileMaterializer, settingsService, clock),
  ];
```

In `src/renderer/screens/health/HealthScreen.tsx`, add the label and order entries:

```tsx
const CATEGORY_LABEL: Record<HealthCategory, string> = {
  'mcp-auth': 'MCP Authentication',
  'mcp-runtime': 'MCP Runtime',
  'config-drift': 'Config Drift',
  symlink: 'Symlinks',
  'generated-file': 'Generated Files',
};

const CATEGORY_ORDER: readonly HealthCategory[] = [
  'mcp-auth',
  'mcp-runtime',
  'config-drift',
  'symlink',
  'generated-file',
];
```

- [ ] **Step 7: Full gate + commit**

Run: `npm run lint && npm run typecheck && npm test`
Expected: green.

```bash
git add src/main/application/services/health/generated-file-collector.ts src/shared/health.ts src/renderer/screens/health/HealthScreen.tsx src/main/index.ts tests/main/application/services/health/generated-file-collector.test.ts
git commit -m "feat(cursor): health-check generated files and warn when no repo is linked"
```

---

### Task 6: Link-a-repo banner in Settings

The Health warning (Task 5) covers the persistent case; this banner covers the moment the user enables Cursor with no linked repo.

**Files:**
- Modify: `src/renderer/screens/Settings.tsx`
- Test: `tests/renderer/screens/settings/cursor-notice.test.tsx`

**Interfaces:**
- Consumes: `settings.adapters.cursor.enabled`, `repos` (both already in `Settings.tsx` state).
- Produces: an MUI `<Alert severity="info" data-testid="cursor-no-repo-notice">` in the Adapters card, shown only when Cursor is enabled and `repos.length === 0`.

- [ ] **Step 1: Write the failing renderer test**

Create `tests/renderer/screens/settings/cursor-notice.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Settings as SettingsScreen } from '../../../../src/renderer/screens/Settings.js';
import { mockApi, ok, renderWithTheme, type CallSpy } from '../../test-utils.js';
import type { Settings } from '../../../../src/shared/settings.js';

let call: CallSpy;
beforeEach(() => { call = mockApi(); });

const route = (cursorEnabled: boolean, repos: unknown[]) => {
  const settings: Settings = {
    adapters: { claude: { enabled: true }, cursor: { enabled: cursorEnabled } },
    linkedRepos: [], ui: { theme: 'system' }, language: 'off',
  };
  call.mockImplementation((method: string) => {
    if (method === 'settings.get') return Promise.resolve(ok(settings));
    if (method === 'repo.list') return Promise.resolve(ok(repos));
    return Promise.resolve(ok(undefined));
  });
};

describe('<Settings> — cursor link-a-repo notice', () => {
  it('shows the notice when cursor is enabled and no repo is linked', async () => {
    route(true, []);
    renderWithTheme(<SettingsScreen />);
    expect(await screen.findByTestId('cursor-no-repo-notice')).toBeInTheDocument();
  });

  it('hides the notice when a repo is linked', async () => {
    route(true, [{ id: 'r', name: 'app', path: '/repos/app', branch: 'main' }]);
    renderWithTheme(<SettingsScreen />);
    await waitFor(() => expect(screen.queryByTestId('cursor-no-repo-notice')).not.toBeInTheDocument());
  });

  it('hides the notice when cursor is disabled', async () => {
    route(false, []);
    renderWithTheme(<SettingsScreen />);
    await waitFor(() => expect(screen.queryByTestId('cursor-no-repo-notice')).not.toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/renderer/screens/settings/cursor-notice.test.tsx`
Expected: FAIL — no `cursor-no-repo-notice` element.

- [ ] **Step 3: Add the banner**

In `src/renderer/screens/Settings.tsx`, ensure `Alert` is imported from `@mui/material` (add it to the existing MUI import if missing). Inside the Adapters `<Paper>`, right after the closing `</FormGroup>`:

```tsx
        </FormGroup>
        {settings.adapters.cursor.enabled && repos.length === 0 && (
          <Alert severity="info" sx={{ mt: 1.5 }} data-testid="cursor-no-repo-notice">
            Sem um repositório vinculado, suas skills e agents pessoais chegam ao Cursor, mas a
            instrução global e os itens com escopo de projeto não são sincronizados. Vincule um
            repositório abaixo para incluí-los.
          </Alert>
        )}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/renderer/screens/settings/cursor-notice.test.tsx`
Expected: PASS.

- [ ] **Step 5: Final full gate + commit**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all green.

```bash
git add src/renderer/screens/Settings.tsx tests/renderer/screens/settings/cursor-notice.test.tsx
git commit -m "feat(cursor): warn in Settings when Cursor is enabled without a linked repo"
```

---

## Self-Review (completed by plan author)

**Spec coverage (`2026-07-01-cursor-adapter-design.md`, reconciled):**
- Decision 2 — `strategy: 'symlink' | 'write'` on the port: Task 2. ✓
- §5.2 `FileMaterializer` with conflict/backup discipline: Task 1. ✓
- §5.3 ownership source-of-truth: implemented as a **marker comment** (user-chosen over the JSON manifest, given a single write case) — Task 1 (`GENERATED_FILE_MARKER`, `isOwned`). ✓
- Decision 5 — global instruction → per-repo `AGENTS.md`, backup pre-existing file: Task 3 + Task 1 (`write` conflict path). Frontmatter-stripping is moot (instruction is frontmatter-free). ✓
- §6 sync/remove/health flows branch on strategy: Task 2 (sync/remove), Task 4 (count/remove-all/teardown), Task 5 (health). ✓
- §6 save-triggered re-render: free — `EntityService.save` already calls `adapterManager.syncEntity`, which now routes `write` destinations through the materializer. ✓
- §7 link-a-repo notice as **Health warning + banner** (user-chosen): Task 5 (Health) + Task 6 (banner). ✓
- §8 edge cases: pre-existing AGENTS.md backup (Task 1 conflict test); no-linked-repos → existing `skipped: 'no-linked-repos'` path unchanged + notice (Tasks 5/6). Name collision `skill × command` is not applicable — commands are skills (Plan A). ✓
- §10 out of scope (MCP, User Rules, `.mdc`): not touched. ✓

**Placeholder scan:** none. Task 2 Step 7's test carries an explicit caveat about the `enabledAdapters` filter and resolves it with a concrete registration under `'cursor'`; every other step shows complete code. The teardown-test mock update (Task 4 Step 7) is compiler/`npm test`-driven with the exact mock line given.

**Type consistency:** `AdapterDestination` union (`strategy` discriminant) defined in Task 2 and consumed identically in adapters (Tasks 2/3), `AdapterManager` (Task 2/4), and `planGeneratedFiles` → `GeneratedFilePlanEntry` used by the collector (Task 5). `GENERATED_FILE_MARKER` / `renderAgentsFile` defined in Task 1 and reused in Task 3 (adapter) and every test asserting AGENTS.md content. `GeneratedFileState` (`ok|missing|drift|foreign`) defined in Task 1, consumed by `countDestinations` (Task 4) and the collector (Task 5). `HealthCategory` extended in Task 5 before the renderer reads it. `RemoveAdapterResult` reused verbatim by the new removal methods (Task 4).
