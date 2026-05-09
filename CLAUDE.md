# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this app is

**Skillforge / sde-ai-app** — an Electron desktop app that centralizes AI customizations (skills, references, agent profiles, global instructions) as Markdown + YAML files, then syncs them to Claude Code (`~/.claude/`, `<repo>/.claude/`) and GitHub Copilot (`~/.copilot/`, `<repo>/.github/`) via **symbolic links**. Single-developer dogfooding spike — no backend, no API, no telemetry.

Authoritative docs live in `docs/` (Diátaxis):
- `docs/explanation/prd.md` — goals, scope, stop rules
- `docs/reference/architecture.md` — hexagonal layout
- `docs/reference/ipc-contract.md` — every IPC method
- `docs/reference/customization-schema.md` — frontmatter rules

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

### Three Electron processes, three bundles

```
src/
├── main/        # Node.js — domain, services, IPC handlers, file I/O
├── preload/     # Bridge — exposes window.api.call() to the renderer
├── renderer/    # React 19 UI (MUI + react-query)
└── shared/      # Types crossing the process boundary
```

`electron.vite.config.ts` builds each as a separate bundle into `out/{main,preload,renderer}`.

### Hexagonal layers inside `src/main/`

```
main/
├── domain/          # Pure value types (ids, errors, source, manifests)
├── application/
│   ├── ports/       # Interfaces — what services need from the outside
│   ├── services/    # Use cases (skill-service, plugin-service, …)
│   └── schemas/     # Zod schemas for frontmatter
├── infrastructure/  # Adapter impls (filesystem, git, dialog, github, …)
├── ipc/             # Handlers wiring services to renderer requests
└── templates/       # Built-in template Markdown (seeded on first launch)
```

**Rule:** services in `application/services/` must depend on **ports**, never on `node:fs`, `electron`, `simple-git`, `@octokit/rest` directly. Concrete I/O lives in `infrastructure/`. This is enforced socially — there's no automated check, but breaking it makes services hard to test.

`src/main/index.ts` is the composition root: it news up every adapter and service and hands the wired `handlers` map to `createDispatcher`.

### IPC — single channel, dispatcher pattern

Wire shape (defined in `src/shared/ipc-contract.ts`):

```ts
const IPC_CHANNEL = 'ipc:call';
// Renderer → main: { method: 'skill.list', params: {...} }
// Main → renderer: { ok: true, data: T } | { ok: false, error: { kind, message, details? } }
```

- Renderer calls `callIpc<T>('namespace.method', params)` from `src/renderer/lib/ipc.ts` — it unwraps `data` or throws `IpcCallError`.
- `src/main/ipc/dispatcher.ts` wraps every handler in try/catch and maps `DomainError(kind, …)` → `IpcError.kind` verbatim. Plain `Error` → `kind: 'internal'`. Unknown method → `kind: 'not_found'`.
- Method namespaces: `app`, `settings`, `repo`, `workspace`, `dialog`, `skill`, `agent`, `command`, `hook`, `reference`, `global-instruction`, `template`, `adapter`, `marketplace`, `plugin`, `credentials`, plus deprecated `customization`.

**Adding a new IPC method:** types in `src/shared/`, handler in `src/main/ipc/registry.ts` (validate raw params with `_validators.ts` helpers), call site uses `callIpc<Result>(...)`.

### Per-entity service facades vs the deprecated umbrella

`customization-service` is the **legacy** umbrella that originally handled all four customization types. The codebase is mid-migration — new code should use the typed facades:

- `skill-service`, `agent-service`, `command-service`, `hook-service`, `reference-service`, `global-instruction-service`

These wrap `customization-service` and add provenance merging (workspace files + plugin-provided entries via `plugin-provenance`). The deprecated `customization.*` IPC namespace is retained for the legacy `CustomizationList` screen used inside `PluginEditor` and for cross-type search. Don't add new features to it.

### Customization model

A customization = Markdown file with YAML frontmatter, typed as one of:
- `skill` · `reference` · `agent` · `global-instruction`

Schema (`src/main/application/schemas/`):
- Common fields: `name` (slug), `type`, `description` (1–1024 chars), `scopes` (subset of `personal` | `project`, ≥1, no dups), `version` (semver), `createdAt`/`updatedAt` (ISO 8601), `tags?`. Frontmatter is `passthrough()` — unknown fields kept.
- `global-instruction` is special: `name` **must** be the literal `"default"`; `scopes` **must** be exactly `["personal"]`. Exactly one per machine.
- `reference` is **app-only** — `claude-adapter.ts` deliberately returns no destinations; references are aggregated into `.github/copilot-instructions.md` by `CopilotInstructionsGen`.

### Adapter / sync model

Two adapters under `src/main/infrastructure/adapters/`:
- `claude-adapter.ts` — symlinks personal customizations into `~/.claude/`, project ones into `<repo>/.claude/`.
- `copilot-adapter.ts` — same shape into `~/.copilot/` and `<repo>/.github/`, plus generates `copilot-instructions.md`.

Both implement the `Adapter` port (`src/main/application/ports/adapter.ts`). `AdapterManager` orchestrates them; `SymlinkManager` handles the actual link create/reconcile and reports `SyncResult[]` back through the IPC response.

Plugin-provided entities (`source.kind === 'plugin'`) are **read-only** — `save`/`delete` raise `OperationNotAllowedForOriginError`.

## Conventions and gotchas

- **Imports use `.js` extensions** even though source is `.ts` — required by `verbatimModuleSyntax: true` + ESM. Example: `import { SkillService } from './application/services/skill-service.js'`.
- **Strict TS** — `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch` are all on. `arr[0]` is `T | undefined`; optional properties don't accept explicit `undefined` unless typed `T | undefined`.
- **No `react-router`** — `App.tsx` uses a `View` discriminated union (`'loading' | 'main' | 'settings' | 'io-error'`) with `useState`. Renderer screens for individual entities are reached via `Main.tsx`'s left-rail navigation.
- **react-query** is the data layer in the renderer — `src/renderer/lib/query-client.ts` configures it; `src/renderer/hooks/use-customization-list.ts` is the canonical example.
- **MUI + Emotion** — design tokens in `src/renderer/theme.ts`. Roboto via `@fontsource/roboto`.
- **Workspace path is fixed** — `~/.sde-ai-app/` (set in `src/main/index.ts`). `WorkspaceBootstrapService` creates the dir tree; templates are seeded from `src/main/templates/` on first run.
- **Git ops** go through `SimpleGitClient` (`simple-git`); GitHub API through `OctokitClient` (`@octokit/rest`); GitHub PAT is stored encrypted via Electron `safeStorage` (`SafeStorageCredentials`) — **never** returned by any IPC method.

## Project state

This is a **time-boxed validation spike** (see `docs/explanation/prd.md`). Scope is intentionally lean: no multi-user, no Linux/Windows, no i18n, no accessibility polish. Should-haves (full schema validation, text search, token usage) only ship after must-haves have been used in real work for ≥1 week.
