# Monitoring Mechanism Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a unified health-monitoring mechanism that proactively answers "is anything broken?" by reading Claude Code's on-disk runtime state (MCP auth alerts, MCP runtime logs, plugin/config drift, symlink integrity) and surfacing it through an IPC `health.*` namespace, a Diagnostics screen, a live nav badge, and an OS notification on new errors.

**Architecture:** Hexagonal, mirroring the existing `src/main/` layout. Pull-based **collectors** (one per signal source) depend on **ports**, never on `node:fs` directly. A `HealthService` runs all collectors in isolation and aggregates a `HealthReport`. The renderer polls via react-query (`refetchInterval: 30s`), drives a nav-rail badge from `report.worst`, and fires an `Electron.Notification` only when a _new_ `error` id appears — all over the existing request/response `ipc:call` channel, no push protocol.

**Tech Stack:** TypeScript (strict, ESM with `.js` import extensions, `verbatimModuleSyntax`), Electron, Vitest (two projects: `node` + `jsdom`), React + MUI + Emotion, `@tanstack/react-query`.

**Source spec:** `docs/superpowers/specs/2026-06-05-monitoring-mechanism-design.md`

---

## Conventions you MUST follow (read before any task)

- **Imports use `.js` extensions** even for `.ts` source: `import { HealthService } from './health-service.js'`.
- **Strict TS** — `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride` are on. `arr[0]` is `T | undefined`. Optional properties do **not** accept explicit `undefined` — build them with conditional spread: `...(detail !== undefined ? { detail } : {})`.
- **Never call `Date.now()` / `new Date()` directly** in main-process logic. Inject `ClockPort` (`now(): Date`) and call `this.clock.now().toISOString()`. Tests use `FixedClock`.
- **Layer rule** — collectors/services live in `application/`, depend on **ports**; concrete I/O (`node:fs`, `electron`) lives in `infrastructure/`.
- **Per-file run command** — node tests: `npx vitest run <path>`; renderer tests resolve to the jsdom project automatically by their `tests/renderer/**` path.
- Commit messages in English; end each with the `Co-Authored-By` trailer your environment uses. Commit after every green task.

## Decisions locked for this plan (refinements over the spec, all faithful to it)

1. **Data types live in `src/shared/health.ts`** (they cross the IPC boundary). **Pure rollup helpers** (`worstSeverity`, `countBySeverity`) live in `src/main/domain/health.ts` and import the shared types. This honors the spec's listing of both files without duplicating the type definitions. (Mirrors how `SyncResult` lives in `src/shared/customization.ts` and is imported by main-process services.)
2. **Each collector is injected a `ClockPort`** and stamps `observedAt` on every `HealthCheck` it emits. Keeps the data model faithful (every check has `observedAt` via the clock) and makes each collector independently testable with `FixedClock`.
3. **MCP log classification is a pure function** `classifyMcpLog()` in the application layer, consumed by `FsClaudeRuntimeReader`. The false-positive nuance (an `error`-field line that is really `INFO`/`WARNING`) is unit-tested directly against this function.
4. **`SymlinkCollector` gets its expected links from a new `AdapterManager.planDestinations()`** — a read-only sibling of `syncAll()` that resolves `(source, destination)` pairs without touching the filesystem — then validates each with the existing `SymlinkManager.validate()`.
5. **`McpRuntimeCollector` consumes both `readMcpServers()` and `readMcpRuntimeLogs()`**, emitting one check per server in the union of (configured ∪ logged). A configured server with no failing logs reports `ok`; this gives the Diagnostics screen positive "MCP healthy" rows and leaves no port method unused.
6. **Notification detection is renderer-driven and primed on first report** — the first poll seeds the "seen error ids" set _without_ notifying, so pre-existing errors at launch don't fire a notification; only errors that appear while the app is open notify. (Matches spec decision #1: "only notifies while the app is open.")
7. **The `ElectronNotificationAdapter` is excluded from coverage** (like the existing `infrastructure/dialog/**`), since it can't run headless. Everything else stays inside the 80/70 coverage gate.

## File map

**New — main process**

| File                                                                     | Responsibility                                                                           |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `src/shared/health.ts`                                                   | Cross-boundary types: `Severity`, `HealthCategory`, `HealthCheck`, `HealthReport`.       |
| `src/main/domain/health.ts`                                              | Pure helpers: `worstSeverity()`, `countBySeverity()`.                                    |
| `src/main/application/ports/claude-runtime-port.ts`                      | `ClaudeRuntimePort` + `McpServerConfig`, `McpAuthAlert`, `McpLogSummary`, `McpLogState`. |
| `src/main/application/ports/notification-port.ts`                        | `NotificationPort`.                                                                      |
| `src/main/application/services/health/health-collector.ts`               | `HealthCollector` interface.                                                             |
| `src/main/application/services/health/mcp-log-classifier.ts`             | Pure `classifyMcpLog()` + `McpLogLine`.                                                  |
| `src/main/application/services/health/mcp-auth-collector.ts`             | `McpAuthCollector`.                                                                      |
| `src/main/application/services/health/mcp-runtime-collector.ts`          | `McpRuntimeCollector`.                                                                   |
| `src/main/application/services/health/config-drift-collector.ts`         | `ConfigDriftCollector`.                                                                  |
| `src/main/application/services/health/symlink-collector.ts`              | `SymlinkCollector`.                                                                      |
| `src/main/application/services/health/health-service.ts`                 | `HealthService` orchestrator.                                                            |
| `src/main/infrastructure/claude-runtime/fs-claude-runtime-reader.ts`     | `FsClaudeRuntimeReader` (real fs).                                                       |
| `src/main/infrastructure/notification/electron-notification-adapter.ts`  | `ElectronNotificationAdapter`.                                                           |
| `src/main/ipc/health-handlers.ts`                                        | `buildHealthHandlers()`.                                                                 |
| `src/main/application/services/__fixtures__/fake-claude-runtime-port.ts` | Reusable test fake.                                                                      |

**Modified — main process**

| File                                               | Change                                                           |
| -------------------------------------------------- | ---------------------------------------------------------------- |
| `src/main/application/services/adapter-manager.ts` | Add `SymlinkPlanEntry` + `planDestinations()`.                   |
| `src/main/ipc/registry.ts`                         | Import + spread `buildHealthHandlers`; extend `IpcDeps`.         |
| `src/main/index.ts`                                | Wire reader, collectors, service, notification adapter.          |
| `vitest.config.ts`                                 | Exclude `src/main/infrastructure/notification/**` from coverage. |

**New — renderer**

| File                                             | Responsibility                                          |
| ------------------------------------------------ | ------------------------------------------------------- |
| `src/renderer/hooks/use-health-report.ts`        | `useHealthReport()` react-query hook (30s poll).        |
| `src/renderer/hooks/use-health-notifications.ts` | `useHealthNotifications()` new-error → `health.notify`. |
| `src/renderer/screens/health/HealthScreen.tsx`   | Diagnostics screen.                                     |

**Modified — renderer**

| File                                  | Change                                                        |
| ------------------------------------- | ------------------------------------------------------------- |
| `src/renderer/theme.ts`               | Add `warning` palette entry.                                  |
| `src/renderer/components/Sidebar.tsx` | Add `diagnostics` leaf + severity badge prop.                 |
| `src/renderer/screens/Main.tsx`       | Render `HealthScreen`; wire hooks; pass `worst` to `Sidebar`. |

---

## Task 1: Shared health types

**Files:**

- Create: `src/shared/health.ts`

- [ ] **Step 1: Create the shared types file**

`src/shared/health.ts`:

```ts
export type Severity = 'ok' | 'warning' | 'error';

export type HealthCategory = 'mcp-auth' | 'mcp-runtime' | 'config-drift' | 'symlink';

export interface HealthCheck {
  /** Stable id, e.g. "mcp-auth:claude.ai Gmail". Used for notification diffing. */
  id: string;
  category: HealthCategory;
  severity: Severity;
  title: string;
  detail?: string;
  /** MCP/plugin/symlink name this check is about. */
  target?: string;
  /** Actionable hint, e.g. "Run /mcp to authenticate". */
  remediation?: string;
  /** ISO timestamp, stamped by the service via ClockPort. */
  observedAt: string;
}

export interface HealthReport {
  generatedAt: string;
  /** Drives the nav badge color. */
  worst: Severity;
  counts: { ok: number; warning: number; error: number };
  checks: HealthCheck[];
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no references yet; this just confirms the file compiles).

- [ ] **Step 3: Commit**

```bash
git add src/shared/health.ts
git commit -m "feat(health): add shared health report types"
```

---

## Task 2: Domain rollup helpers

**Files:**

- Create: `src/main/domain/health.ts`
- Test: `tests/main/domain/health.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/main/domain/health.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { worstSeverity, countBySeverity } from '../../../src/main/domain/health.js';
import type { HealthCheck } from '../../../src/shared/health.js';

const check = (severity: HealthCheck['severity']): HealthCheck => ({
  id: `id-${severity}`,
  category: 'mcp-auth',
  severity,
  title: 't',
  observedAt: '2026-06-05T00:00:00.000Z',
});

describe('worstSeverity', () => {
  it('returns ok for an empty list', () => {
    expect(worstSeverity([])).toBe('ok');
  });

  it('returns the highest-ranked severity present', () => {
    expect(worstSeverity(['ok', 'warning', 'ok'])).toBe('warning');
    expect(worstSeverity(['warning', 'error', 'ok'])).toBe('error');
    expect(worstSeverity(['ok', 'ok'])).toBe('ok');
  });
});

