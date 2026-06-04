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
│                    #   customization-id, customization-name, template-id, errors
├── application/
│   ├── ports/       # Interfaces — what the core needs from the outside
│   ├── services/    # Use cases (see below)
│   └── schemas/     # Zod schemas
├── infrastructure/  # Adapter implementations (filesystem, git, dialog, settings, …)
├── ipc/             # IPC handlers — wire services to renderer requests
└── templates/       # Built-in template seeds
```

### Application services

Located at `src/main/application/services/`:

Per-entity facades (1ª class):
- `skill-service` — CRUD over skills + provenance merge with installed plugins.
- `agent-service` — CRUD over agents + provenance merge.
- `reference-service` — CRUD over references (app-only; not synced to Claude).
- `global-instruction-service` — single-slot (`default`) global instruction.
- `marketplace-service` — list/add/remove/refresh marketplaces (`extraKnownMarketplaces`).
- `plugin-provenance` — scans `_meta.json` and plugin dirs to map skills/agents to their providing plugin.

Plugin lifecycle:
- `plugin-service` — import, list, get, update, remove, toggle, createOwned, deleteOwned, publish.
- `plugin-installer`, `plugin-author-service`, `plugin-publisher`, `plugin-manifest-parser`, `marketplace-parser`.

Cross-cutting:
- `template-service` — built-in and user templates.
- `template-seeder` — installs built-in templates on bootstrap.
- `adapter-manager` — orchestrates per-tool adapters (Claude, Copilot).
- `symlink-manager` — creates and reconciles symlinks.
- `copilot-instructions-gen` — generates `.github/copilot-instructions.md`.
- `repo-service` — operations on linked repositories.
- `search-service` — text search across customizations.
- `settings-service` — load/merge/persist settings.
- `schema-validator` — Zod-based validation.
- `workspace-bootstrap`, `workspace-locator` — workspace lifecycle.

Legacy (deprecated, internal):
- `customization-service` — umbrella service backing the per-entity facades; retained for the legacy `customization.*` IPC and the `CustomizationList` screen used by `PluginEditor`. Future PRs should split this into a `customization-core` helper and let the facades own the lifecycle.

### Tool adapters

Two adapter implementations live under `src/main/infrastructure/adapters/`:

- `claude-adapter.ts` — symlinks customizations into `~/.claude/` (personal) and `<repo>/.claude/` (project).
- `copilot-adapter.ts` — symlinks into `~/.copilot/` (personal) and `<repo>/.github/` (project).

Both implement the `Adapter` port at `src/main/application/ports/adapter.ts`.

## Renderer structure

```
src/renderer/
├── App.tsx
├── main.tsx
├── index.html
├── screens/
│   ├── Onboarding.tsx       # first-launch workspace picker
│   ├── Main.tsx             # customization list
│   ├── Settings.tsx
│   ├── IoError.tsx          # generic retry screen for I/O failures
│   ├── customizations/      # editor, list, sub-screens
│   └── settings/
├── components/              # reusable UI
└── lib/                     # renderer-side helpers (incl. ipc.ts)
```

## Data flow (typical user action)

1. The user triggers an action in a renderer screen — e.g. *create customization*.
2. The renderer calls `callIpc('customization.create', payload)` exposed by **preload**.
3. The handler in `src/main/ipc/` invokes the matching application service.
4. The service calls a **port**; **infrastructure** does the I/O (file write, symlink, dialog).
5. The result returns up the stack; the renderer re-renders.

I/O failures bubble up to the `IoError` screen, which retries the failing step.

## Persistence

- **Customizations** — `.md` files with YAML frontmatter under the user's chosen workspace folder.
- **Templates** — same shape as customizations; seeded from `src/main/templates/`.
- **Settings** — JSON file managed by `settings-service`.
- **Sync** — symbolic links from each adapter target into the workspace files.

No database, no API, no telemetry.

## Plugin system

The plugin system extends the SDE customizations framework with package management: users can import third-party plugins, own and manage them locally, and publish their own contributions back to registries.

**Plugin lifecycle modes:**

- **Imported** — third-party plugins installed from a remote registry (GitHub, npm-compatible URL). Downloaded as `.tar.gz` and extracted into the workspace plugin folder. Identified by `registry` metadata.
- **Owned** — plugins authored locally and not tied to an external registry. Stored in the workspace plugin folder with `_meta.json` v2 schema (includes author, visibility, publish history).
- **Publish** — owned plugins pushed to a GitHub repository as a release. Registry entries published to a central manifest (`.tar.gz` + metadata).

**Core adapters** — located at `src/main/infrastructure/adapters/plugins/`:

- `SimpleGitClient` (GitPort) — wraps nodegit for branch tracking, tag creation, remote operations.
- `PluginCacheFile` (PluginCachePort) — reads/writes `.json` plugin metadata cache.
- `ClaudeSettingsFile` (ClaudeSettingsPort) — manages `~/.claude/settings.json` to expose plugin modules.
- `OctokitClient` (GitHubApiPort) — wraps Octokit for GitHub API calls (repos, releases, token auth).
- `SafeStorageCredentials` (CredentialStorePort) — encrypts/decrypts GitHub PAT using Electron's safeStorage.

**Core services** — located at `src/main/application/services/plugins/`:

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

**ClaudePluginAdapter helper** — utility that wraps plugins as Claude settings adapters, exposing installed plugin modules as `.claude/settings.json` entries so Claude can load and apply them at runtime.

## See also

- [Getting started](../tutorials/getting-started.md) — to run the app first.
- [Customization schema](customization-schema.md)
- [IPC contract](ipc-contract.md)
- Why symlinks _(TBD)_
