# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this app is

**Skillforge / superset-ai-app** — an Electron desktop app that centralizes AI customizations (skills, agent profiles, commands, global instructions) as Markdown + YAML files, then syncs them to Claude Code (`~/.claude/`, `<repo>/.claude/`) via **symbolic links**. Single-developer dogfooding spike — no backend, no API, no telemetry.

Authoritative docs live in `docs/` (Diátaxis):
- `docs/explanation/prd.md` — goals, scope, stop rules
- `docs/reference/architecture.md` — hexagonal layout
- `docs/reference/ipc-contract.md` — every IPC method
- `docs/reference/customization-schema.md` — frontmatter rules

**Read the relevant doc before editing the area it covers** — they are the source of truth for layout, IPC and schema. CLAUDE.md only carries gotchas and pointers.

## Common commands

| Task | Command |
|---|---|
| Dev server (Electron + Vite HMR) | `npm run dev` |
| Production build (main + preload + renderer to `out/`) | `npm run build` |
| Full test suite (both projects) | `npm test` |
| Watch mode | `npm run test:watch` |
| Run a single test file | `npx vitest run tests/main/application/services/skill-service.test.ts` |
| Run only the node project | `npx vitest --project node` |
| Run only the jsdom project | `npx vitest --project jsdom` |
| Lint | `npm run lint` |
| Typecheck (both node + web tsconfigs) | `npm run typecheck` |
| Format | `npm run format` |

`npm` is the canonical package manager — `package-lock.json` is committed; `yarn.lock` is local-only.

Tests are split into two Vitest projects (`vitest.config.ts`):
- **`node`** — runs `tests/main/**` and `tests/shared/**` in node env (services, IPC, infrastructure).
- **`jsdom`** — runs `tests/renderer/**` in jsdom env with `tests/renderer/setup.ts` for Testing Library.

Coverage targets `application/`, `ipc/`, `infrastructure/`, and `renderer/screens/` with thresholds `lines/functions/statements: 80`, `branches: 70`.

## Architecture — what you must know before editing

- **Three processes** (`main`, `preload`, `renderer`) + `shared` types. Built as separate bundles by `electron.vite.config.ts` into `out/{main,preload,renderer}`. Layout in `docs/reference/architecture.md`.
- **Hexagonal split inside `src/main/`** (`domain` / `application/{ports,services,schemas}` / `infrastructure` / `ipc`). **Rule:** services must depend on **ports**, never on `node:fs`, `electron`, `simple-git`, `@octokit/rest` directly — concrete I/O lives in `infrastructure/`. Enforced socially (no lint check). Layout in `docs/reference/architecture.md`.
- **Composition root:** `src/main/index.ts` wires every adapter + service and passes the `handlers` map to `createDispatcher`.
- **IPC** — single channel `ipc:call`, envelope `{ method, params }` → `IpcResult<T>`. Full shape, namespaces and per-method tables in `docs/reference/ipc-contract.md`. Renderer uses `callIpc<T>('ns.method', params)` from `src/renderer/lib/ipc.ts`. The dispatcher (`src/main/ipc/dispatcher.ts`) maps `DomainError(kind, …)` → `IpcError.kind` verbatim; plain `Error` → `kind: 'internal'`; unknown method → `kind: 'not_found'`.
- **Adding a new IPC method:** types in `src/shared/`, handler in `src/main/ipc/registry.ts` (validate raw params with `_validators.ts` helpers), call site uses `callIpc<Result>(...)`.
- **Per-entity facades vs deprecated umbrella:** `customization-service` is the legacy umbrella; new code uses `skill-service`, `agent-service`, `command-service`, `hook-service`, `global-instruction-service`. They wrap `customization-service` and add plugin-provenance merging. The `customization.*` IPC namespace is retained only for the `CustomizationList` screen inside `PluginEditor` and cross-type search — don't extend it.
- **Adapters** — `claude-adapter.ts` under `src/main/infrastructure/adapters/`, implementing the `Adapter` port; `AdapterManager` orchestrates, `SymlinkManager` reconciles links and returns `SyncResult[]`. Targets and sync flow in `docs/reference/architecture.md`.
- **Plugin-provided entities** (`source.kind === 'plugin'`) are **read-only** — `save`/`delete` raise `OperationNotAllowedForOriginError`.
- **Customization schema** — Markdown + YAML frontmatter; four types (`skill`, `agent`, `global-instruction`, `command`). Full rules and per-type constraints in `docs/reference/customization-schema.md`. One non-obvious point to remember up front: `global-instruction` requires `name === "default"` and `scopes === ["personal"]`.

## Conventions and gotchas

- **Imports use `.js` extensions** even though source is `.ts` — required by `verbatimModuleSyntax: true` + ESM. Example: `import { SkillService } from './application/services/skill-service.js'`.
- **Strict TS** — `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch` are all on. `arr[0]` is `T | undefined`; optional properties don't accept explicit `undefined` unless typed `T | undefined`.
- **No `react-router`** — `App.tsx` uses a `View` discriminated union (`'loading' | 'main' | 'settings' | 'io-error'`) with `useState`. Renderer screens for individual entities are reached via `Main.tsx`'s left-rail navigation.
- **react-query** is the data layer in the renderer — `src/renderer/lib/query-client.ts` configures it; `src/renderer/hooks/use-customization-list.ts` is the canonical example.
- **MUI + Emotion** — design tokens in `src/renderer/theme.ts`. Roboto via `@fontsource/roboto`.
- **Workspace path is fixed** — `~/.superset-ai-app/` (set in `src/main/index.ts`). `WorkspaceBootstrapService` creates the dir tree on first run.
- **Git ops** go through `SimpleGitClient` (`simple-git`); GitHub API through `OctokitClient` (`@octokit/rest`); GitHub PAT is stored encrypted via Electron `safeStorage` (`SafeStorageCredentials`) — **never** returned by any IPC method.

## Project state

Time-boxed validation spike — full scope, must/should/out-of-scope and stop rules in `docs/explanation/prd.md`. Don't infer scope from the code; check the PRD.
