# MCP as a Library Entity — Design

- **Date:** 2026-06-07
- **Status:** Approved (design) — storage model verified against a real machine; pending plan
- **Author:** Odenir Gomes (with Claude)
- **Scope:** Add `mcp` as a first-class entity in the Superset AI library, with CRUD over the
  MCP server configurations the user owns, read-only adoption of plugin-provided servers, and
  health status surfaced inline.

> Written in English to match the existing `docs/reference/*.md` convention. The brainstorming
> conversation that produced it was in pt-BR.

---

## 1. Context and goal

The app currently treats MCP servers as **read-only diagnostics**: the Health (Diagnóstico)
screen reads `~/.claude.json` (`mcpServers`), `~/.claude/mcp-needs-auth-cache.json`, and the
Claude CLI runtime logs, then reports per-server status (ok / warning / error / needs-auth). It
**never writes** any MCP configuration.

The user has many MCP servers and several broken ones (timeouts, failures, servers needing auth).
The goal is to make MCP a **manageable library entity**: list, view, add, edit, remove, and
enable/disable the servers the user owns, **adopt** the existing fleet in place, and **distribute**
shareable configs to project repos. This crosses the line from "read Claude's config" to
"write Claude's config".

## 2. Decisions made during brainstorming

1. **Two independent features** were requested (Prompts and MCP). They are split into separate
   spec → plan → implementation cycles. **This spec covers MCP only.** A separate spec will cover
   Prompts (note: Prompts may be redundant with the existing `command` entity — to be examined
   then).
2. **Architecture: "live-config broker" (Approach C).** The MCP entity keeps **no
   source-of-truth copy** in the workspace. It is an editable view over the real config files.
   Provenance is literally *where the server lives*. Chosen over a workspace-source-of-truth model
   (Approaches A/B) because the primary goal is adopt + repair the existing fleet, and because you
   cannot symlink a key inside a shared JSON file — any workspace copy would drift. The broker
   eliminates drift.
3. **Import/adopt existing servers** (not author-only).
4. **Scopes (refined after verification — see §3):** the app manages **personal/global**,
   **project-local**, and **project-shared** servers (all three writable), and shows
   **plugin** servers read-only.
5. **Plugin-provided MCP servers are read-only**, reusing the existing provenance model and
   `OperationNotAllowedForOriginError`.
6. **Enable/disable toggle is in v1** (disable without losing config).

## 3. Storage model (VERIFIED on a real machine)

The earlier two-location assumption was wrong. The real Claude Code storage has **four**
locations, keyed by where a server physically lives. This was confirmed by reading server
**names only** (no secret values) from a real `~/.claude.json` and the installed plugin
`.mcp.json` files.

| App scope        | Claude scope    | Physical location                                  | Writable | Provenance         |
|------------------|-----------------|----------------------------------------------------|----------|--------------------|
| personal         | user / global   | `~/.claude.json` → `mcpServers[name]`              | yes      | `workspace`        |
| project-local    | local           | `~/.claude.json` → `projects[repoPath].mcpServers[name]` | yes | `workspace`     |
| project-shared   | project         | `<repoPath>/.mcp.json` → `mcpServers[name]`        | yes      | `workspace`        |
| (plugin)         | —               | `<pluginDir>/.mcp.json` → `mcpServers[name]`       | **no**   | `plugin`           |

Verified facts that shape the design:

- The user's hand-added **global** server lives in `~/.claude.json` top-level `mcpServers`
  (e.g. `pencil`).
- The user's **project** servers (e.g. `clickup`, `figma`) live in
  `~/.claude.json` → `projects[<path>].mcpServers` (the **local** scope), NOT in
  `<repo>/.mcp.json`. Each `projects[<path>]` also carries `enabledMcpjsonServers` /
  `disabledMcpjsonServers` arrays.
- **Plugin** server definitions live only in each plugin's `.mcp.json`
  (`~/.claude/plugins/cache/...` and `.../marketplaces/...`), keyed by a simple name
  (`serena`, `github`, `atlassian`, …). Claude merges them at runtime and renames them
  `plugin-<plugin>-<server>` (e.g. `plugin-serena-serena`). **They are never written into
  `~/.claude.json`.** This definitively answers the old open item: plugin MCPs are detected by
  reading plugin `.mcp.json` files, not by scanning `~/.claude.json`.
