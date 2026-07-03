---
title: Architecture
description: Hexagonal layout of superset-ai-app — main, preload, renderer, and the ports/adapters split inside the main process.
---

# Architecture

superset-ai-app is an Electron app with three processes (**main**, **preload**, **renderer**) and a hexagonal split inside the main process.

## Process layout

```
src/
├── main/         # Node.js side — domain, services, file system, IPC
├── preload/      # Bridge — exposes a typed API to the renderer
├── renderer/     # React UI
└── shared/       # Types shared across processes
```

Build is driven by `electron-vite.config.ts`: each process has its own entry and output bundle under `out/`.

## Hexagonal layers (main)

```
src/main/
├── domain/          # Pure types and value objects
│                    #   skill-id, agent-id, global-instruction-id, errors
├── application/
│   ├── entity/      # EntitySerializer — Entity ↔ Claude .md (flat frontmatter)
│   ├── ports/       # Interfaces — what the core needs from the outside
│   │                #   entity-repository.ts, adapter.ts, clock-port.ts, …
│   ├── services/    # Use cases (see below)
│   ├── schemas/     # Zod schemas — entity-schema.ts, hook.ts, …
│   └── markdown/    # pure frontmatter parse/serialize (no I/O)
├── infrastructure/  # Adapter implementations (filesystem, git, dialog, settings, …)
│                    #   infrastructure/entity/fs-entity-repository.ts implements EntityRepository
└── ipc/             # IPC handlers — wire services to renderer requests
```

The canonical `Entity` contract (`src/shared/entity.ts`) replaced the old polymorphic `Customization`/`CustomizationFrontmatter` model. Every entity has a `urn` (`urn:{kind}:{name}`), flat scalar fields (`name`, `description`, `scopes`, …) instead of a nested `frontmatter`/`body` pair, an `EntityMetadata` block (`version`, `tags?`, `createdAt`, `updatedAt`), and an `EntitySource` (`{ kind: 'workspace' }` or `{ kind: 'plugin'; pluginId; provenance }`). Three kinds are implemented today — `Skill` (`content`, `explicitOnly?`), `Agent` (`systemPrompt`, `model?`, `tools?`, `deniedTools?`), `Instruction` (`content`, `activation`, `globs?`). `EntityKind` also reserves `'mcp'` and `'hook'` for a future unification (Phase 1) — `hook-service` and `mcp-service` do **not** implement `EntityRepository` yet and are documented separately below. The old `command` kind is gone: a slash-command is now a `Skill` with `explicitOnly: true` (↔ frontmatter `disable-model-invocation: true`).

`EntitySerializer` (`application/entity/entity-serializer.ts`) renders/parses the Markdown ↔ `Entity` boundary: `renderEntityFile`/`parseEntityFile` handle flat frontmatter for `skill`/`agent`; `instruction` is **frontmatter-free** — the whole file is the body, and `activation`/`globs` are not yet persisted (a fresh parse always yields `activation: 'always'`). `FsEntityRepository` (`infrastructure/entity/fs-entity-repository.ts`) implements the `EntityRepository` port (`list`/`get`/`save`/`delete`/`exists`) against `skills/<name>/SKILL.md`, `agents/<name>.md`, `instructions/<name>.md` — with a read-only legacy fallback to `global-instructions/<name>.md` for `instruction.get`/`exists` when the new path is missing.

### Application services

Located at `src/main/application/services/`:

**Entity core:**
- `entity-service` (`EntityService`) — the shared use case behind every canonical entity: `save` (create/rename/update, stamping `metadata.createdAt`/`updatedAt`, syncing via `AdapterManager`) and `delete` (optionally removing symlinks first). Depends on the `EntityRepository` port, `ClockPort`, `AdapterManager`, and an optional `EntityValidator`.
- `entity-validator` (`EntityValidator`) — validates an `Entity` against the Zod schema for its `kind` (`skillEntitySchema` / `agentEntitySchema` / `instructionEntitySchema` in `application/schemas/entity-schema.ts`); throws `DomainError('validation', …, { errors: [{ path, message }] })` on failure. Replaced the old standalone `schema-validator.ts` (removed).
- `entity-plugin-helpers` — `collectPluginEntities` / `assertEntityNotPluginSourced`, shared by the skill/agent facades to merge in plugin-provided entities and block writes to plugin-sourced ones.

