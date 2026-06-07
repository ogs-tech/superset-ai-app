# MCP as a Library Entity — Design

- **Date:** 2026-06-07
- **Status:** Approved (design) — pending implementation plan
- **Author:** Odenir Gomes (with Claude)
- **Scope:** Add `mcp` as a first-class entity in the Superset AI library, with full CRUD over MCP server configurations.

> Written in English to match the existing `docs/reference/*.md` convention. The brainstorming
> conversation that produced it was in pt-BR.

---

## 1. Context and goal

The app currently treats MCP servers as **read-only diagnostics**: the Health (Diagnóstico)
screen reads `~/.claude.json` (`mcpServers`), `~/.claude/mcp-needs-auth-cache.json`, and the
Claude CLI runtime logs, then reports per-server status (ok / warning / error / needs-auth). It
**never writes** any MCP configuration.

The user has ~76 MCP servers configured and several broken ones (timeouts, failures, servers
needing auth). The goal is to make MCP a **manageable library entity**: list, view, add, edit,
remove, and enable/disable MCP servers from the app, so the existing fleet can be **adopted** and
**repaired** in place — and so consistent configs can be **distributed** to project repos.

This is a new and sensitive capability: it crosses the line from "read Claude's config" to
"write Claude's config".

## 2. Decisions made during brainstorming

1. **Two independent features** were requested (Prompts and MCP). They are split into separate
   spec → plan → implementation cycles. **This spec covers MCP only.** A separate spec will cover
   Prompts (note: Prompts may be redundant with the existing `command` entity — to be examined
   then).
2. **Architecture: "live-config broker" (Approach C).** The MCP entity keeps **no
   source-of-truth copy** in the workspace. It is an editable view over the real config files.
   Provenance is literally *where the server lives*. This was chosen over a
   workspace-source-of-truth model (Approaches A/B) because the primary goal is adopt + repair the
   existing fleet, and because you cannot symlink a key inside a shared JSON file — so any
   workspace copy would drift from the live config. The broker eliminates drift.
3. **Import/adopt existing servers** (not author-only).
4. **Full CRUD**, applied to **both scopes**: personal (`~/.claude.json`) and project
   (`<repo>/.mcp.json` for each linked repo).
5. **Plugin-provided MCP servers are read-only**, reusing the existing provenance model and
   `OperationNotAllowedForOriginError`.
6. **Enable/disable toggle is in v1** (disable without losing config).

## 3. Provenance and sources

| Origin  | File                                   | Scope    | Editable |
|---------|----------------------------------------|----------|----------|
| Global  | `~/.claude.json` → `mcpServers`        | personal | yes      |
| Project | `<repo>/.mcp.json` → `mcpServers`      | project  | yes      |
| Plugin  | `.mcp.json` bundled inside a plugin    | inherited| **no**   |

Provenance is determined by the physical location of the definition. Workspace-located servers
(`~/.claude.json`, repo `.mcp.json`) → `source.kind === 'workspace'` → editable. Plugin-bundled
servers → `source.kind === 'plugin'` → read-only.

## 4. Data model and schema

### Domain (`src/main/domain/`)

- `mcp-server-id.ts` — server identity. Because the same `name` can exist in different scopes
  (global vs. repo X), identity is **`name` + `location`** (which file), not `name` alone.
- `McpServer` (domain type): `name`, `transport`, transport-specific config, `source` (reuses the
  existing `CustomizationSource`: `workspace` | `plugin`), `enabled: boolean`, and attached health
  status.

### Schema (`src/main/application/schemas/mcp.ts`, zod)

The `.mcp.json` server schema is a transport-discriminated union:

- `stdioServerSchema` = `{ command: string, args?: string[], env?: Record<string,string> }`
- `httpServerSchema` = `{ type: 'http', url: string, headers?: Record<string,string> }`
- `sseServerSchema`  = `{ type: 'sse',  url: string, headers?: Record<string,string> }`
- `mcpServerSchema`  = discriminated union (by `command` presence vs. `type`/`url`), with
  **`.passthrough()`** so fields Claude supports but we don't model survive a round-trip.

This schema is **standalone config** — it does **not** extend `commonFrontmatterSchema` (that
schema is for Markdown entities with frontmatter + body).

## 5. Read/write layer and safety

The existing `ClaudeRuntimePort.readMcpServers()` returns only server **names** and stays
read-only (it backs Health). MCP write capability lives in a **new, separate port** so that
reading runtime logs and writing config never couple.

### Port — `McpConfigPort` (new)

- `read(scope)` → servers with full definitions + location + provenance.
- `upsert(location, name, def)` → write one server.
- `remove(location, name)` → delete one server.
- `setEnabled(id, enabled)` → enable/disable (see §6).

### Infrastructure — `FsMcpConfigStore`

The sensitive part. Safety rules for every write to `~/.claude.json` (and `.mcp.json`):

1. **Surgical read-modify-write.** Never rewrite the file from our model. Read JSON, mutate
   **only** `mcpServers[name]`, preserve every other key (project history, etc.).
2. **Preserve the unknown.** Server fields we don't model pass through intact (`passthrough`).
3. **Atomic write.** Write to a temp file, then `rename`.
4. **Backup.** Timestamped copy before mutating `~/.claude.json` (large, Claude-owned file).
5. **Fail safe.** If the existing JSON does not parse, abort with a clear error rather than
   overwrite.

## 6. Enable / disable semantics

"Disable without removing" has no single mechanism across scopes:

- **Project servers:** use Claude's native lists `enabledMcpjsonServers` / `disabledMcpjsonServers`
  in the repo's `settings.json`. A disabled project server stays in `.mcp.json` but is listed as
  disabled.