- Server definitions use a transport shape: stdio = `{ command, args, env, type? }`;
  http/sse = `{ type, url, headers? }`.

**Expectation note (important):** the broken servers in the user's diagnostics
(`serena` timeout, `github` failed, the needs-auth ones) are **plugin-provided or auth issues**.
Because plugin servers are read-only and interactive auth cannot run outside Claude Code, the app
**cannot repair those by editing config**. For them the app surfaces clear status + the documented
remediation (re-auth via `/mcp`, restart). Full CRUD value applies to the **user-owned** servers
(global + project-local + project-shared, and new ones).

## 4. Data model and schema

### Domain (`src/main/domain/`)

- `mcp-location.ts` — the discriminated union identifying exactly where a server lives:
  - `{ kind: 'global' }`
  - `{ kind: 'project-local'; repoPath: string }`
  - `{ kind: 'project-shared'; repoPath: string }`
  - `{ kind: 'plugin'; pluginId: string; pluginDir: string }`
- `mcp-server-id.ts` — identity = **location + name** (the same `name` can exist in several
  locations). Provides `mcpServerId(location, name): string` and a parser back. The name segment
  is validated with the same slug rules used elsewhere where applicable, but MUST tolerate the
  real-world names Claude uses (e.g. `plugin-serena-serena`), so the id is
  `<locationTag>:<name>` with `name` treated opaquely.

### Schema (`src/main/application/schemas/mcp.ts`, zod)

Transport-discriminated union:

- `stdioServerSchema` = `{ command: string, args?: string[], env?: Record<string,string>, type?: 'stdio' }`
- `httpServerSchema`  = `{ type: 'http', url: string, headers?: Record<string,string> }`
- `sseServerSchema`   = `{ type: 'sse',  url: string, headers?: Record<string,string> }`
- `mcpServerDefSchema` = discriminated union, `.passthrough()` so fields Claude supports but we
  don't model survive a round-trip.

This schema is **standalone config** — it does NOT extend `commonFrontmatterSchema` (that schema
is for Markdown entities with frontmatter + body).

### Shared DTO (`src/shared/mcp.ts`)

`McpServer` returned to the renderer: `{ id, name, transport: 'stdio'|'http'|'sse', def,
location, source: CustomizationSource, enabled: boolean, health }`, where `health` is
`{ state: 'ok'|'warning'|'error'|'needs-auth', detail?: string } | undefined`.

## 5. Read/write layer and safety

The existing `ClaudeRuntimePort.readMcpServers()` returns only top-level server **names** and
stays read-only (it backs Health). MCP write capability lives in a **new, separate port** so that
reading runtime logs and writing config never couple.

### Port — `McpConfigPort` (new)

- `read(scope)` → all servers visible for the scope (global + the relevant project blocks +
  plugin), each with full def + location + provenance + enabled flag.
- `upsert(location, name, def)` → write one server to its physical location.
- `remove(location, name)` → delete one server.
- `setEnabled(location, name, enabled)` → enable/disable (see §6).

### Infrastructure (split for focus)

- `fs-mcp-config-store.ts` — read/modify/write `~/.claude.json` (global + `projects[path]`
  blocks) and `<repo>/.mcp.json`.
- `plugin-mcp-reader.ts` — read each plugin root's `.mcp.json` to list plugin servers
  (read-only). Reuses the plugin-root discovery already done by `PluginProvenanceService`-style
  listing (plugin dirs).
- `mcp-disabled-stash.ts` — the parking store for disabled inline servers (see §6).

Safety rules for every write to `~/.claude.json` and `.mcp.json`:

1. **Surgical read-modify-write.** Never rewrite the file from our model. Read JSON, mutate
   **only** the targeted `mcpServers[name]` (or `projects[path].mcpServers[name]`), preserve every
   other key (the file has ~70 top-level keys incl. `projects`, history, caches).