Per-entity facades (thin wrappers around `EntityService`, 1ª class):
- `skill-service` — CRUD over skills + provenance merge with installed plugins. A slash-command is now just a skill with `explicitOnly: true`; there is no separate command facade.
- `agent-service` — CRUD over agents + provenance merge.
- `instruction-service` — single-slot (`default`) instruction; renamed from `global-instruction-service`.
- `hook-service` — CRUD over hooks stored in `.claude/settings.json`. **Not** Entity-backed yet (Phase 1 target).
- `marketplace-service` — list/add/remove/refresh marketplaces (`extraKnownMarketplaces`).
- `plugin-provenance` — scans `_meta.json` and plugin dirs to map skills/agents to their providing plugin.

Plugin lifecycle:
- `plugin-service` — import, list, get, update, remove, toggle, createOwned, deleteOwned, publish.
- `plugin-installer`, `plugin-author-service`, `plugin-publisher`, `plugin-manifest-parser`, `marketplace-parser`.

Cross-cutting:
- `adapter-manager` — orchestrates the Claude adapter.
- `symlink-manager` — creates and reconciles symlinks.
- `repo-service` — operations on linked repositories.
- `settings-service` — load/merge/persist settings.
- `workspace-bootstrap` — creates the `~/.superset-ai-app/` directory tree on first run (called at startup, not via IPC).
- `health-service` — aggregates `HealthCheck` results from collectors (MCP auth, MCP runtime, config-drift, symlink) into a `HealthReport`; exposed via the `health.*` IPC namespace.
- **MCP (live-config broker):** `mcp-service` is NOT an `Entity`-backed facade. It reads/writes MCP
  servers directly in the real Claude files (`~/.claude.json` `mcpServers` and
  `projects[path].mcpServers`, `<repo>/.mcp.json`) via `FsMcpConfigStore`, reads plugin
  `.mcp.json` files read-only via `PluginMcpReader`, parks disabled inline servers in
  `McpDisabledStash`, and joins health from the read-only `ClaudeRuntimePort`. Writes are
  surgical, atomic, and backed up.

The polymorphic `Customization` model and its `customization-service` umbrella are **gone** — deleted along with the `Customization`/`CustomizationFrontmatter` types, the old customization repository, and the associated schemas. `EntityService` + `EntityRepository` took their place; the per-entity facades above wrap `EntityService` directly rather than an umbrella service. The `customization.*` IPC namespace was removed at the same time — the renderer's `CustomizationListScreen` component keeps its (now generic) name but calls the typed namespaces via a `listMethod` param.

### Tool adapters

The adapter implementation lives under `src/main/infrastructure/adapters/`:

- `claude-adapter.ts` — resolves sync destinations per entity kind via `resolveEntityDestinations`: `skill` → `~/.claude/skills/<name>` (dir), `agent` → `~/.claude/agents/<name>.md`, `instruction` → **both** `~/.claude/CLAUDE.md` and `~/AGENTS.md` (personal scope only — instructions don't fan out per linked repo). `project`-scoped skills/agents additionally resolve to `<repo>/.claude/{skills,agents}/…` for each linked repo.

It implements the `Adapter` port at `src/main/application/ports/adapter.ts`.

## Renderer structure

```
src/renderer/
├── App.tsx                 # View union: loading | main | settings | io-error
├── main.tsx
├── screens/                # Main.tsx routes by Nav; per-entity dirs:
│   ├── skills/ agents/ global-instructions/ hooks/ mcps/
│   ├── plugins/ marketplaces/ health/ starter-pack/ settings/
│   ├── Main.tsx            # root screen — maps Nav state to a screen component
│   ├── Settings.tsx
│   └── IoError.tsx         # generic retry screen for I/O failures
├── components/             # ds/ (design system), shell/ (TopNav, SubRail, CommandPalette), EntityDataGrid/
├── hooks/                  # react-query data hooks
└── lib/                    # ipc.ts, query-client.ts, theme-mode-context.tsx
```

The `global-instructions/` screen directory name predates the `instruction` entity kind rename and has not been renamed to match (renderer-only naming lag; the IPC namespace and storage folder are `instruction`/`instructions`). There is no `commands/` screen — the `command` entity kind was removed.

Navigation is state-driven via a `Nav` discriminated union in `components/shell/nav.ts` (areas: `inicio`, `biblioteca`, `plugins`, `diagnostico`); `Main.tsx` maps `Nav` to a screen. No `react-router`.

## Data flow (typical user action)

1. The user triggers an action in a renderer screen — e.g. *save a skill*.
2. The renderer calls `callIpc('skill.save', payload)` exposed by **preload**.
3. `skill-handlers.ts` in `src/main/ipc/` invokes `SkillService`.
4. The service calls `EntityService`, which validates via `EntityValidator`, then calls the `EntityRepository` **port**; **infrastructure** (`FsEntityRepository`) does the I/O (file write, then `AdapterManager` syncs symlinks).
5. The result returns up the stack; the renderer re-renders.

Note: the `customization.*` IPC namespace has been removed. All entity operations now use typed namespaces (`skill.*`, `agent.*`, `instruction.*`, `hook.*`, etc.) — see [IPC contract](ipc-contract.md).

I/O failures bubble up to the `IoError` screen, which retries the failing step.

## Persistence

- **Entities** — `skill`/`agent`/`instruction` are `.md` files under the user's chosen workspace folder (`skills/<name>/SKILL.md`, `agents/<name>.md`, `instructions/<name>.md`); `skill`/`agent` keep YAML frontmatter, `instruction` is frontmatter-free (whole file is the body).
- **Settings** — JSON file managed by `settings-service`.
- **Sync** — symbolic links from each adapter target into the workspace files, except `instruction`, which fans out to **both** `~/.claude/CLAUDE.md` and `~/AGENTS.md` (personal scope).

No database, no API, no telemetry.

## Plugin system

The plugin system extends the SDE customizations framework with package management: users can import third-party plugins, own and manage them locally, and publish their own contributions back to registries.

**Plugin lifecycle modes:**

- **Imported** — third-party plugins installed from a remote registry (GitHub, npm-compatible URL). Downloaded as `.tar.gz` and extracted into the workspace plugin folder. Identified by `registry` metadata.
- **Owned** — plugins authored locally and not tied to an external registry. Stored in the workspace plugin folder with `_meta.json` v2 schema (includes author, visibility, publish history).
- **Publish** — owned plugins pushed to a GitHub repository as a release. Registry entries published to a central manifest (`.tar.gz` + metadata).

**Core adapters** — located across `src/main/infrastructure/{git,github,plugins,settings,credentials}/`:

- `SimpleGitClient` (GitPort) — wraps **simple-git** for branch tracking, tag creation, remote operations.
- `PluginCacheFile` (PluginCachePort) — reads/writes `.json` plugin metadata cache.
- `ClaudeSettingsFile` (ClaudeSettingsPort) — manages `~/.claude/settings.json` to expose plugin modules.
- `OctokitClient` (GitHubApiPort) — wraps Octokit for GitHub API calls (repos, releases, token auth).
- `SafeStorageCredentials` (CredentialStorePort) — encrypts/decrypts GitHub PAT using Electron's safeStorage.

**Core services** — located at `src/main/application/services/` (flat, not nested):

- `PluginInstaller` — fetch, validate, extract, and cache imported plugins.
- `PluginAuthorService` — CRUD for owned plugins; manages `_meta.json` v2 authorship.
- `PluginPublisher` — tag releases, push to GitHub, publish registry entries.
- `PluginService` — unified interface for list, get, toggle, remove operations across import/owned modes.

**_meta.json v2 schema** — owned plugins carry full authorship and publish metadata:

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "author": "user@example.com",
  "description": "Plugin description",
  "visibility": "private" | "public",
  "publishedTo": [
    {
      "registry": "github",
      "url": "https://github.com/user/my-plugin-registry",
      "version": "1.0.0",
      "publishedAt": "2025-05-04T12:00:00Z"
    }
  ]
}
```

## See also

- [Getting started](../tutorials/getting-started.md) — to run the app first.
- [Entity schema](customization-schema.md)
- [IPC contract](ipc-contract.md)
- Why symlinks _(TBD)_
