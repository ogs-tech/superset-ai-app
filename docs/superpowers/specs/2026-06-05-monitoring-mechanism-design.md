# Monitoring Mechanism — Design

**Date:** 2026-06-05
**Status:** Approved (ready for implementation plan)
**Author:** Odenir Gomes (with Claude)

## Problem

The app surfaces health signals in scattered, reactive places: plugin drift only shows
in the plugin list, sync results only appear after you change adapter settings, and there
is no unified place to learn that something went wrong. The user needs a single
monitoring mechanism that proactively answers "is anything broken?" — covering, in
priority order:

1. **Config drift** of plugins/MCPs (enabled here but missing in Claude, or vice-versa).
2. **Real MCP health** via the logs Claude Code writes at runtime.
3. **Symlink/sync integrity**.

Internal app errors (unhandled exceptions, IPC failures) are explicitly **deprioritized**
and out of scope for this iteration.

## Key discovery — data sources are real and readable

The app only syncs configs to Claude Code via symlinks; it does **not** run MCPs. But
Claude Code persists enough state on disk for the app to read:

| Signal                      | Source file(s)                                                                |
| --------------------------- | ----------------------------------------------------------------------------- |
| MCPs configured             | `~/.claude.json` → `mcpServers` (global) + `projects[*].mcpServers`           |
| MCPs "in alert" (need auth) | `~/.claude/mcp-needs-auth-cache.json`                                         |
| MCP runtime health          | `~/Library/Caches/claude-cli-nodejs/<project-slug>/mcp-logs-<server>/*.jsonl` |
| Plugin drift                | `PluginService.list(scope)` (already computes a `drift` field)                |
| Symlink integrity           | `SymlinkManager` validation (already exists)                                  |

**"mcps em alertas" is literally `mcp-needs-auth-cache.json`** — the list of MCP servers
Claude Code flagged as needing authentication.

### Log-format nuance (must not be ignored)

Each `mcp-logs-<server>/*.jsonl` line is either `{"debug":...}` or
`{"error":"Server stderr: ..."}` with `timestamp`, `sessionId`, `cwd`. The `error`
field captures **all** server stderr — including normal `INFO`/`WARNING` lines. Therefore
**"has an `error` field" ≠ "failed."** Classification must key off real failure signals
(connection timeout, "failed to connect", non-zero exit), or it will produce
false positives. This is an explicit test case.

## Chosen approach — Hybrid (pull + live badge + OS notification on new error)

Rejected alternatives:

- **On-demand only** — no live badge, no notification; too passive for "I need to know."
- **Background watcher + push channel** — most robust but requires inventing a push IPC
  protocol (the app only has request/response `ipc:call` today); too much surface for a
  time-boxed spike.

The hybrid keeps clean pull-based collectors, drives "liveness" with react-query polling
while the app is open, and fires an OS notification only when a _new_ error appears —
all without a push channel.

## Architecture

Follows the existing hexagonal layout. Collectors depend on **ports**, never on
`node:fs` directly; all filesystem I/O for Claude's runtime files lives in one adapter.

```
src/main/
  domain/health.ts                              HealthCheck, HealthReport (pure VOs)
  application/ports/claude-runtime-port.ts       reads Claude files the app doesn't own
  application/services/health/
    health-service.ts                            orchestrates collectors -> HealthReport
    collectors/
      mcp-auth-collector.ts                      "mcps em alertas" (auth)
      mcp-runtime-collector.ts                   real health via jsonl logs
      config-drift-collector.ts                  plugin/MCP drift (reuses PluginService)
      symlink-collector.ts                       symlink integrity
  infrastructure/claude-runtime/
    fs-claude-runtime-reader.ts                  implements ClaudeRuntimePort (real fs)
  ipc/registry.ts                                + health.* namespace
src/shared/health.ts                             shared types (main <-> renderer)
src/renderer/
  hooks/use-health-report.ts                     react-query + refetchInterval
  screens/health/HealthScreen.tsx                Diagnostics screen (frontend-design later)
```

Wiring happens in the composition root `src/main/index.ts` (`wireIpc()`), where all
adapters and services are instantiated and passed to `buildHandlers`.

## Units

### `ClaudeRuntimePort` (new port)

```ts
interface ClaudeRuntimePort {
  readMcpServers(): Promise<McpServerConfig[]>; // from ~/.claude.json
  readMcpAuthAlerts(): Promise<McpAuthAlert[]>; // from mcp-needs-auth-cache.json
  readMcpRuntimeLogs(): Promise<McpLogSummary[]>; // newest jsonl per server, classified
}
```

Implemented by `FsClaudeRuntimeReader`. Every read tolerates `ENOENT` (missing file =
empty result, not an error).

### `HealthCollector` (interface)

```ts
interface HealthCollector {
  readonly category: HealthCategory;
  collect(scope: Scope): Promise<HealthCheck[]>;
}
```