- **Global servers (`~/.claude.json`):** Claude has **no** native disabled flag. To disable
  without losing config, the app uses a **parking stash** it owns:
  `~/.superset-ai-app/mcp-disabled.json`. Disabling moves the definition out of `~/.claude.json`
  into the stash; enabling moves it back. This is a deliberate, narrow deviation from
  "no workspace copy" — it holds **only disabled** global definitions (parked config), never the
  source of truth for active servers.

## 7. Service and IPC

### `McpService` (`src/main/application/services/mcp-service.ts`)

Same shape as the other entity services (`list/get/save/delete`), talking to `McpConfigPort`:

- `list(scope)` → reads the three origins, marks provenance, and **attaches health** by joining
  with the existing collectors (`mcp-auth`, `mcp-runtime`). This is the join point between the
  config half (now writable) and the diagnostics half (already read-only).
- `get(id)` → one definition (`name` + `location`).
- `save({ server, isCreate })` → validate, block if `source.kind === 'plugin'`
  (`OperationNotAllowedForOriginError`), then `upsert` into the right file for the scope.
- `delete({ id })` → same plugin guard, then `remove`.
- `setEnabled({ id, enabled })` → per §6.

### IPC — new `mcp.*` namespace

Follows the `registry.ts` + `mcp-handlers.ts` + `_validators.ts` pattern.

| Method            | Params                                          | Result                                |
|-------------------|-------------------------------------------------|---------------------------------------|
| `mcp.list`        | `{ scope?: 'personal' \| 'project' }`           | `McpServer[]` (with health + source)  |
| `mcp.get`         | `{ id: string }`                                | `McpServer`                           |
| `mcp.save`        | `{ server: McpServer; isCreate?: boolean }`     | `{ server; applied: <location> }`     |
| `mcp.delete`      | `{ id: string }`                                | `{ ok: true }`                        |
| `mcp.setEnabled`  | `{ id: string; enabled: boolean }`              | `{ ok: true }`                        |

No `removeSymlinks` param — there are no symlinks here; "apply" is the JSON merge.

## 8. Renderer

- **Navigation:** new "MCP" item in the Library rail (`nav.ts`: `LibrarySub` + `LIBRARY_SUBS`;
  `Main.tsx`: new `case`).
- **Dedicated `McpList` screen** (does **not** reuse `CustomizationListScreen`, which is built for
  Markdown + body). Each row shows: name + transport (stdio/http/sse) + scope; a **provenance
  badge** ("via plugin" = read-only, reusing the badge pattern from commit `9019314`); a **health
  badge** (ok/warning/error/needs-auth) from `mcp.list`; and an **enabled toggle**.
- **Editor** (form with transport-specific fields): stdio → `command`/`args`/`env`; http|sse →
  `url`/`headers`. Plugin-sourced servers render read-only.
- **Repair actions** (tied to the "fix my errors" goal):
  - broken server → edit config or remove;
  - needs-auth → show the documented hint ("run `/mcp` in Claude Code"); the app cannot perform
    interactive auth, so it mirrors what the Health screen already displays.

## 9. Testing

Following the project's node/jsdom split:

- **domain:** `mcp-server-id` identity (name + location).
- **schema:** validation of the three transport variants + `passthrough` preservation.
- **infra (most critical):** read-modify-write round-trip preserving sibling keys in
  `~/.claude.json`; atomic write; backup creation; fail-safe on invalid JSON; the global
  disable/enable parking-stash round-trip.
- **service:** plugin read-only guard; health join; scope routing (global vs. repo).
- **IPC:** param validation for each `mcp.*` method.
- **renderer:** list render with provenance/health badges and the enabled toggle.

## 10. Out of scope (YAGNI for v1)

- Interactive MCP auth (impossible outside Claude Code).
- A reconciliation / "distribute to N repos" engine (the trade-off rejected when choosing
  Approach C). A simple "copy to repo" action is **optional**, not in v1.

## 11. Open items to verify during implementation

1. **Plugin-MCP physical location.** Confirm whether plugin servers (`plugin-serena-serena`,
   etc.) are materialized inside `~/.claude.json` or live only in the plugin's bundled `.mcp.json`.
   This decides how we detect "plugin-sourced → read-only" and ensures we never offer to edit a
   server we don't actually own.
2. **Project enable/disable file.** Confirm whether disabled-project lists belong in
   `<repo>/.claude/settings.json` or `settings.local.json` for this app's conventions.
3. **`~/.claude.json` shape stability.** Validate the surgical-write approach against a real,
   large `~/.claude.json` to confirm no sibling data is touched.

## 12. Files to create / modify (indicative)

**New:**
- `src/main/domain/mcp-server-id.ts`
- `src/main/application/schemas/mcp.ts`
- `src/main/application/ports/mcp-config-port.ts`
- `src/main/infrastructure/.../fs-mcp-config-store.ts`
- `src/main/application/services/mcp-service.ts`
- `src/main/ipc/mcp-handlers.ts`
- `src/renderer/screens/mcps/McpList.tsx` (+ editor component)
- Tests across domain / schema / infra / service / ipc / renderer.

**Modify:**
- `src/shared/customization.ts` — add `'mcp'` to `CustomizationType` (if the type is used for nav)
  — to be confirmed; MCP may not flow through the customization union at all given Approach C.
- `src/main/ipc/registry.ts` — wire `mcp.*` handlers + `McpService`.
- `src/main/index.ts` — compose `FsMcpConfigStore` + `McpService`.
- `src/renderer/components/shell/nav.ts` — add MCP to the Library rail.
- `src/renderer/screens/Main.tsx` — route the MCP screen.
- `docs/reference/ipc-contract.md` — document the `mcp.*` namespace.
- `docs/reference/architecture.md` — note the live-config-broker subsystem.