2. **Preserve the unknown.** Server fields we don't model pass through intact (`passthrough`).
3. **Atomic write.** Write to a temp file, then `rename`.
4. **Backup.** Timestamped copy before the first mutation of `~/.claude.json` in a run.
5. **Fail safe.** If existing JSON does not parse, abort with a clear error rather than overwrite.

## 6. Enable / disable semantics (per location)

"Disable without removing" has no single mechanism:

- **`.mcp.json` (project-shared) servers:** Claude has native gating. Disable = add the name to
  `~/.claude.json` → `projects[repoPath].disabledMcpjsonServers` (and remove from
  `enabledMcpjsonServers`); enable = the inverse. The `.mcp.json` definition is untouched.
- **Inline servers (global `mcpServers` and project-local `projects[path].mcpServers`):** Claude
  has **no** native disabled flag for inline servers. To disable without losing config, the app
  uses a **parking stash** it owns: `~/.superset-ai-app/mcp-disabled.json`, keyed by the server
  id (location + name). Disabling moves the definition out of its inline block into the stash;
  enabling moves it back. This is a deliberate, narrow deviation from "no workspace copy" — it
  holds **only disabled** inline definitions (parked config), never the source of truth for active
  servers.
- **Plugin servers:** not editable; no disable toggle (read-only).

## 7. Service and IPC

### `McpService` (`src/main/application/services/mcp-service.ts`)

- `list(scope)` → reads the relevant locations via `McpConfigPort`, adds plugin servers
  (read-only) via the plugin reader, marks each disabled if present in the stash / disabled list,
  and **attaches health** by joining with the existing collectors (`mcp-auth`, `mcp-runtime`).
  This is the join point between the config half (now writable) and the diagnostics half (already
  read-only). Health join matches by the server's **runtime name** (plugin servers match on the
  `plugin-<plugin>-<server>` runtime name; user servers match on their plain name).
- `get(id)` → one server by id (location + name).
- `save({ server, isCreate })` → validate def via schema, block if `source.kind === 'plugin'`
  (`OperationNotAllowedForOriginError`), then `upsert` to the location.
- `delete({ id })` → same plugin guard, then `remove`.
- `setEnabled({ id, enabled })` → per §6, blocked for plugin servers.

### IPC — new `mcp.*` namespace

Follows the `registry.ts` + `mcp-handlers.ts` + `_validators.ts` pattern.

| Method            | Params                                          | Result                               |
|-------------------|-------------------------------------------------|--------------------------------------|
| `mcp.list`        | `{ scope?: 'personal' \| 'project' }`           | `McpServer[]` (with health + source) |
| `mcp.get`         | `{ id: string }`                                | `McpServer`                          |
| `mcp.save`        | `{ server: McpServerInput; isCreate?: boolean }`| `{ server: McpServer }`              |
| `mcp.delete`      | `{ id: string }`                                | `{ ok: true }`                       |
| `mcp.setEnabled`  | `{ id: string; enabled: boolean }`              | `{ ok: true }`                       |

No `removeSymlinks` param — there are no symlinks here; "apply" is the JSON merge.

## 8. Renderer

- **Navigation:** new "MCP" item in the Library rail (`nav.ts`: `LibrarySub` + `LIBRARY_SUBS`;
  `Main.tsx`: new `case`).
- **Dedicated `McpList` screen** (does NOT reuse `CustomizationListScreen`, which is built for
  Markdown + body). Each row shows: name + transport (stdio/http/sse) + scope; a **provenance
  badge** ("via plugin" = read-only, reusing the badge pattern from commit `9019314`); a **health
  badge** (ok/warning/error/needs-auth) from `mcp.list`; and an **enabled toggle** (hidden for
  plugin rows).
- **Editor** (transport-specific fields): stdio → `command`/`args`/`env`; http|sse →
  `url`/`headers`. Plugin-sourced servers render read-only.
- **Repair actions** (tied to the "fix my errors" goal):
  - user-owned broken server → edit config or remove;
  - plugin / needs-auth → show the documented hint ("run `/mcp` in Claude Code"); the app cannot
    perform interactive auth, mirroring what the Health screen already displays.