describe('countBySeverity', () => {
  it('counts checks per severity', () => {
    const checks = [check('ok'), check('ok'), check('warning'), check('error')];
    expect(countBySeverity(checks)).toEqual({ ok: 2, warning: 1, error: 1 });
  });

  it('returns all-zero counts for an empty list', () => {
    expect(countBySeverity([])).toEqual({ ok: 0, warning: 0, error: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/main/domain/health.test.ts`
Expected: FAIL — `Failed to resolve import ".../src/main/domain/health.js"`.

- [ ] **Step 3: Write minimal implementation**

`src/main/domain/health.ts`:

```ts
import type { Severity, HealthCheck, HealthReport } from '../../shared/health.js';

const RANK: Record<Severity, number> = { ok: 0, warning: 1, error: 2 };

export function worstSeverity(severities: readonly Severity[]): Severity {
  return severities.reduce<Severity>(
    (worst, current) => (RANK[current] > RANK[worst] ? current : worst),
    'ok',
  );
}

export function countBySeverity(checks: readonly HealthCheck[]): HealthReport['counts'] {
  const counts = { ok: 0, warning: 0, error: 0 };
  for (const check of checks) {
    counts[check.severity] += 1;
  }
  return counts;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/main/domain/health.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/main/domain/health.ts tests/main/domain/health.test.ts
git commit -m "feat(health): add severity rollup helpers"
```

---

## Task 3: Ports and collector interface (type-only)

Type-only declarations — no runtime behavior, so no failing test. Verified by `typecheck`.

**Files:**

- Create: `src/main/application/ports/claude-runtime-port.ts`
- Create: `src/main/application/services/health/health-collector.ts`

- [ ] **Step 1: Create the `ClaudeRuntimePort`**

`src/main/application/ports/claude-runtime-port.ts`:

```ts
/** A single MCP server entry read from ~/.claude.json. */
export interface McpServerConfig {
  name: string;
  source: 'global' | 'project';
  projectPath?: string;
}

/** A server flagged in ~/.claude/mcp-needs-auth-cache.json. */
export interface McpAuthAlert {
  name: string;
}

export type McpLogState = 'ok' | 'warning' | 'error';

/** Classified summary of the newest log session for one MCP server. */
export interface McpLogSummary {
  server: string;
  state: McpLogState;
  detail?: string;
  sessionId?: string;
}

/**
 * Reads Claude Code runtime files the app does NOT own. Every read tolerates a
 * missing file (ENOENT) by returning an empty result, never throwing.
 */
export interface ClaudeRuntimePort {
  readMcpServers(): Promise<McpServerConfig[]>;
  readMcpAuthAlerts(): Promise<McpAuthAlert[]>;
  readMcpRuntimeLogs(): Promise<McpLogSummary[]>;
}
```

- [ ] **Step 2: Create the `HealthCollector` interface**

`src/main/application/services/health/health-collector.ts`:

```ts
import type { HealthCategory, HealthCheck } from '../../../../shared/health.js';
import type { Scope } from '../../ports/scope.js';

/**
 * One collector per health source. Adding a future source = one new file
 * implementing this interface, zero changes to existing collectors.
 */
export interface HealthCollector {
  readonly category: HealthCategory;
  collect(scope: Scope): Promise<HealthCheck[]>;
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/main/application/ports/claude-runtime-port.ts src/main/application/services/health/health-collector.ts
git commit -m "feat(health): add ClaudeRuntimePort and HealthCollector contracts"
```

---

## Task 4: MCP log classifier (the false-positive nuance)

**Files:**

- Create: `src/main/application/services/health/mcp-log-classifier.ts`
- Test: `tests/main/application/services/health/mcp-log-classifier.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/main/application/services/health/mcp-log-classifier.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  classifyMcpLog,
  type McpLogLine,
} from '../../../../../src/main/application/services/health/mcp-log-classifier.js';

const line = (over: Partial<McpLogLine>): McpLogLine => ({ sessionId: 's1', ...over });

describe('classifyMcpLog', () => {
  it('classifies an empty session as ok', () => {
    expect(classifyMcpLog([]).state).toBe('ok');
  });

  it('treats INFO-only stderr as ok (error field is NOT a failure)', () => {
    const lines = [
      line({ error: 'Server stderr: INFO Connector starting' }),
      line({ error: 'Server stderr: INFO Connected to upstream' }),
      line({ debug: 'tools/list' }),
    ];
    expect(classifyMcpLog(lines).state).toBe('ok');
  });

  it('classifies a real connection failure as error', () => {
    const result = classifyMcpLog([
      line({ error: 'Server stderr: INFO starting' }),
      line({ error: 'Connection to MCP server "gmail" timed out' }),
    ]);
    expect(result.state).toBe('error');
    expect(result.detail).toContain('timed out');
  });

  it('classifies "failed to connect" as error', () => {
    expect(classifyMcpLog([line({ error: 'failed to connect to server gmail' })]).state).toBe(
      'error',
    );
  });

  it('classifies a non-zero exit as error', () => {
    expect(classifyMcpLog([line({ error: 'Server process exited with code 1' })]).state).toBe(
      'error',
    );
  });

  it('classifies a WARNING (no failure signal) as warning', () => {
    const result = classifyMcpLog([line({ error: 'Server stderr: WARNING deprecated flag' })]);
    expect(result.state).toBe('warning');
    expect(result.detail).toContain('WARNING');
  });

  it('only considers the newest session', () => {
    const lines = [
      line({ sessionId: 'old', error: 'failed to connect' }),
      line({ sessionId: 'new', error: 'Server stderr: INFO healthy' }),
    ];
    const result = classifyMcpLog(lines);
    expect(result.state).toBe('ok');
    expect(result.sessionId).toBe('new');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/main/application/services/health/mcp-log-classifier.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

`src/main/application/services/health/mcp-log-classifier.ts`:

```ts
import type { McpLogState } from '../../ports/claude-runtime-port.js';

/** One parsed line of an mcp-logs-<server>/*.jsonl file. */
export interface McpLogLine {
  error?: string;
  debug?: unknown;
  timestamp?: string;
  sessionId?: string;
}

export interface McpLogClassification {
  state: McpLogState;
  detail?: string;
  sessionId?: string;
}

// Real failure signals. The `error` field captures ALL server stderr (including
// normal INFO/WARNING), so "has an error field" != "failed". Only these match.
const FAILURE_SIGNALS: readonly RegExp[] = [
  /failed to connect/i,
  /connection .*(?:timed out|timeout)/i,
  /\btimed out\b/i,
  /ECONNREFUSED/i,
  /exited with (?:code )?[1-9]/i,
  /non-zero exit/i,
];

function isFailure(message: string): boolean {
  return FAILURE_SIGNALS.some((re) => re.test(message));
}

export function classifyMcpLog(lines: readonly McpLogLine[]): McpLogClassification {
  if (lines.length === 0) return { state: 'ok' };

  // Newest session = sessionId of the last line that carries one.
  const lastWithSession = [...lines].reverse().find((l) => typeof l.sessionId === 'string');
  const sessionId = lastWithSession?.sessionId;
  const sessionLines =
    sessionId !== undefined ? lines.filter((l) => l.sessionId === sessionId) : lines;

  let state: McpLogState = 'ok';
  let detail: string | undefined;

  for (const line of sessionLines) {
    if (typeof line.error !== 'string') continue;
    if (isFailure(line.error)) {
      return {
        state: 'error',
        detail: line.error,
        ...(sessionId !== undefined ? { sessionId } : {}),
      };
    }
    if (state === 'ok' && /\bwarn(?:ing)?\b/i.test(line.error)) {
      state = 'warning';
      detail = line.error;
    }
  }

  return {
    state,
    ...(detail !== undefined ? { detail } : {}),
    ...(sessionId !== undefined ? { sessionId } : {}),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/main/application/services/health/mcp-log-classifier.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/main/application/services/health/mcp-log-classifier.ts tests/main/application/services/health/mcp-log-classifier.test.ts
git commit -m "feat(health): classify MCP log sessions by real failure signals"
```

---

## Task 5: Reusable `FakeClaudeRuntimePort`

**Files:**

- Create: `src/main/application/services/__fixtures__/fake-claude-runtime-port.ts`

No test (it is itself a test double). Used by Tasks 6 and 7.

- [ ] **Step 1: Create the fake**

`src/main/application/services/__fixtures__/fake-claude-runtime-port.ts`:

```ts
import type {
  ClaudeRuntimePort,
  McpServerConfig,
  McpAuthAlert,
  McpLogSummary,
} from '../../ports/claude-runtime-port.js';

export class FakeClaudeRuntimePort implements ClaudeRuntimePort {
  private servers: McpServerConfig[] = [];
  private alerts: McpAuthAlert[] = [];
  private logs: McpLogSummary[] = [];

  seedServers(servers: McpServerConfig[]): void {
    this.servers = servers;
  }

  seedAuthAlerts(alerts: McpAuthAlert[]): void {
    this.alerts = alerts;
  }

  seedRuntimeLogs(logs: McpLogSummary[]): void {
    this.logs = logs;
  }

  readMcpServers(): Promise<McpServerConfig[]> {
    return Promise.resolve(this.servers);
  }

  readMcpAuthAlerts(): Promise<McpAuthAlert[]> {
    return Promise.resolve(this.alerts);
  }

  readMcpRuntimeLogs(): Promise<McpLogSummary[]> {
    return Promise.resolve(this.logs);
  }
}
```

- [ ] **Step 2: Typecheck & commit**

Run: `npm run typecheck`
Expected: PASS.

```bash
git add src/main/application/services/__fixtures__/fake-claude-runtime-port.ts
git commit -m "test(health): add FakeClaudeRuntimePort double"
```

---

## Task 6: `McpAuthCollector`

**Files:**

- Create: `src/main/application/services/health/mcp-auth-collector.ts`
- Test: `tests/main/application/services/health/mcp-auth-collector.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/main/application/services/health/mcp-auth-collector.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { McpAuthCollector } from '../../../../../src/main/application/services/health/mcp-auth-collector.js';
import { FakeClaudeRuntimePort } from '../../../../../src/main/application/services/__fixtures__/fake-claude-runtime-port.js';
import { FixedClock } from '../../../../../src/main/infrastructure/clock/fixed-clock.js';

const FROZEN = new Date('2026-06-05T10:00:00.000Z');

const setup = () => {
  const runtime = new FakeClaudeRuntimePort();
  const collector = new McpAuthCollector(runtime, new FixedClock(FROZEN));
  return { runtime, collector };
};

describe('McpAuthCollector', () => {
  it('reports category mcp-auth', () => {
    const { collector } = setup();
    expect(collector.category).toBe('mcp-auth');
  });

  it('returns no checks when there are no auth alerts', async () => {
    const { collector } = setup();
    await expect(collector.collect('personal')).resolves.toEqual([]);
  });

  it('emits one warning per server needing auth, with remediation and observedAt', async () => {
    const { runtime, collector } = setup();
    runtime.seedAuthAlerts([{ name: 'Gmail' }, { name: 'Google Calendar' }]);

    const checks = await collector.collect('personal');

    expect(checks).toHaveLength(2);
    const first = checks[0]!;
    expect(first).toMatchObject({
      id: 'mcp-auth:Gmail',
      category: 'mcp-auth',
      severity: 'warning',
      target: 'Gmail',
      remediation: 'Run /mcp in Claude Code to authenticate.',
      observedAt: FROZEN.toISOString(),
    });
    expect(first.title).toContain('Gmail');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/main/application/services/health/mcp-auth-collector.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

`src/main/application/services/health/mcp-auth-collector.ts`:

```ts
import type { HealthCheck } from '../../../../shared/health.js';
import type { ClockPort } from '../../ports/clock-port.js';
import type { ClaudeRuntimePort } from '../../ports/claude-runtime-port.js';
import type { Scope } from '../../ports/scope.js';
import type { HealthCollector } from './health-collector.js';

export class McpAuthCollector implements HealthCollector {
  readonly category = 'mcp-auth' as const;

  constructor(
    private readonly runtime: ClaudeRuntimePort,
    private readonly clock: ClockPort,
  ) {}

  async collect(_scope: Scope): Promise<HealthCheck[]> {
    const alerts = await this.runtime.readMcpAuthAlerts();
    const observedAt = this.clock.now().toISOString();
    return alerts.map((alert) => ({
      id: `mcp-auth:${alert.name}`,
      category: 'mcp-auth',
      severity: 'warning',
      title: `MCP "${alert.name}" needs authentication`,
      target: alert.name,
      remediation: 'Run /mcp in Claude Code to authenticate.',
      observedAt,
    }));
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/main/application/services/health/mcp-auth-collector.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/main/application/services/health/mcp-auth-collector.ts tests/main/application/services/health/mcp-auth-collector.test.ts
git commit -m "feat(health): add McpAuthCollector"
```

---

## Task 7: `McpRuntimeCollector`

**Files:**

- Create: `src/main/application/services/health/mcp-runtime-collector.ts`
- Test: `tests/main/application/services/health/mcp-runtime-collector.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/main/application/services/health/mcp-runtime-collector.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { McpRuntimeCollector } from '../../../../../src/main/application/services/health/mcp-runtime-collector.js';
import { FakeClaudeRuntimePort } from '../../../../../src/main/application/services/__fixtures__/fake-claude-runtime-port.js';
import { FixedClock } from '../../../../../src/main/infrastructure/clock/fixed-clock.js';

const FROZEN = new Date('2026-06-05T10:00:00.000Z');

const setup = () => {
  const runtime = new FakeClaudeRuntimePort();
  const collector = new McpRuntimeCollector(runtime, new FixedClock(FROZEN));
  return { runtime, collector };
};

const byTarget = (checks: Awaited<ReturnType<McpRuntimeCollector['collect']>>, target: string) =>
  checks.find((c) => c.target === target);

describe('McpRuntimeCollector', () => {
  it('reports category mcp-runtime', () => {
    const { collector } = setup();
    expect(collector.category).toBe('mcp-runtime');
  });

  it('returns no checks when nothing is configured or logged', async () => {
    const { collector } = setup();
    await expect(collector.collect('personal')).resolves.toEqual([]);
  });

  it('reports a configured server with no logs as ok', async () => {
    const { runtime, collector } = setup();
    runtime.seedServers([{ name: 'gmail', source: 'global' }]);

    const checks = await collector.collect('personal');

    expect(checks).toHaveLength(1);
    expect(byTarget(checks, 'gmail')).toMatchObject({
      category: 'mcp-runtime',
      severity: 'ok',
      observedAt: FROZEN.toISOString(),
    });
  });

  it('maps a failing log session to an error check with remediation', async () => {
    const { runtime, collector } = setup();
    runtime.seedServers([{ name: 'gmail', source: 'global' }]);
    runtime.seedRuntimeLogs([{ server: 'gmail', state: 'error', detail: 'timed out' }]);

    const check = byTarget(await collector.collect('personal'), 'gmail');

    expect(check).toMatchObject({
      severity: 'error',
      detail: 'timed out',
      remediation: expect.stringContaining('restart'),
    });
  });

  it('includes servers seen only in logs (not in config)', async () => {
    const { runtime, collector } = setup();
    runtime.seedRuntimeLogs([{ server: 'orphan', state: 'warning' }]);

    const check = byTarget(await collector.collect('personal'), 'orphan');
    expect(check?.severity).toBe('warning');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/main/application/services/health/mcp-runtime-collector.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

`src/main/application/services/health/mcp-runtime-collector.ts`:

```ts
import type { HealthCheck, Severity } from '../../../../shared/health.js';
import type { ClockPort } from '../../ports/clock-port.js';
import type {
  ClaudeRuntimePort,
  McpLogState,
  McpLogSummary,
} from '../../ports/claude-runtime-port.js';
import type { Scope } from '../../ports/scope.js';
import type { HealthCollector } from './health-collector.js';

const SEVERITY: Record<McpLogState, Severity> = {
  ok: 'ok',
  warning: 'warning',
  error: 'error',
};

export class McpRuntimeCollector implements HealthCollector {
  readonly category = 'mcp-runtime' as const;

  constructor(
    private readonly runtime: ClaudeRuntimePort,
    private readonly clock: ClockPort,
  ) {}

  async collect(_scope: Scope): Promise<HealthCheck[]> {
    const [servers, logs] = await Promise.all([
      this.runtime.readMcpServers(),
      this.runtime.readMcpRuntimeLogs(),
    ]);

    const byServer = new Map<string, McpLogSummary>();
    for (const log of logs) byServer.set(log.server, log);

    const names = new Set<string>([...servers.map((s) => s.name), ...logs.map((l) => l.server)]);

    const observedAt = this.clock.now().toISOString();
    const checks: HealthCheck[] = [];
    for (const name of names) {
      const summary = byServer.get(name);
      const state: McpLogState = summary?.state ?? 'ok';
      const severity = SEVERITY[state];
      checks.push({
        id: `mcp-runtime:${name}`,
        category: 'mcp-runtime',
        severity,
        title: severity === 'ok' ? `MCP "${name}" healthy` : `MCP "${name}" runtime problem`,
        target: name,
        observedAt,
        ...(summary?.detail !== undefined ? { detail: summary.detail } : {}),
        ...(severity !== 'ok'
          ? { remediation: 'Check the MCP server logs and restart Claude Code.' }
          : {}),
      });
    }
    return checks;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/main/application/services/health/mcp-runtime-collector.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/main/application/services/health/mcp-runtime-collector.ts tests/main/application/services/health/mcp-runtime-collector.test.ts
git commit -m "feat(health): add McpRuntimeCollector"
```

---

## Task 8: `HealthService` orchestrator

**Files:**

- Create: `src/main/application/services/health/health-service.ts`
- Test: `tests/main/application/services/health/health-service.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/main/application/services/health/health-service.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { HealthService } from '../../../../../src/main/application/services/health/health-service.js';
import type { HealthCollector } from '../../../../../src/main/application/services/health/health-collector.js';
import type { HealthCheck } from '../../../../../src/shared/health.js';
import { FixedClock } from '../../../../../src/main/infrastructure/clock/fixed-clock.js';

const FROZEN = new Date('2026-06-05T10:00:00.000Z');

const fakeCollector = (
  category: HealthCheck['category'],
  checks: HealthCheck[],
): HealthCollector => ({
  category,
  collect: () => Promise.resolve(checks),
});

const check = (
  category: HealthCheck['category'],
  severity: HealthCheck['severity'],
): HealthCheck => ({
  id: `${category}:${severity}`,
  category,
  severity,
  title: 't',
  observedAt: FROZEN.toISOString(),
});

describe('HealthService.getReport', () => {
  it('aggregates checks from all collectors with worst rollup and counts', async () => {
    const service = new HealthService(
      [
        fakeCollector('mcp-auth', [check('mcp-auth', 'warning')]),
        fakeCollector('symlink', [check('symlink', 'ok'), check('symlink', 'error')]),
      ],
      new FixedClock(FROZEN),
    );

    const report = await service.getReport('personal');

    expect(report.generatedAt).toBe(FROZEN.toISOString());
    expect(report.checks).toHaveLength(3);
    expect(report.worst).toBe('error');
    expect(report.counts).toEqual({ ok: 1, warning: 1, error: 1 });
  });

  it('produces worst=ok and zero error count when all checks pass', async () => {
    const service = new HealthService(
      [fakeCollector('mcp-runtime', [check('mcp-runtime', 'ok')])],
      new FixedClock(FROZEN),
    );

    const report = await service.getReport('personal');

    expect(report.worst).toBe('ok');
    expect(report.counts.error).toBe(0);
  });

  it('isolates a throwing collector into its own error check', async () => {
    const boom: HealthCollector = {
      category: 'config-drift',
      collect: () => Promise.reject(new Error('disk on fire')),
    };
    const service = new HealthService(
      [boom, fakeCollector('mcp-auth', [check('mcp-auth', 'ok')])],
      new FixedClock(FROZEN),
    );

    const report = await service.getReport('personal');

    expect(report.checks).toHaveLength(2);
    const failure = report.checks.find((c) => c.category === 'config-drift');
    expect(failure).toMatchObject({ severity: 'error', observedAt: FROZEN.toISOString() });
    expect(failure?.detail).toContain('disk on fire');
    expect(report.worst).toBe('error');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/main/application/services/health/health-service.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

`src/main/application/services/health/health-service.ts`:

```ts
import type { HealthCheck, HealthReport } from '../../../../shared/health.js';
import type { ClockPort } from '../../ports/clock-port.js';
import type { Scope } from '../../ports/scope.js';
import { worstSeverity, countBySeverity } from '../../../domain/health.js';
import type { HealthCollector } from './health-collector.js';

export class HealthService {
  constructor(
    private readonly collectors: readonly HealthCollector[],
    private readonly clock: ClockPort,
  ) {}

  async getReport(scope: Scope): Promise<HealthReport> {
    const results = await Promise.all(
      this.collectors.map((collector) => this.runIsolated(collector, scope)),
    );
    const checks = results.flat();
    return {
      generatedAt: this.clock.now().toISOString(),
      worst: worstSeverity(checks.map((c) => c.severity)),
      counts: countBySeverity(checks),
      checks,
    };
  }

  private async runIsolated(collector: HealthCollector, scope: Scope): Promise<HealthCheck[]> {
    try {
      return await collector.collect(scope);
    } catch (err) {
      return [
        {
          id: `collector-error:${collector.category}`,
          category: collector.category,
          severity: 'error',
          title: `Health check failed: ${collector.category}`,
          detail: err instanceof Error ? err.message : String(err),
          observedAt: this.clock.now().toISOString(),
        },
      ];
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/main/application/services/health/health-service.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/main/application/services/health/health-service.ts tests/main/application/services/health/health-service.test.ts
git commit -m "feat(health): add HealthService with collector isolation"
```

---

## Task 9: `FsClaudeRuntimeReader` (real filesystem)

**Files:**

- Create: `src/main/infrastructure/claude-runtime/fs-claude-runtime-reader.ts`
- Test: `tests/main/infrastructure/claude-runtime/fs-claude-runtime-reader.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/main/infrastructure/claude-runtime/fs-claude-runtime-reader.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FsClaudeRuntimeReader } from '../../../../src/main/infrastructure/claude-runtime/fs-claude-runtime-reader.js';

const jsonl = (lines: object[]): string => lines.map((l) => JSON.stringify(l)).join('\n');

describe('FsClaudeRuntimeReader', () => {
  let work: string;
  let claudeJsonPath: string;
  let authCachePath: string;
  let mcpLogsBaseDir: string;
  let reader: FsClaudeRuntimeReader;

  beforeEach(async () => {
    work = await mkdtemp(join(tmpdir(), 'sde-claude-runtime-'));
    claudeJsonPath = join(work, '.claude.json');
    authCachePath = join(work, 'mcp-needs-auth-cache.json');
    mcpLogsBaseDir = join(work, 'caches', 'claude-cli-nodejs');
    reader = new FsClaudeRuntimeReader({ claudeJsonPath, authCachePath, mcpLogsBaseDir });
  });

  afterEach(async () => {
    await rm(work, { recursive: true, force: true });
  });

  describe('readMcpServers', () => {
    it('returns [] when ~/.claude.json is missing', async () => {
      await expect(reader.readMcpServers()).resolves.toEqual([]);
    });

    it('reads global mcpServers keys', async () => {
      await writeFile(
        claudeJsonPath,
        JSON.stringify({ mcpServers: { gmail: {}, 'google-drive': {} } }),
        'utf8',
      );
      const servers = await reader.readMcpServers();
      expect(servers).toEqual([
        { name: 'gmail', source: 'global' },
        { name: 'google-drive', source: 'global' },
      ]);
    });
  });

  describe('readMcpAuthAlerts', () => {
    it('returns [] when the auth cache is missing', async () => {
      await expect(reader.readMcpAuthAlerts()).resolves.toEqual([]);
    });

    it('reads server names from an object-keyed cache', async () => {
      await writeFile(authCachePath, JSON.stringify({ Gmail: true, Calendar: true }), 'utf8');
      await expect(reader.readMcpAuthAlerts()).resolves.toEqual([
        { name: 'Gmail' },
        { name: 'Calendar' },
      ]);
    });

    it('reads server names from an array cache', async () => {
      await writeFile(authCachePath, JSON.stringify(['Gmail']), 'utf8');
      await expect(reader.readMcpAuthAlerts()).resolves.toEqual([{ name: 'Gmail' }]);
    });
  });

  describe('readMcpRuntimeLogs', () => {
    it('returns [] when the logs base dir is missing', async () => {
      await expect(reader.readMcpRuntimeLogs()).resolves.toEqual([]);
    });

    it('classifies an INFO-only session as ok and a timeout as error', async () => {
      const project = join(mcpLogsBaseDir, '-Users-me-proj');
      const okDir = join(project, 'mcp-logs-healthy');
      const badDir = join(project, 'mcp-logs-broken');
      await mkdir(okDir, { recursive: true });
      await mkdir(badDir, { recursive: true });

      await writeFile(
        join(okDir, 'session.jsonl'),
        jsonl([{ error: 'Server stderr: INFO ok', sessionId: 's1' }]),
        'utf8',
      );
      await writeFile(
        join(badDir, 'session.jsonl'),
        jsonl([{ error: 'Connection timed out', sessionId: 's1' }]),
        'utf8',
      );

      const summaries = await reader.readMcpRuntimeLogs();
      const healthy = summaries.find((s) => s.server === 'healthy');
      const broken = summaries.find((s) => s.server === 'broken');

      expect(healthy?.state).toBe('ok');
      expect(broken?.state).toBe('error');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/main/infrastructure/claude-runtime/fs-claude-runtime-reader.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

`src/main/infrastructure/claude-runtime/fs-claude-runtime-reader.ts`:

```ts
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  ClaudeRuntimePort,
  McpServerConfig,
  McpAuthAlert,
  McpLogState,
  McpLogSummary,
} from '../../application/ports/claude-runtime-port.js';
import {
  classifyMcpLog,
  type McpLogLine,
} from '../../application/services/health/mcp-log-classifier.js';

export interface FsClaudeRuntimeReaderPaths {
  claudeJsonPath: string;
  authCachePath: string;
  mcpLogsBaseDir: string;
}

const RANK: Record<McpLogState, number> = { ok: 0, warning: 1, error: 2 };

function isNotFound(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 'ENOENT'
  );
}

async function readJson(path: string): Promise<unknown | undefined> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as unknown;
  } catch (err) {
    if (isNotFound(err)) return undefined;
    throw err;
  }
}

async function safeReaddir(path: string): Promise<string[]> {
  try {
    return await readdir(path);
  } catch (err) {
    if (isNotFound(err)) return [];
    throw err;
  }
}

function parseJsonl(raw: string): McpLogLine[] {
  const lines: McpLogLine[] = [];
  for (const text of raw.split('\n')) {
    const trimmed = text.trim();
    if (trimmed.length === 0) continue;
    try {
      lines.push(JSON.parse(trimmed) as McpLogLine);
    } catch {
      // Skip malformed lines — partial flushes happen.
    }
  }
  return lines;
}

export class FsClaudeRuntimeReader implements ClaudeRuntimePort {
  constructor(private readonly paths: FsClaudeRuntimeReaderPaths) {}

  async readMcpServers(): Promise<McpServerConfig[]> {
    const json = await readJson(this.paths.claudeJsonPath);
    const root = json as { mcpServers?: Record<string, unknown> } | undefined;
    const servers = root?.mcpServers;
    if (servers === undefined || servers === null) return [];
    return Object.keys(servers).map((name) => ({ name, source: 'global' as const }));
  }

  async readMcpAuthAlerts(): Promise<McpAuthAlert[]> {
    const json = await readJson(this.paths.authCachePath);
    if (json === undefined || json === null) return [];
    const names = Array.isArray(json)
      ? json.filter((n): n is string => typeof n === 'string')
      : typeof json === 'object'
        ? Object.keys(json)
        : [];
    return names.map((name) => ({ name }));
  }

  async readMcpRuntimeLogs(): Promise<McpLogSummary[]> {
    const projects = await safeReaddir(this.paths.mcpLogsBaseDir);
    const byServer = new Map<string, McpLogSummary>();

    for (const projectSlug of projects) {
      const projectPath = join(this.paths.mcpLogsBaseDir, projectSlug);
      for (const entry of await safeReaddir(projectPath)) {
        const match = /^mcp-logs-(.+)$/.exec(entry);
        if (!match) continue;
        const server = match[1]!;
        const newest = await this.newestJsonl(join(projectPath, entry));
        if (newest === undefined) continue;

        const raw = await readFile(newest, 'utf8').catch(() => '');
        const result = classifyMcpLog(parseJsonl(raw));
        const summary: McpLogSummary = {
          server,
          state: result.state,
          ...(result.detail !== undefined ? { detail: result.detail } : {}),
          ...(result.sessionId !== undefined ? { sessionId: result.sessionId } : {}),
        };

        const existing = byServer.get(server);
        if (existing === undefined || RANK[summary.state] > RANK[existing.state]) {
          byServer.set(server, summary);
        }
      }
    }

    return [...byServer.values()];
  }

  private async newestJsonl(logDir: string): Promise<string | undefined> {
    const files = (await safeReaddir(logDir)).filter((f) => f.endsWith('.jsonl'));
    let newest: string | undefined;
    let newestMtime = -Infinity;
    for (const file of files) {
      const full = join(logDir, file);
      try {
        const info = await stat(full);
        if (info.mtimeMs > newestMtime) {
          newestMtime = info.mtimeMs;
          newest = full;
        }
      } catch (err) {
        if (!isNotFound(err)) throw err;
      }
    }
    return newest;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/main/infrastructure/claude-runtime/fs-claude-runtime-reader.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/main/infrastructure/claude-runtime/fs-claude-runtime-reader.ts tests/main/infrastructure/claude-runtime/fs-claude-runtime-reader.test.ts
git commit -m "feat(health): add FsClaudeRuntimeReader for Claude runtime files"
```

---

## Task 10: `NotificationPort` + `ElectronNotificationAdapter`

**Files:**

- Create: `src/main/application/ports/notification-port.ts`
- Create: `src/main/infrastructure/notification/electron-notification-adapter.ts`
- Modify: `vitest.config.ts` (coverage exclude)

The adapter touches the Electron `Notification` API and cannot run headless, so it is excluded from coverage (mirroring the existing `infrastructure/dialog/**` exclusion). No unit test.

- [ ] **Step 1: Create the port**

`src/main/application/ports/notification-port.ts`:

```ts
export interface NotificationPort {
  notify(args: { title: string; body: string }): Promise<void>;
}
```

- [ ] **Step 2: Create the adapter**

`src/main/infrastructure/notification/electron-notification-adapter.ts`:

```ts
import { Notification } from 'electron';
import type { NotificationPort } from '../../application/ports/notification-port.js';

export class ElectronNotificationAdapter implements NotificationPort {
  async notify(args: { title: string; body: string }): Promise<void> {
    if (!Notification.isSupported()) return;
    new Notification({ title: args.title, body: args.body }).show();
  }
}
```

- [ ] **Step 3: Exclude the adapter from coverage**

In `vitest.config.ts`, find the `coverage.exclude` array:

```ts
      exclude: [
        'src/main/infrastructure/dialog/**',
        'src/main/infrastructure/settings/in-memory-settings-repository.ts',
      ],
```

Replace it with:

```ts
      exclude: [
        'src/main/infrastructure/dialog/**',
        'src/main/infrastructure/notification/**',
        'src/main/infrastructure/settings/in-memory-settings-repository.ts',
      ],
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/application/ports/notification-port.ts src/main/infrastructure/notification/electron-notification-adapter.ts vitest.config.ts
git commit -m "feat(health): add NotificationPort and Electron adapter"
```

---

## Task 11: IPC `health.*` handlers

**Files:**

- Create: `src/main/ipc/health-handlers.ts`
- Test: `tests/main/ipc/health-handlers.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/main/ipc/health-handlers.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { buildHealthHandlers } from '../../../src/main/ipc/health-handlers.js';
import type { HealthService } from '../../../src/main/application/services/health/health-service.js';
import type { NotificationPort } from '../../../src/main/application/ports/notification-port.js';
import type { HealthReport } from '../../../src/shared/health.js';

const report: HealthReport = {
  generatedAt: '2026-06-05T10:00:00.000Z',
  worst: 'ok',
  counts: { ok: 0, warning: 0, error: 0 },
  checks: [],
};

const setup = () => {
  const getReport = vi.fn().mockResolvedValue(report);
  const notify = vi.fn().mockResolvedValue(undefined);
  const handlers = buildHealthHandlers(
    { getReport } as unknown as HealthService,
    { notify } as NotificationPort,
  );
  return { handlers, getReport, notify };
};

describe('health.getReport handler', () => {
  it('passes the validated scope through to the service', async () => {
    const { handlers, getReport } = setup();
    const result = await handlers['health.getReport']!({ scope: 'project' });
    expect(getReport).toHaveBeenCalledWith('project');
    expect(result).toEqual(report);
  });

  it('defaults scope to personal when absent', async () => {
    const { handlers, getReport } = setup();
    await handlers['health.getReport']!({});
    expect(getReport).toHaveBeenCalledWith('personal');
  });

  it('rejects an invalid scope', async () => {
    const { handlers } = setup();
    await expect(handlers['health.getReport']!({ scope: 'nope' })).rejects.toThrow();
  });
});

describe('health.notify handler', () => {
  it('forwards a validated title and body to the notification port', async () => {
    const { handlers, notify } = setup();
    await handlers['health.notify']!({ title: 'T', body: 'B' });
    expect(notify).toHaveBeenCalledWith({ title: 'T', body: 'B' });
  });

  it('rejects when title is missing', async () => {
    const { handlers } = setup();
    await expect(handlers['health.notify']!({ body: 'B' })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/main/ipc/health-handlers.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

`src/main/ipc/health-handlers.ts`:

```ts
import type { IpcHandlers } from './dispatcher.js';
import type { HealthService } from '../application/services/health/health-service.js';
import type { NotificationPort } from '../application/ports/notification-port.js';
import { asObject, asScope, asString, optParams } from './_validators.js';

export function buildHealthHandlers(
  healthService: HealthService,
  notificationPort: NotificationPort,
): IpcHandlers {
  return {
    'health.getReport': (params) => {
      const raw = optParams(params, 'health.getReport');
      const scope = raw['scope'] === undefined ? 'personal' : asScope(raw['scope']);
      return healthService.getReport(scope);
    },

    'health.notify': async (params) => {
      const raw = asObject(params, 'health.notify');
      const title = asString(raw['title'], 'title');
      const body = asString(raw['body'], 'body');
      await notificationPort.notify({ title, body });
    },
  };
}
```

> Note: `asObject`, `asScope`, `asString`, `optParams` already exist in `src/main/ipc/_validators.ts`. `asScope` throws `DomainError('validation', …)` on a bad value, which the dispatcher maps to `kind: 'validation'`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/main/ipc/health-handlers.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/main/ipc/health-handlers.ts tests/main/ipc/health-handlers.test.ts
git commit -m "feat(health): add health.* IPC handlers"
```

---

## Task 12: Register `health.*` in the IPC registry

**Files:**

- Modify: `src/main/ipc/registry.ts`

No new unit test (the handler logic is covered by Task 11; this is wiring verified by typecheck/build). The composition root that supplies the new deps is wired in Task 16 — until then `npm run build` would fail because `index.ts` doesn't yet pass `healthService`. Do Tasks 12 and 16 together if you want a green build between commits; otherwise commit 12 and 16 as a pair.

- [ ] **Step 1: Add the imports**

In `src/main/ipc/registry.ts`, after the existing handler-builder imports (the `buildMarketplaceHandlers` import on line 27), add:

```ts
import { buildHealthHandlers } from './health-handlers.js';
import type { HealthService } from '../application/services/health/health-service.js';
import type { NotificationPort } from '../application/ports/notification-port.js';
```

- [ ] **Step 2: Extend `IpcDeps`**

In the `IpcDeps` interface, add two fields (after `marketplaceService`):

```ts
  marketplaceService: MarketplaceService;
  healthService: HealthService;
  notificationPort: NotificationPort;
  appQuit: () => void;
```

- [ ] **Step 3: Destructure the new deps**

In `buildHandlers`, add to the destructuring block (after `marketplaceService`):

```ts
    marketplaceService,
    healthService,
    notificationPort,
    appQuit,
  } = deps;
```

- [ ] **Step 4: Spread the health handlers**

In the returned handlers object, add after `...buildMarketplaceHandlers(marketplaceService),`:

```ts
    ...buildMarketplaceHandlers(marketplaceService),
    ...buildHealthHandlers(healthService, notificationPort),
  };
```

- [ ] **Step 5: Typecheck (expect a known error at the call site)**

Run: `npm run typecheck`
Expected: FAIL with a single error in `src/main/index.ts` — `buildHandlers` is now missing `healthService` and `notificationPort`. This is resolved in Task 16. If you are doing Tasks 12+16 as a pair, run typecheck after Task 16 instead.

- [ ] **Step 6: Commit**

```bash
git add src/main/ipc/registry.ts
git commit -m "feat(health): register health.* namespace in IPC registry"
```

---

## Task 13: `ConfigDriftCollector`

**Files:**

- Create: `src/main/application/services/health/config-drift-collector.ts`
- Test: `tests/main/application/services/health/config-drift-collector.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/main/application/services/health/config-drift-collector.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  ConfigDriftCollector,
  type PluginDriftLister,
} from '../../../../../src/main/application/services/health/config-drift-collector.js';
import type { PluginListItem } from '../../../../../src/main/application/services/plugin-service.js';
import { FixedClock } from '../../../../../src/main/infrastructure/clock/fixed-clock.js';

const FROZEN = new Date('2026-06-05T10:00:00.000Z');

const item = (id: string, drift?: PluginListItem['drift']): PluginListItem =>
  ({
    id: id as PluginListItem['id'],
    origin: 'imported',
    scope: 'personal',
    enabled: true,
    installedAt: FROZEN.toISOString(),
    ...(drift !== undefined ? { drift } : {}),
  }) as PluginListItem;

const setup = (items: PluginListItem[]) => {
  const plugins: PluginDriftLister = { list: () => Promise.resolve(items) };
  return new ConfigDriftCollector(plugins, new FixedClock(FROZEN));
};

describe('ConfigDriftCollector', () => {
  it('reports category config-drift', () => {
    expect(setup([]).category).toBe('config-drift');
  });

  it('emits no checks when no plugin has drift', async () => {
    const collector = setup([item('clean')]);
    await expect(collector.collect('personal')).resolves.toEqual([]);
  });

  it('emits a warning check per drifting plugin with kind in the detail', async () => {
    const collector = setup([
      item('clean'),
      item('ghost', { kind: 'not_in_registry' }),
      item('missing', { kind: 'symlink_missing', details: 'link gone' }),
    ]);

    const checks = await collector.collect('personal');

    expect(checks).toHaveLength(2);
    const ghost = checks.find((c) => c.target === 'ghost');
    expect(ghost).toMatchObject({
      id: 'config-drift:ghost',
      category: 'config-drift',
      severity: 'warning',
      observedAt: FROZEN.toISOString(),
    });
    expect(ghost?.detail).toContain('not_in_registry');
    expect(checks.find((c) => c.target === 'missing')?.detail).toContain('link gone');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/main/application/services/health/config-drift-collector.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

`src/main/application/services/health/config-drift-collector.ts`:

```ts
import type { HealthCheck } from '../../../../shared/health.js';
import type { ClockPort } from '../../ports/clock-port.js';
import type { Scope } from '../../ports/scope.js';
import type { PluginListItem } from '../plugin-service.js';
import type { HealthCollector } from './health-collector.js';

/** Minimal slice of PluginService the collector needs. */
export interface PluginDriftLister {
  list(scope: Scope): Promise<PluginListItem[]>;
}

const REMEDIATION: Record<NonNullable<PluginListItem['drift']>['kind'], string> = {
  not_in_settings: 'Enable or remove this plugin so settings and registry agree.',
  not_in_registry: 'Reinstall the plugin or remove it from Claude settings.',
  symlink_missing: 'Re-sync adapters to recreate the plugin symlink.',
};

export class ConfigDriftCollector implements HealthCollector {
  readonly category = 'config-drift' as const;

  constructor(
    private readonly plugins: PluginDriftLister,
    private readonly clock: ClockPort,
  ) {}

  async collect(scope: Scope): Promise<HealthCheck[]> {
    const items = await this.plugins.list(scope);
    const observedAt = this.clock.now().toISOString();

    return items
      .filter(
        (item): item is PluginListItem & { drift: NonNullable<PluginListItem['drift']> } =>
          item.drift !== undefined,
      )
      .map((item) => {
        const id = String(item.id);
        const detail =
          item.drift.details !== undefined
            ? `${item.drift.kind}: ${item.drift.details}`
            : item.drift.kind;
        return {
          id: `config-drift:${id}`,
          category: 'config-drift',
          severity: 'warning',
          title: `Plugin drift: ${id}`,
          target: id,
          detail,
          remediation: REMEDIATION[item.drift.kind],
          observedAt,
        };
      });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/main/application/services/health/config-drift-collector.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/main/application/services/health/config-drift-collector.ts tests/main/application/services/health/config-drift-collector.test.ts
git commit -m "feat(health): add ConfigDriftCollector"
```

---

## Task 14: `AdapterManager.planDestinations()`

A read-only sibling of `syncAll()` that resolves expected `(source, destination)` pairs without touching the filesystem. Consumed by the `SymlinkCollector` in Task 15.

**Files:**

- Modify: `src/main/application/services/adapter-manager.ts`
- Test: `tests/main/application/services/health/plan-destinations.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/main/application/services/health/plan-destinations.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { AdapterManager } from '../../../../../src/main/application/services/adapter-manager.js';
import type { SettingsService } from '../../../../../src/main/application/services/settings-service.js';
import type { SymlinkManager } from '../../../../../src/main/application/services/symlink-manager.js';
import type { Adapter } from '../../../../../src/main/application/ports/adapter.js';
import { InMemoryCustomizationRepository } from '../../../../../src/main/infrastructure/customization/in-memory-customization-repository.js';
import { FakeAdapter } from '../../../../../src/main/application/services/__fixtures__/fake-adapter.js';
import { getDefaults, type Settings } from '../../../../../src/shared/settings.js';
import type { Customization } from '../../../../../src/shared/customization.js';

const FROZEN = '2026-06-05T10:00:00.000Z';

// Double-cast through `unknown`: AdapterManager only reads name/type/scopes at
// runtime, so we avoid coupling the test to every required frontmatter field.
const skill = (name: string): Customization =>
  ({
    id: `skill/${name}`,
    frontmatter: {
      name,
      type: 'skill',
      description: `${name}`,
      scopes: ['personal'],
      createdAt: FROZEN,
      updatedAt: FROZEN,
    },
    body: 'body',
  }) as unknown as Customization;

const settingsWith = (over: Partial<Settings> = {}): Settings => ({
  ...getDefaults(),
  adapters: { claude: { enabled: true } },
  ...over,
});

const setup = async () => {
  const repo = new InMemoryCustomizationRepository();
  await repo.save({ customization: skill('alpha') });

  const settings = settingsWith();
  const settingsService = {
    load: () => Promise.resolve(settings),
    getDefaults: () => getDefaults(),
  } as unknown as SettingsService;

  const adapter: Adapter = new FakeAdapter('claude', '/home/.claude/skills/alpha');

  const manager = new AdapterManager({
    settingsService,
    customizationRepository: repo,
    symlinkManager: {} as SymlinkManager,
    adapters: new Map<string, Adapter>([['claude', adapter]]),
    workspacePath: '/ws',
  });
  return { manager };
};

describe('AdapterManager.planDestinations', () => {
  it('resolves expected (source, destination) pairs for enabled adapters', async () => {
    const { manager } = await setup();
    const plan = await manager.planDestinations();

    expect(plan).toEqual([
      {
        adapterId: 'claude',
        source: '/ws/skills/alpha',
        destination: '/home/.claude/skills/alpha',
        scope: 'personal',
      },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/main/application/services/health/plan-destinations.test.ts`
Expected: FAIL — `manager.planDestinations is not a function`.

- [ ] **Step 3: Add the type and method**

In `src/main/application/services/adapter-manager.ts`, add this exported interface near the other result interfaces (e.g. after `RemoveOneCommand` on line 43):

```ts
export interface SymlinkPlanEntry {
  adapterId: string;
  source: string;
  destination: string;
  scope: 'personal' | 'project';
}
```

Then add this public method to the `AdapterManager` class (e.g. directly after `countDestinations`, before the private `removeDestination`):

```ts
  /**
   * Read-only resolution of every expected symlink across enabled adapters and
   * all customizations. Mirrors syncAll's resolution but performs NO filesystem
   * writes — used by the health SymlinkCollector to validate integrity.
   */
  async planDestinations(): Promise<SymlinkPlanEntry[]> {
    const settings =
      (await this.deps.settingsService.load()) ?? this.deps.settingsService.getDefaults();
    const enabledAdapters = this.enabledAdapters(settings);
    const customizations = await this.deps.customizationRepository.list();

    const entries: SymlinkPlanEntry[] = [];
    for (const customization of customizations) {
      const source = this.customizationSourcePath(customization, this.deps.workspacePath);
      for (const adapter of enabledAdapters) {
        const destinations = await adapter.resolveDestinations({
          customization,
          linkedRepos: settings.linkedRepos,
        });
        for (const dest of destinations) {
          entries.push({
            adapterId: adapter.adapterId,
            source,
            destination: dest.destination,
            scope: dest.scope,
          });
        }
      }
    }
    return entries;
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/main/application/services/health/plan-destinations.test.ts`
Expected: PASS (1 test).

> If the assertion fails on `source`, confirm the existing private `customizationSourcePath` builds skill sources as `join(workspacePath, 'skills', name)` (it does, per `adapter-manager.ts:259-272`). Adjust the expected `source` in the test only if the repo's path logic has since changed.

- [ ] **Step 5: Run the existing adapter-manager suite to confirm no regression**

Run: `npx vitest run tests/main/application/services/__tests__`
Expected: PASS (all existing adapter-manager/symlink-manager focused suites still green).

- [ ] **Step 6: Commit**

```bash
git add src/main/application/services/adapter-manager.ts tests/main/application/services/health/plan-destinations.test.ts
git commit -m "feat(health): add AdapterManager.planDestinations for symlink checks"
```

---

## Task 15: `SymlinkCollector`

**Files:**

- Create: `src/main/application/services/health/symlink-collector.ts`
- Test: `tests/main/application/services/health/symlink-collector.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/main/application/services/health/symlink-collector.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  SymlinkCollector,
  type SymlinkPlanner,
  type SymlinkValidator,
} from '../../../../../src/main/application/services/health/symlink-collector.js';
import type { SymlinkPlanEntry } from '../../../../../src/main/application/services/adapter-manager.js';
import type { SymlinkValidateState } from '../../../../../src/main/application/services/symlink-manager.js';
import { FixedClock } from '../../../../../src/main/infrastructure/clock/fixed-clock.js';

const FROZEN = new Date('2026-06-05T10:00:00.000Z');

const entry = (destination: string): SymlinkPlanEntry => ({
  adapterId: 'claude',
  source: `/ws/skills/${destination}`,
  destination: `/home/.claude/skills/${destination}`,
  scope: 'personal',
});

const setup = (entries: SymlinkPlanEntry[], states: Record<string, SymlinkValidateState>) => {
  const planner: SymlinkPlanner = { planDestinations: () => Promise.resolve(entries) };
  const validator: SymlinkValidator = {
    validate: ({ destination }) => Promise.resolve(states[destination] ?? 'none'),
  };
  return new SymlinkCollector(planner, validator, new FixedClock(FROZEN));
};

describe('SymlinkCollector', () => {
  it('reports category symlink', () => {
    expect(setup([], {}).category).toBe('symlink');
  });

  it('classifies a correct link as ok', async () => {
    const collector = setup([entry('alpha')], {
      '/home/.claude/skills/alpha': 'symlink-to-source',
    });
    const checks = await collector.collect('personal');
    expect(checks[0]).toMatchObject({
      category: 'symlink',
      severity: 'ok',
      target: '/home/.claude/skills/alpha',
      observedAt: FROZEN.toISOString(),
    });
  });

  it('classifies a missing link as error', async () => {
    const collector = setup([entry('alpha')], { '/home/.claude/skills/alpha': 'none' });
    const checks = await collector.collect('personal');
    expect(checks[0]?.severity).toBe('error');
    expect(checks[0]?.remediation).toBeDefined();
  });

  it('classifies a link pointing elsewhere as error', async () => {
    const collector = setup([entry('alpha')], {
      '/home/.claude/skills/alpha': 'symlink-to-other',
    });
    expect((await collector.collect('personal'))[0]?.severity).toBe('error');
  });

  it('classifies a real file at the destination as warning', async () => {
    const collector = setup([entry('alpha')], {
      '/home/.claude/skills/alpha': 'real-file',
    });
    expect((await collector.collect('personal'))[0]?.severity).toBe('warning');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/main/application/services/health/symlink-collector.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

`src/main/application/services/health/symlink-collector.ts`:

```ts
import type { HealthCheck, Severity } from '../../../../shared/health.js';
import type { ClockPort } from '../../ports/clock-port.js';
import type { Scope } from '../../ports/scope.js';
import type { SymlinkPlanEntry } from '../adapter-manager.js';
import type { SymlinkValidateState } from '../symlink-manager.js';
import type { HealthCollector } from './health-collector.js';

/** Minimal slices of the collaborators this collector needs. */
export interface SymlinkPlanner {
  planDestinations(): Promise<SymlinkPlanEntry[]>;
}

export interface SymlinkValidator {
  validate(args: { destination: string; source?: string }): Promise<SymlinkValidateState>;
}

interface Verdict {
  severity: Severity;
  title: string;
  remediation?: string;
}

function verdictFor(state: SymlinkValidateState, destination: string): Verdict {
  switch (state) {
    case 'symlink-to-source':
      return { severity: 'ok', title: `Symlink OK: ${destination}` };
    case 'none':
      return {
        severity: 'error',
        title: `Symlink missing: ${destination}`,
        remediation: 'Re-sync the adapter to recreate this symlink.',
      };
    case 'symlink-to-other':
      return {
        severity: 'error',
        title: `Symlink points elsewhere: ${destination}`,
        remediation: 'Re-sync the adapter to repoint this symlink.',
      };
    case 'real-file':
      return {
        severity: 'warning',
        title: `Real file blocks symlink: ${destination}`,
        remediation: 'Remove or back up the real file, then re-sync.',
      };
  }
}

export class SymlinkCollector implements HealthCollector {
  readonly category = 'symlink' as const;

  constructor(
    private readonly planner: SymlinkPlanner,
    private readonly validator: SymlinkValidator,
    private readonly clock: ClockPort,
  ) {}

  async collect(_scope: Scope): Promise<HealthCheck[]> {
    const entries = await this.planner.planDestinations();
    const observedAt = this.clock.now().toISOString();

    const checks: HealthCheck[] = [];
    for (const entry of entries) {
      const state = await this.validator.validate({
        destination: entry.destination,
        source: entry.source,
      });
      const verdict = verdictFor(state, entry.destination);
      checks.push({
        id: `symlink:${entry.adapterId}:${entry.destination}`,
        category: 'symlink',
        severity: verdict.severity,
        title: verdict.title,
        target: entry.destination,
        observedAt,
        ...(verdict.remediation !== undefined ? { remediation: verdict.remediation } : {}),
      });
    }
    return checks;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/main/application/services/health/symlink-collector.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/main/application/services/health/symlink-collector.ts tests/main/application/services/health/symlink-collector.test.ts
git commit -m "feat(health): add SymlinkCollector"
```

---

## Task 16: Wire everything in the composition root

**Files:**

- Modify: `src/main/index.ts`

This closes the main-process wiring so `buildHandlers` receives `healthService` and `notificationPort`. No unit test (composition root); verified by `typecheck` + `build` + the existing IPC/registry tests.

- [ ] **Step 1: Add imports**

In `src/main/index.ts`, add to the import block (group with the other infrastructure/service imports):

```ts
import { FsClaudeRuntimeReader } from './infrastructure/claude-runtime/fs-claude-runtime-reader.js';
import { ElectronNotificationAdapter } from './infrastructure/notification/electron-notification-adapter.js';
import { HealthService } from './application/services/health/health-service.js';
import { McpAuthCollector } from './application/services/health/mcp-auth-collector.js';
import { McpRuntimeCollector } from './application/services/health/mcp-runtime-collector.js';
import { ConfigDriftCollector } from './application/services/health/config-drift-collector.js';
import { SymlinkCollector } from './application/services/health/symlink-collector.js';
import type { HealthCollector } from './application/services/health/health-collector.js';
```

- [ ] **Step 2: Instantiate the reader, collectors and service**

In `wireIpc()`, after `marketplaceService` is created and `MarketplaceSeeder` has run (just before the `buildHandlers({ … })` call), add:

```ts
const claudeRuntimeReader = new FsClaudeRuntimeReader({
  claudeJsonPath: join(homedir(), '.claude.json'),
  authCachePath: join(homedir(), '.claude', 'mcp-needs-auth-cache.json'),
  mcpLogsBaseDir: join(homedir(), 'Library', 'Caches', 'claude-cli-nodejs'),
});

const healthCollectors: HealthCollector[] = [
  new McpAuthCollector(claudeRuntimeReader, clock),
  new McpRuntimeCollector(claudeRuntimeReader, clock),
  new ConfigDriftCollector(pluginService, clock),
  new SymlinkCollector(adapterManager, symlinkManager, clock),
];
const healthService = new HealthService(healthCollectors, clock);
const notificationPort = new ElectronNotificationAdapter();
```

> `clock`, `pluginService`, `adapterManager`, and `symlinkManager` are all already in scope in `wireIpc()` (created earlier — see `index.ts` wiring). `SymlinkCollector` takes `adapterManager` (uses `planDestinations`) and `symlinkManager` (uses `validate`).

- [ ] **Step 3: Pass the new deps to `buildHandlers`**

Update the `buildHandlers({ … })` call to include the two new deps:

```ts
const handlers = buildHandlers({
  settingsService,
  repoService,
  adapterManager,
  dialogPort,
  pluginService,
  credentialStore,
  skillService,
  agentService,
  commandService,
  hookService,
  globalInstructionService,
  marketplaceService,
  healthService,
  notificationPort,
  appQuit: () => app.quit(),
});
```

- [ ] **Step 4: Typecheck (now fully resolves)**

Run: `npm run typecheck`
Expected: PASS — the Task 12 call-site error is now resolved.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: PASS — main/preload/renderer bundles produced into `out/`.

- [ ] **Step 6: Run the IPC suites**

Run: `npx vitest run tests/main/ipc`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/main/index.ts
git commit -m "feat(health): wire health collectors, service and notifications in composition root"
```

---

## Task 17: `useHealthReport` renderer hook

**Files:**

- Create: `src/renderer/hooks/use-health-report.ts`
- Test: `tests/renderer/hooks/use-health-report.test.tsx`

- [ ] **Step 1: Write the failing test**

`tests/renderer/hooks/use-health-report.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { useHealthReport, healthQueryKey } from '../../../src/renderer/hooks/use-health-report.js';
import type { HealthReport } from '../../../src/shared/health.js';
import { mockApi, ok, makeTestQueryClient, type CallSpy } from '../test-utils.js';

let call: CallSpy;

const report: HealthReport = {
  generatedAt: '2026-06-05T10:00:00.000Z',
  worst: 'warning',
  counts: { ok: 1, warning: 1, error: 0 },
  checks: [],
};

beforeEach(() => {
  call = mockApi();
});

describe('useHealthReport', () => {
  it('builds a stable query key per scope', () => {
    expect(healthQueryKey('personal')).toEqual(['health', 'personal']);
  });

  it('calls health.getReport with the scope and returns the report', async () => {
    call.mockResolvedValue(ok(report));
    const client = makeTestQueryClient();

    const { result } = renderHook(() => useHealthReport('personal'), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    await waitFor(() => expect(result.current.data).toEqual(report));
    expect(call).toHaveBeenCalledWith('health.getReport', { scope: 'personal' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/renderer/hooks/use-health-report.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

`src/renderer/hooks/use-health-report.ts`:

```ts
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { callIpc } from '../lib/ipc.js';
import type { HealthReport } from '../../shared/health.js';

export type HealthScope = 'personal' | 'project';

export const HEALTH_POLL_INTERVAL_MS = 30_000;

export function healthQueryKey(scope: HealthScope = 'personal'): readonly unknown[] {
  return ['health', scope] as const;
}

export function useHealthReport(scope: HealthScope = 'personal'): UseQueryResult<HealthReport> {
  return useQuery<HealthReport>({
    queryKey: healthQueryKey(scope),
    queryFn: () => callIpc<HealthReport>('health.getReport', { scope }),
    refetchInterval: HEALTH_POLL_INTERVAL_MS,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/renderer/hooks/use-health-report.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/hooks/use-health-report.ts tests/renderer/hooks/use-health-report.test.tsx
git commit -m "feat(health): add useHealthReport polling hook"
```

---

## Task 18: Add a `warning` palette token

**Files:**

- Modify: `src/renderer/theme.ts`

The badge maps `severity: 'warning'` to `warning.main`. The theme currently defines `error` and `success` but not `warning`; add it so the amber is a curated design token (instead of MUI's default orange).

- [ ] **Step 1: Add the warning palette entry**

In `src/renderer/theme.ts`, inside `palette`, add a `warning` line after `error`:

```ts
      error: { main: isDark ? '#ff6b6b' : '#d32f2f' },
      warning: { main: isDark ? '#ffb74d' : '#ed6c02' },
      success: { main: isDark ? '#5fd58a' : '#2e7d32' },
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/theme.ts
git commit -m "feat(health): add warning palette token for severity badges"
```

---

## Task 19: `HealthScreen` (Diagnostics)

**Files:**

- Create: `src/renderer/screens/health/HealthScreen.tsx`
- Test: `tests/renderer/screens/health/HealthScreen.test.tsx`

- [ ] **Step 1: Write the failing test**

`tests/renderer/screens/health/HealthScreen.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HealthScreen } from '../../../../src/renderer/screens/health/HealthScreen.js';
import type { HealthReport } from '../../../../src/shared/health.js';
import { mockApi, ok, renderWithQuery, type CallSpy } from '../../test-utils.js';

let call: CallSpy;

const reportWith = (checks: HealthReport['checks']): HealthReport => ({
  generatedAt: '2026-06-05T10:00:00.000Z',
  worst: checks.some((c) => c.severity === 'error')
    ? 'error'
    : checks.some((c) => c.severity === 'warning')
      ? 'warning'
      : 'ok',
  counts: {
    ok: checks.filter((c) => c.severity === 'ok').length,
    warning: checks.filter((c) => c.severity === 'warning').length,
    error: checks.filter((c) => c.severity === 'error').length,
  },
  checks,
});

beforeEach(() => {
  call = mockApi();
});

describe('<HealthScreen>', () => {
  it('shows an all-clear state when there are no warning/error checks', async () => {
    call.mockResolvedValue(ok(reportWith([])));
    renderWithQuery(<HealthScreen />);
    expect(await screen.findByTestId('health-screen')).toBeInTheDocument();
    expect(await screen.findByTestId('health-all-clear')).toBeInTheDocument();
  });

  it('groups checks by category and renders severity chips', async () => {
    call.mockResolvedValue(
      ok(
        reportWith([
          {
            id: 'mcp-auth:Gmail',
            category: 'mcp-auth',
            severity: 'warning',
            title: 'MCP "Gmail" needs authentication',
            target: 'Gmail',
            remediation: 'Run /mcp in Claude Code to authenticate.',
            observedAt: '2026-06-05T10:00:00.000Z',
          },
          {
            id: 'symlink:claude:/x',
            category: 'symlink',
            severity: 'error',
            title: 'Symlink missing: /x',
            target: '/x',
            observedAt: '2026-06-05T10:00:00.000Z',
          },
        ]),
      ),
    );

    renderWithQuery(<HealthScreen />);

    expect(await screen.findByTestId('health-category-mcp-auth')).toBeInTheDocument();
    expect(screen.getByTestId('health-category-symlink')).toBeInTheDocument();
    expect(screen.getByText('MCP "Gmail" needs authentication')).toBeInTheDocument();
    expect(screen.getByText('Run /mcp in Claude Code to authenticate.')).toBeInTheDocument();
  });

  it('refetches when Refresh is clicked', async () => {
    call.mockResolvedValue(ok(reportWith([])));
    renderWithQuery(<HealthScreen />);
    await screen.findByTestId('health-screen');

    call.mockClear();
    await userEvent.click(screen.getByTestId('health-refresh'));

    expect(call).toHaveBeenCalledWith('health.getReport', { scope: 'personal' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/renderer/screens/health/HealthScreen.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

`src/renderer/screens/health/HealthScreen.tsx`:

```tsx
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { useHealthReport } from '../../hooks/use-health-report.js';
import type { HealthCategory, HealthCheck, Severity } from '../../../shared/health.js';

const CATEGORY_LABEL: Record<HealthCategory, string> = {
  'mcp-auth': 'MCP Authentication',
  'mcp-runtime': 'MCP Runtime',
  'config-drift': 'Config Drift',
  symlink: 'Symlinks',
};

const SEVERITY_COLOR: Record<Severity, 'success' | 'warning' | 'error'> = {
  ok: 'success',
  warning: 'warning',
  error: 'error',
};

const CATEGORY_ORDER: readonly HealthCategory[] = [
  'mcp-auth',
  'mcp-runtime',
  'config-drift',
  'symlink',
];

function groupByCategory(checks: HealthCheck[]): Map<HealthCategory, HealthCheck[]> {
  const groups = new Map<HealthCategory, HealthCheck[]>();
  for (const category of CATEGORY_ORDER) {
    const items = checks.filter((c) => c.category === category);
    if (items.length > 0) groups.set(category, items);
  }
  return groups;
}

export function HealthScreen(): React.ReactElement {
  const { data, isLoading, refetch, isFetching } = useHealthReport('personal');

  const checks = data?.checks ?? [];
  const actionable = checks.filter((c) => c.severity !== 'ok');
  const groups = groupByCategory(checks);

  return (
    <Container component="main" data-testid="health-screen" maxWidth="lg" sx={{ py: 2.5 }}>
      <Stack direction="row" sx={{ mb: 2, justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h5" component="h1">
            Diagnostics
          </Typography>
          {data && (
            <Typography variant="body2" color="text.secondary">
              {data.counts.error} error(s), {data.counts.warning} warning(s), {data.counts.ok} ok
            </Typography>
          )}
        </Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={<RefreshIcon />}
          data-testid="health-refresh"
          disabled={isFetching}
          onClick={() => void refetch()}
        >
          Refresh
        </Button>
      </Stack>

      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={24} />
        </Box>
      )}

      {!isLoading && actionable.length === 0 && (
        <Box
          data-testid="health-all-clear"
          sx={{
            border: 1,
            borderStyle: 'dashed',
            borderColor: 'divider',
            borderRadius: 1,
            p: 4,
            textAlign: 'center',
            color: 'text.secondary',
          }}
        >
          <CheckCircleOutlineIcon color="success" sx={{ fontSize: 40, mb: 1 }} />
          <Typography variant="body1">Everything looks healthy.</Typography>
        </Box>
      )}

      {!isLoading &&
        actionable.length > 0 &&
        [...groups.entries()].map(([category, items]) => (
          <Box key={category} data-testid={`health-category-${category}`} sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
              {CATEGORY_LABEL[category]}
            </Typography>
            <Stack
              divider={<Divider />}
              sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}
            >
              {items.map((check) => (
                <Box
                  key={check.id}
                  data-testid={`health-check-${check.id}`}
                  sx={{ p: 1.5, display: 'flex', gap: 1.5, alignItems: 'flex-start' }}
                >
                  <Chip
                    size="small"
                    label={check.severity}
                    color={SEVERITY_COLOR[check.severity]}
                    variant="outlined"
                  />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2">{check.title}</Typography>
                    {check.detail && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block' }}
                      >
                        {check.detail}
                      </Typography>
                    )}
                    {check.remediation && (
                      <Typography variant="caption" color="primary" sx={{ display: 'block' }}>
                        {check.remediation}
                      </Typography>
                    )}
                  </Box>
                </Box>
              ))}
            </Stack>
          </Box>
        ))}
    </Container>
  );
}
```

> The all-clear branch keys off `actionable` (warning/error) so an all-`ok` report (e.g. healthy MCP rows) still shows the green state rather than a wall of ok chips.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/renderer/screens/health/HealthScreen.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/screens/health/HealthScreen.tsx tests/renderer/screens/health/HealthScreen.test.tsx
git commit -m "feat(health): add Diagnostics HealthScreen"
```

---

## Task 20: Sidebar Diagnostics leaf + severity badge

**Files:**

- Modify: `src/renderer/components/Sidebar.tsx`

Add `'diagnostics'` to `SidebarTab`, render a Diagnostics leaf, and show a colored dot badge driven by an optional `healthSeverity` prop.

- [ ] **Step 1: Add the icon and Badge imports**

In `src/renderer/components/Sidebar.tsx`, add `Badge` to the `@mui/material` import list, and add a health icon import next to the other icon imports:

```ts
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
```

(Add `Badge,` alphabetically inside the existing `{ Box, Collapse, Divider, Drawer, IconButton, List, ... }` destructured import from `@mui/material`.)

- [ ] **Step 2: Extend `SidebarTab` and add a severity type**

Add `'diagnostics'` to the union:

```ts
export type SidebarTab =
  | 'starter-pack'
  | 'skills'
  | 'agents'
  | 'commands'
  | 'hooks'
  | 'global-instructions'
  | 'plugins'
  | 'marketplaces'
  | 'diagnostics';

export type SidebarHealthSeverity = 'ok' | 'warning' | 'error';
```

- [ ] **Step 3: Declare the Diagnostics leaf and include it in `FLAT_LEAVES`**

After the `TOP_ITEM` declaration, add:

```ts
const DIAGNOSTICS_ITEM: NavLeaf = {
  id: 'diagnostics',
  label: 'Diagnostics',
  icon: <MonitorHeartIcon fontSize="small" />,
};
```

Update `FLAT_LEAVES` to include it (so the collapsed rail shows it too):

```ts
const FLAT_LEAVES: ReadonlyArray<NavLeaf> = [
  TOP_ITEM,
  DIAGNOSTICS_ITEM,
  ...GROUPS.flatMap((g) => g.children),
];
```

- [ ] **Step 4: Thread the severity prop through `SidebarProps`**

```ts
interface SidebarProps {
  active: SidebarTab;
  onNavigate: (tab: SidebarTab) => void;
  onOpenSettings: () => void;
  healthSeverity?: SidebarHealthSeverity;
}

export function Sidebar({
  active,
  onNavigate,
  onOpenSettings,
  healthSeverity,
}: SidebarProps): React.ReactElement {
```

- [ ] **Step 5: Render the Diagnostics leaf in both rail modes**

In the collapsed branch, the `FLAT_LEAVES.map(...)` already renders it — extend `LeafButton` to accept a severity (Step 7). In the expanded branch, render it right after the `TOP_ITEM` `LeafButton`:

```tsx
              <LeafButton
                leaf={TOP_ITEM}
                active={active === TOP_ITEM.id}
                collapsed={false}
                onNavigate={onNavigate}
              />
              <LeafButton
                leaf={DIAGNOSTICS_ITEM}
                active={active === DIAGNOSTICS_ITEM.id}
                collapsed={false}
                onNavigate={onNavigate}
                healthSeverity={healthSeverity}
              />
```

And in the collapsed branch, replace the `FLAT_LEAVES.map` body so the diagnostics leaf gets the severity:

```tsx
FLAT_LEAVES.map((leaf) => (
  <LeafButton
    key={leaf.id}
    leaf={leaf}
    active={active === leaf.id}
    collapsed
    onNavigate={onNavigate}
    {...(leaf.id === 'diagnostics' ? { healthSeverity } : {})}
  />
));
```

- [ ] **Step 6: Map severity → MUI Badge color (module scope)**

Add near the other module constants (e.g. after `GROUPS_STORAGE_KEY`):

```ts
const BADGE_COLOR: Record<SidebarHealthSeverity, 'success' | 'warning' | 'error'> = {
  ok: 'success',
  warning: 'warning',
  error: 'error',
};
```

- [ ] **Step 7: Render the badge in `LeafButton`**

Extend `LeafButtonProps` and wrap the icon with a `Badge` when `healthSeverity` is set:

```ts
interface LeafButtonProps {
  leaf: NavLeaf;
  active: boolean;
  collapsed: boolean;
  indented?: boolean;
  onNavigate: (tab: SidebarTab) => void;
  healthSeverity?: SidebarHealthSeverity;
}

function LeafButton({
  leaf,
  active,
  collapsed,
  indented = false,
  onNavigate,
  healthSeverity,
}: LeafButtonProps): React.ReactElement {
  const icon =
    healthSeverity !== undefined ? (
      <Badge
        data-testid="sidebar-health-badge"
        data-severity={healthSeverity}
        color={BADGE_COLOR[healthSeverity]}
        variant="dot"
        overlap="circular"
      >
        {leaf.icon}
      </Badge>
    ) : (
      leaf.icon
    );
```

Then replace `{leaf.icon}` inside the `<ListItemIcon>` with `{icon}`:

```tsx
<ListItemIcon
  sx={{
    minWidth: collapsed ? 0 : 32,
    justifyContent: 'center',
    color: active ? 'primary.main' : 'text.secondary',
  }}
>
  {icon}
</ListItemIcon>
```

- [ ] **Step 8: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

> The badge's render behavior is asserted via `<Main>` in Task 21's test (`data-testid="sidebar-health-badge"`, `data-severity`). `Sidebar.tsx` is not in the coverage gate (`components/**`), so no separate Sidebar coverage is required.

- [ ] **Step 9: Commit**

```bash
git add src/renderer/components/Sidebar.tsx
git commit -m "feat(health): add Diagnostics nav item with live severity badge"
```

---

## Task 21: Wire `HealthScreen`, polling and badge into `Main`

**Files:**

- Modify: `src/renderer/screens/Main.tsx`
- Test: `tests/renderer/screens/main-health.test.tsx`

- [ ] **Step 1: Write the failing test**

`tests/renderer/screens/main-health.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Main } from '../../../src/renderer/screens/Main.js';
import type { HealthReport } from '../../../src/shared/health.js';
import { mockApi, ok, fail, renderWithQuery, type CallSpy } from '../test-utils.js';

let call: CallSpy;

const report = (worst: HealthReport['worst']): HealthReport => ({
  generatedAt: '2026-06-05T10:00:00.000Z',
  worst,
  counts: { ok: 0, warning: 0, error: worst === 'error' ? 1 : 0 },
  checks:
    worst === 'error'
      ? [
          {
            id: 'symlink:claude:/x',
            category: 'symlink',
            severity: 'error',
            title: 'Symlink missing: /x',
            target: '/x',
            observedAt: '2026-06-05T10:00:00.000Z',
          },
        ]
      : [],
});

const setupRoute = (worst: HealthReport['worst']) => {
  call.mockImplementation((method: string) => {
    if (method === 'health.getReport') return Promise.resolve(ok(report(worst)));
    if (method === 'global-instruction.get') {
      return Promise.resolve(fail('not_found', 'none'));
    }
    return Promise.resolve(ok([]));
  });
};

beforeEach(() => {
  call = mockApi();
});

describe('<Main> — health badge + diagnostics', () => {
  it('paints the nav badge with the report worst severity', async () => {
    setupRoute('error');
    renderWithQuery(<Main onOpenSettings={() => undefined} />);

    const badge = await screen.findByTestId('sidebar-health-badge');
    expect(badge).toHaveAttribute('data-severity', 'error');
  });

  it('navigates to the Diagnostics screen from the sidebar', async () => {
    setupRoute('ok');
    renderWithQuery(<Main onOpenSettings={() => undefined} />);

    await screen.findByTestId('starter-pack-screen');
    await userEvent.click(screen.getByTestId('sidebar-diagnostics'));

    expect(await screen.findByTestId('health-screen')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/renderer/screens/main-health.test.tsx`
Expected: FAIL — no `sidebar-health-badge` / `sidebar-diagnostics` wired into `Main` yet.

- [ ] **Step 3: Update `Main.tsx`**

In `src/renderer/screens/Main.tsx`, add imports:

```ts
import { HealthScreen } from './health/HealthScreen.js';
import { useHealthReport } from '../hooks/use-health-report.js';
import { useHealthNotifications } from '../hooks/use-health-notifications.js';
```

Inside the `Main` component, before the `return`, read the report and wire notifications:

```ts
export function Main({ onOpenSettings }: MainProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState<SidebarTab>('starter-pack');
  const { data: healthReport } = useHealthReport('personal');
  useHealthNotifications(healthReport);
```

Pass the severity to `Sidebar`:

```tsx
<Sidebar
  active={activeTab}
  onNavigate={setActiveTab}
  onOpenSettings={onOpenSettings}
  {...(healthReport ? { healthSeverity: healthReport.worst } : {})}
/>
```

Render the screen when the tab is active (add alongside the other `{activeTab === ... && <... />}` lines):

```tsx
{
  activeTab === 'diagnostics' && <HealthScreen />;
}
```

> `useHealthNotifications` is created in Task 22. To keep this task's build green, create a temporary no-op first OR do Tasks 21 and 22 as a pair. Recommended: implement Task 22 immediately after writing this step's imports, then run the tests. (The test above only needs the badge + navigation, both satisfied by Steps 3's `Sidebar`/`HealthScreen` wiring; the notifications hook just needs to exist and be importable.)

- [ ] **Step 4: Create a minimal `use-health-notifications.ts` stub so the import resolves**

`src/renderer/hooks/use-health-notifications.ts` (full behavior lands in Task 22):

```ts
import type { HealthReport } from '../../shared/health.js';

export function useHealthNotifications(_report: HealthReport | undefined): void {
  // Implemented in Task 22.
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/renderer/screens/main-health.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Run the existing Main suite to confirm no regression**

Run: `npx vitest run tests/renderer/screens/main.test.tsx`
Expected: PASS (existing landing/navigation tests still green — `health.getReport` falls through to the existing mock’s default `ok([])`, which the hook tolerates).

- [ ] **Step 7: Commit**

```bash
git add src/renderer/screens/Main.tsx src/renderer/hooks/use-health-notifications.ts tests/renderer/screens/main-health.test.tsx
git commit -m "feat(health): wire Diagnostics screen, polling and badge into Main"
```

---

## Task 22: New-error OS notification (renderer-driven)

**Files:**

- Modify: `src/renderer/hooks/use-health-notifications.ts`
- Test: `tests/renderer/hooks/use-health-notifications.test.tsx`

- [ ] **Step 1: Write the failing test**

`tests/renderer/hooks/use-health-notifications.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useHealthNotifications } from '../../../src/renderer/hooks/use-health-notifications.js';
import type { HealthReport } from '../../../src/shared/health.js';
import { mockApi, ok, type CallSpy } from '../test-utils.js';

let call: CallSpy;

const reportWithErrors = (ids: string[]): HealthReport => ({
  generatedAt: '2026-06-05T10:00:00.000Z',
  worst: ids.length > 0 ? 'error' : 'ok',
  counts: { ok: 0, warning: 0, error: ids.length },
  checks: ids.map((id) => ({
    id,
    category: 'symlink',
    severity: 'error',
    title: `Problem ${id}`,
    observedAt: '2026-06-05T10:00:00.000Z',
  })),
});

beforeEach(() => {
  call = mockApi();
  call.mockResolvedValue(ok(undefined));
});

describe('useHealthNotifications', () => {
  it('does not notify on the first report (priming)', () => {
    renderHook(({ report }) => useHealthNotifications(report), {
      initialProps: { report: reportWithErrors(['e1']) },
    });
    expect(call).not.toHaveBeenCalled();
  });

  it('notifies when a NEW error id appears after priming', () => {
    const { rerender } = renderHook(({ report }) => useHealthNotifications(report), {
      initialProps: { report: reportWithErrors(['e1']) as HealthReport | undefined },
    });

    rerender({ report: reportWithErrors(['e1', 'e2']) });

    expect(call).toHaveBeenCalledTimes(1);
    const [method, params] = call.mock.calls[0]!;
    expect(method).toBe('health.notify');
    expect(params).toMatchObject({
      title: expect.any(String),
      body: expect.stringContaining('e2'),
    });
  });

  it('does not re-notify for an error id already seen', () => {
    const { rerender } = renderHook(({ report }) => useHealthNotifications(report), {
      initialProps: { report: reportWithErrors(['e1']) as HealthReport | undefined },
    });
    rerender({ report: reportWithErrors(['e1', 'e2']) });
    call.mockClear();
    rerender({ report: reportWithErrors(['e1', 'e2']) });
    expect(call).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/renderer/hooks/use-health-notifications.test.tsx`
Expected: FAIL — the stub never calls `health.notify`.

- [ ] **Step 3: Replace the stub with the real implementation**

`src/renderer/hooks/use-health-notifications.ts`:

```ts
import { useEffect, useRef } from 'react';
import { callIpc } from '../lib/ipc.js';
import type { HealthReport } from '../../shared/health.js';

/**
 * Fires an OS notification (via health.notify) only when a NEW error id appears
 * while the app is open. The first report primes the seen-set WITHOUT notifying,
 * so pre-existing errors at launch don't spam the user.
 */
export function useHealthNotifications(report: HealthReport | undefined): void {
  const seen = useRef<Set<string>>(new Set());
  const primed = useRef(false);

  useEffect(() => {
    if (!report) return;

    const errorIds = report.checks.filter((c) => c.severity === 'error').map((c) => c.id);

    if (!primed.current) {
      seen.current = new Set(errorIds);
      primed.current = true;
      return;
    }

    const fresh = errorIds.filter((id) => !seen.current.has(id));
    for (const id of errorIds) seen.current.add(id);
    if (fresh.length === 0) return;

    const first = report.checks.find((c) => c.id === fresh[0]);
    const body =
      fresh.length === 1 && first
        ? `${first.title} (${first.id})`
        : `${fresh.length} new problems detected: ${fresh.join(', ')}`;

    void callIpc('health.notify', {
      title: 'Skillforge — a problem was detected',
      body,
    });
  }, [report]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/renderer/hooks/use-health-notifications.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/hooks/use-health-notifications.ts tests/renderer/hooks/use-health-notifications.test.tsx
git commit -m "feat(health): notify on newly appeared health errors"
```

---

## Task 23: Full verification gate

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS — both `node` and `jsdom` projects green, including all new health tests.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: PASS — no lint errors.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Coverage**

Run: `npm test -- --coverage`
Expected: PASS — thresholds met (lines/functions/statements ≥ 80, branches ≥ 70). New covered files: `src/main/application/services/health/**`, `src/main/infrastructure/claude-runtime/**`, `src/main/ipc/health-handlers.ts`, `src/renderer/screens/health/**`. The Electron notification adapter is excluded.

> If coverage dips below threshold on `fs-claude-runtime-reader.ts` (its multi-project/duplicate-server branch), add a fixture case in its test: two project slugs both containing `mcp-logs-gmail`, one `error` and one `ok`, asserting the worse state wins.

- [ ] **Step 5: Production build**

Run: `npm run build`
Expected: PASS — `out/{main,preload,renderer}` produced.

- [ ] **Step 6: Format**

Run: `npm run format`
Expected: files formatted; review and commit any changes.

- [ ] **Step 7: Final commit (if formatting changed anything)**

```bash
git add -A
git commit -m "chore(health): format and finalize monitoring mechanism"
```

---

## Self-review notes (coverage of the spec)

- **Config drift (#1 priority), MCP health (#2), symlink integrity (#3):** Tasks 13, 7+9+4, 15+14 respectively. ✅
- **"mcps em alertas" = `mcp-needs-auth-cache.json`:** Task 9 `readMcpAuthAlerts` + Task 6 `McpAuthCollector`. ✅
- **Log-format false-positive nuance (explicit test case):** Task 4 `classifyMcpLog` (INFO-only → ok, timeout → error) + Task 9 integration test. ✅
- **Hybrid pull + live badge + OS notification on new error:** polling Task 17, badge Tasks 20–21, notification Task 22 (primed). ✅
- **Ports, collectors, isolation, `worst`/`counts` rollup:** Tasks 3, 6–8, 13, 15. Collector-failure isolation tested in Task 8. ✅
- **IPC `health.getReport` / `health.notify` with `_validators` + `callIpc`:** Tasks 11–12 + 17. ✅
- **ENOENT tolerance everywhere:** Task 9 (`readJson`/`safeReaddir` return empty on ENOENT), tested. ✅
- **Out of scope (persistent history, perf metrics, internal app-error capture, background watcher/push):** not built. ✅

## Out-of-band follow-ups (do NOT include in this plan)

- Project-scoped MCP servers (`~/.claude.json → projects[*].mcpServers`) — MVP reads global `mcpServers` only.
- `SymlinkCollector` currently validates the global plan (personal scope focus); per-scope filtering can follow if the report grows a project tab.