Four implementations, one per source. Adding a future source = one new file, zero changes
to existing collectors.

- **`McpAuthCollector`** — one `warning` per MCP needing auth, with remediation hint.
- **`McpRuntimeCollector`** — reads the newest log session per server, classifies last
  connection state into ok/`warning`/`error` using the failure-signal rules above.
- **`ConfigDriftCollector`** — wraps `PluginService.list(scope)`; emits a check per
  plugin carrying a `drift` field (`not_in_settings`, `not_in_registry`, `symlink_missing`).
- **`SymlinkCollector`** — uses the existing `SymlinkManager` validation to verify
  expected symlinks exist and point to the correct source.

### `HealthService`

Runs all collectors in `Promise.all`, **each isolated**: a collector that throws becomes
its own `severity: 'error'` `HealthCheck` instead of failing the whole report. Aggregates
into a `HealthReport` with a `worst` rollup and `counts`.

## Data model

```ts
type Severity = 'ok' | 'warning' | 'error';
type HealthCategory = 'mcp-auth' | 'mcp-runtime' | 'config-drift' | 'symlink';

interface HealthCheck {
  id: string; // stable, e.g. "mcp-auth:claude.ai Gmail"
  category: HealthCategory;
  severity: Severity;
  title: string;
  detail?: string;
  target?: string; // MCP/plugin/symlink name
  remediation?: string; // e.g. "Run /mcp to authenticate"
  observedAt: string; // ISO, via SystemClock (never Date.now() directly)
}

interface HealthReport {
  generatedAt: string;
  worst: Severity; // drives the badge color
  counts: { ok: number; warning: number; error: number };
  checks: HealthCheck[];
}
```

## Data flow (the hybrid)

1. Renderer `useHealthReport()` calls `callIpc<HealthReport>('health.getReport', { scope })`
   with `refetchInterval: 30s`.
2. Nav-rail badge = `report.worst` (green/amber/red). Live while the app is open.
3. Diagnostics screen = `checks` grouped by category, severity chips, remediation hints,
   manual "Refresh".
4. **OS notification:** a renderer effect diffs the previous report's set of `error` ids
   against the new one; when a **new error id** appears, it calls `health.notify` and the
   main process fires `Electron.Notification`. New-error detection stays in the renderer
   (using react-query data); main only displays — no push channel.

## IPC

New namespace `health`:

| Method             | Params                            | Result         |
| ------------------ | --------------------------------- | -------------- |
| `health.getReport` | `{ scope: Scope }`                | `HealthReport` |
| `health.notify`    | `{ title: string; body: string }` | `void`         |

Types in `src/shared/health.ts`. Handlers in `src/main/ipc/registry.ts`; raw params
validated with `_validators.ts` helpers. Renderer calls via `callIpc<T>(...)`.

## Error handling / robustness

- Missing Claude files (e.g. no `mcp-needs-auth-cache.json`) → "no alerts," not an error.
- All filesystem reads tolerate `ENOENT`.
- `McpRuntimeCollector` does **not** flag an error merely because a log line has an
  `error` field — only on real failure signals (timeout, "failed to connect", non-zero
  exit). Explicit test case.
- A collector that throws is contained as its own `error` check; the report always
  renders.

## Testing

Both Vitest projects, hitting the four covered directories
(`application/`, `ipc/`, `infrastructure/`, `renderer/screens/`).

- **node:**
  - Each collector against a fake `ClaudeRuntimePort` with fixtures — including jsonl
    fixtures proving an `INFO`-only stderr session classifies as ok while a real timeout
    classifies as `error` (the false-positive nuance).
  - `HealthService`: `worst` rollup, count aggregation, collector-failure isolation.
  - `FsClaudeRuntimeReader` against a temp dir with fixture files (including missing
    files → empty results).
- **jsdom:**
  - `useHealthReport` hook.
  - `HealthScreen` render: category grouping, empty/all-ok state, severity chips.
  - Nav-rail badge severity from `worst`.

## Scope and order (time-boxed spike)

MVP in priority order:

1. `ClaudeRuntimePort` + `McpAuthCollector` + `McpRuntimeCollector` (covers #4 and the
   "em alertas" signal).
2. `ConfigDriftCollector` (reuses `PluginService.list`) — #3.
3. `SymlinkCollector` — #2.
4. `HealthScreen` + nav badge + react-query polling.
5. OS notification on new error (isolated, last).

**Out of scope:** persistent history / on-disk log, performance metrics, internal
app-error capture (#1, deprioritized by the user), and the background watcher / push
channel.

## Decisions taken (confirmed with user)

1. **Notification is renderer-driven** (diffs new errors) rather than a main-process loop
   — simpler, matches the polling model. Trade-off: only notifies while the app is open.
2. **Polling interval 30s** — balance between liveness and filesystem load; easy to tune.
3. **Symlink (#2) is in the MVP**, not deferred — user listed it as a priority and
   `SymlinkManager` validation already exists, so the cost is low.
