---
title: Architecture
description: Hexagonal layout of sde-ai-app — main, preload, renderer, and the ports/adapters split inside the main process.
---

# Architecture

sde-ai-app is an Electron app with three processes (**main**, **preload**, **renderer**) and a hexagonal split inside the main process.

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

- `customization-service` — CRUD over customizations.
- `template-service` — built-in and user templates.
- `template-seeder` — installs built-in templates on bootstrap.
- `adapter-manager` — orchestrates per-tool adapters (Claude, Copilot).
- `symlink-manager` — creates and reconciles the symlinks that publish customizations to each tool.
- `copilot-instructions-gen` — generates `.github/copilot-instructions.md` content.
- `repo-service` — operations on linked repositories.
- `search-service` — text search across customizations.
- `settings-service` — load/merge/persist settings.
- `schema-validator` — Zod-based validation surface.
- `workspace-bootstrap`, `workspace-locator` — workspace lifecycle.

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

## See also

- [Getting started](../tutorials/getting-started.md) — to run the app first.
- [Customization schema](customization-schema.md)
- [IPC contract](ipc-contract.md)
- Why symlinks _(TBD)_