## 9. Testing

Following the project's node/jsdom split:

- **domain:** `mcp-location` round-trip and `mcp-server-id` identity (location + name, tolerating
  `plugin-…` names).
- **schema:** validation of the three transport variants + `passthrough` preservation.
- **infra (most critical):** `fs-mcp-config-store` read-modify-write round-trips for all three
  writable locations, preserving sibling keys in `~/.claude.json` (incl. the big `projects` map);
  atomic write; backup creation; fail-safe on invalid JSON. `plugin-mcp-reader` parsing.
  `mcp-disabled-stash` park/restore round-trip.
- **service:** plugin read-only guard; health join by runtime name; scope routing across the
  four locations; disabled-list vs stash selection by location.
- **IPC:** param validation for each `mcp.*` method.
- **renderer:** list render with provenance/health badges and the enabled toggle; plugin rows
  read-only.

## 10. Out of scope (YAGNI for v1)

- Interactive MCP auth (impossible outside Claude Code).
- A reconciliation / "distribute the same server to N repos at once" engine. Creating a
  project-shared server targets one linked repo at a time.
- Editing plugin-provided server definitions.

## 11. Open items to verify during implementation

1. **Disabled-list location for `.mcp.json` servers.** Verified arrays exist at
   `~/.claude.json` → `projects[path].{enabled,disabled}McpjsonServers`. Confirm Claude also
   honors them there (vs. `<repo>/.claude/settings.json`) before relying on it; if not, fall back
   to writing the repo settings file.
2. **Health-name matching.** Confirm the exact runtime name Claude logs for plugin servers
   (`plugin-<plugin>-<server>`) so the health join lines up; adjust the matcher if the format
   differs.
3. **`~/.claude.json` write safety at scale.** Validate the surgical write against the real,
   large file (~70 top-level keys, 40 projects) to confirm no sibling data is touched.

## 12. Phasing (each phase ships working software)

- **Phase 1 — Read/adopt (read-only browser):** domain + schema + `McpConfigPort.read` +
  `fs-mcp-config-store` read side + `plugin-mcp-reader` + `McpService.list` with health join +
  IPC `mcp.list`/`mcp.get` + renderer list with badges. Ships a read-only MCP browser.
- **Phase 2 — Write CRUD:** `upsert`/`remove` + safety (atomic, backup, fail-safe) + plugin guard
  + IPC `mcp.save`/`mcp.delete` + editor UI.
- **Phase 3 — Enable/disable:** `setEnabled` (disabled list for shared, stash for inline) + IPC
  `mcp.setEnabled` + toggle UI.

## 13. Files to create / modify (indicative)

**New:**
- `src/main/domain/mcp-location.ts`, `src/main/domain/mcp-server-id.ts`
- `src/main/application/schemas/mcp.ts`
- `src/main/application/ports/mcp-config-port.ts`
- `src/main/infrastructure/mcp/fs-mcp-config-store.ts`
- `src/main/infrastructure/mcp/plugin-mcp-reader.ts`
- `src/main/infrastructure/mcp/mcp-disabled-stash.ts`
- `src/main/application/services/mcp-service.ts`
- `src/main/ipc/mcp-handlers.ts`
- `src/shared/mcp.ts`
- `src/renderer/screens/mcps/McpList.tsx` (+ editor + hook)
- Tests across domain / schema / infra / service / ipc / renderer.

**Modify:**
- `src/main/ipc/registry.ts` — wire `mcp.*` handlers + `McpService` into `IpcDeps`/`buildHandlers`.
- `src/main/index.ts` — compose the config store, plugin reader, stash, and `McpService`.
- `src/renderer/components/shell/nav.ts` — add MCP to the Library rail.
- `src/renderer/screens/Main.tsx` — route the MCP screen.
- `docs/reference/ipc-contract.md` — document the `mcp.*` namespace.
- `docs/reference/architecture.md` — note the live-config-broker subsystem.

> Note: MCP does **not** flow through `CustomizationType` / `customization-service`; it is its own
> subsystem (live-config broker). `src/shared/customization.ts` is not modified.
