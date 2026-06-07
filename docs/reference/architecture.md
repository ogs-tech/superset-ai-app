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
│                    #   customization-id, customization-name, errors
├── application/
│   ├── ports/       # Interfaces — what the core needs from the outside
│   ├── services/    # Use cases (see below)
│   ├── schemas/     # Zod schemas
│   └── markdown/    # pure frontmatter parse/serialize (no I/O)
├── infrastructure/  # Adapter implementations (filesystem, git, dialog, settings, …)
└── ipc/             # IPC handlers — wire services to renderer requests
```

### Application services

Located at `src/main/application/services/`:

Per-entity facades (1ª class):
- `skill-service` — CRUD over skills + provenance merge with installed plugins.
- `agent-service` — CRUD over agents + provenance merge.
- `command-service` — CRUD over commands + provenance merge.
- `hook-service` — CRUD over hooks stored in `.claude/settings.json`.
- `global-instruction-service` — single-slot (`default`) global instruction.
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
- `schema-validator` — Zod-based validation.
- `workspace-bootstrap` — creates the `~/.superset-ai-app/` directory tree on first run (called at startup, not via IPC).
- `health-service` — aggregates `HealthCheck` results from collectors (MCP auth, MCP runtime, config-drift, symlink) into a `HealthReport`; exposed via the `health.*` IPC namespace.
- **MCP (live-config broker):** `mcp-service` is NOT a customization facade. It reads/writes MCP
  servers directly in the real Claude files (`~/.claude.json` `mcpServers` and
  `projects[path].mcpServers`, `<repo>/.mcp.json`) via `FsMcpConfigStore`, reads plugin
  `.mcp.json` files read-only via `PluginMcpReader`, parks disabled inline servers in
  `McpDisabledStash`, and joins health from the read-only `ClaudeRuntimePort`. Writes are
  surgical, atomic, and backed up.

Legacy (deprecated, internal):
- `customization-service` — umbrella service backing the per-entity facades. The `customization.*` IPC namespace has been removed; the `CustomizationListScreen` now calls the typed namespaces. Future PRs should split this into a `customization-core` helper and let the facades own the lifecycle.

### Tool adapters

The adapter implementation lives under `src/main/infrastructure/adapters/`:

- `claude-adapter.ts` — symlinks customizations into `~/.claude/` (personal) and `<repo>/.claude/` (project).

It implements the `Adapter` port at `src/main/application/ports/adapter.ts`.

## Renderer structure

```
src/renderer/
├── App.tsx                 # View union: loading | main | settings | io-error
├── main.tsx
├── screens/                # Main.tsx routes by Nav; per-entity dirs:
│   ├── skills/ agents/ commands/ hooks/ global-instructions/
│   ├── plugins/ marketplaces/ health/ starter-pack/ settings/
│   ├── Main.tsx            # root screen — maps Nav state to a screen component
│   ├── Settings.tsx
│   └── IoError.tsx         # generic retry screen for I/O failures
├── components/             # ds/ (design system), shell/ (TopNav, SubRail, CommandPalette), EntityDataGrid/
├── hooks/                  # react-query data hooks
└── lib/                    # ipc.ts, query-client.ts, theme-mode-context.tsx
```

Navigation is state-driven via a `Nav` discriminated union in `components/shell/nav.ts` (areas: `inicio`, `biblioteca`, `plugins`, `diagnostico`); `Main.tsx` maps `Nav` to a screen. No `react-router`.

## Data flow (typical user action)

1. The user triggers an action in a renderer screen — e.g. *save a skill*.
2. The renderer calls `callIpc('skill.save', payload)` exposed by **preload**.
3. `skill-handlers.ts` in `src/main/ipc/` invokes `SkillService`.
4. The service calls a **port**; **infrastructure** does the I/O (file write, symlink, dialog).
5. The result returns up the stack; the renderer re-renders.

Note: the `customization.*` IPC namespace has been removed. All entity operations now use typed namespaces (`skill.*`, `agent.*`, `command.*`, `hook.*`, etc.).

I/O failures bubble up to the `IoError` screen, which retries the failing step.

## Persistence

- **Customizations** — `.md` files with YAML frontmatter under the user's chosen workspace folder.
- **Settings** — JSON file managed by `settings-service`.
- **Sync** — symbolic links from each adapter target into the workspace files.

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
- [Customization schema](customization-schema.md)
- [IPC contract](ipc-contract.md)
- Why symlinks _(TBD)_
