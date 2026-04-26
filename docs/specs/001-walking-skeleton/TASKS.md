# 001 — Walking skeleton — tasks

> Convenção: `[Tnnn] [P?] descrição → AC#N`
> `[P]` = pode rodar em paralelo com tasks vizinhas marcadas `[P]` (arquivos distintos, sem dependência).

## Phase 1 — Tooling baseline
- [x] T001 `npm init` + commit `package.json` mínimo. → AC#1
- [x] T002 Adicionar devDependencies (`electron`, `electron-vite`, `react`, `react-dom`, `typescript`, `vite`, `@types/react`, `@types/react-dom`); Electron pinado em LTS. → AC#1
- [x] T003 Configurar `electron.vite.config.ts` com 3 entradas (`main`, `preload`, `renderer`). → AC#2, AC#3
- [x] T004 [P] `tsconfig.json` base + `tsconfig.node.json` + `tsconfig.web.json`; `strict: true`, `noUncheckedIndexedAccess: true`. → AC#6
- [x] T005 [P] ESLint + Prettier (presets TS + React); scripts `lint`, `typecheck`, `format`. → AC#6
- [x] T006 [P] Vitest config para Main (env node); scripts `test` e `test:watch`. → AC#4

## Phase 2 — Foundational (shared contracts + domain)
- [x] T007 [P] `src/shared/ipc-contract.ts`: `IpcErrorKind`, `IpcError`, `IpcResult<T>`.
- [x] T008 [P] `src/shared/settings.ts`: interface `Settings` (subset de ARCH §8.5).
- [x] T009 [P] `src/main/domain/errors.ts`: `DomainError extends Error` com `kind` e `details`.

## Phase 3 — Application: SettingsService (TDD)
- [x] T010 RED `tests/main/application/settings-service.test.ts`:
  - `get()` retorna o objeto produzido por `repo.load()`.
  - `get()` propaga `DomainError` do repo sem swallow. → AC#4
- [x] T011 GREEN `src/main/application/ports/settings-repository.ts` (interface `SettingsRepository`).
- [x] T012 GREEN `src/main/application/services/settings-service.ts` (`SettingsService.get()`). → AC#4
- [x] T013 REFACTOR se necessário; `npm test` verde.

## Phase 4 — Infrastructure
- [x] T014 `src/main/infrastructure/settings/in-memory-settings-repository.ts`: implementa `SettingsRepository.load()` com defaults do spec.

## Phase 5 — IPC dispatcher (TDD)
- [x] T015 RED `tests/main/ipc/dispatcher.test.ts`:
  - Handler conhecido → `{ ok: true, data }`.
  - Método desconhecido → envelope `not_found`.
  - `DomainError` → envelope com `kind` preservado e `details`.
  - `Error` genérico → envelope `internal` com message preservada.
  - Lançamento não-`Error` → envelope `internal` com message `'Unknown error'`. → AC#4
- [x] T016 GREEN `src/main/ipc/dispatcher.ts` (`createDispatcher(handlers)`). → AC#4
- [x] T017 GREEN `src/main/ipc/registry.ts` (`buildHandlers({ settingsService })` registra `'settings.get'`).
- [x] T018 REFACTOR se necessário; `npm test` verde.

## Phase 6 — Composition root + boundary
- [x] T019 `src/main/index.ts`: cria `BrowserWindow` (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`); instancia repo → service → handlers → dispatcher; `ipcMain.handle('ipc:call', …)`; aponta para `index.html` do Renderer. → AC#2
- [x] T020 [P] `src/preload/index.ts`: `contextBridge.exposeInMainWorld('api', { call })` tipado como `IpcResult<T>`. → AC#2

## Phase 7 — Renderer
- [x] T021 [P] `src/renderer/index.html`.
- [x] T022 [P] `src/renderer/main.tsx` (React root).
- [x] T023 [P] `src/renderer/vite-env.d.ts`: declarar `window.api` tipado.
- [x] T024 `src/renderer/App.tsx`: botão "Get settings" + `useState<IpcResult<Settings> | null>(null)` + render condicional do `data` (JSON pretty) ou de `error.message`. → AC#2

## Phase 8 — Verification
- [x] T025 [P] `npm run lint` passa. → AC#6
- [x] T026 [P] `npm run typecheck` passa. → AC#6
- [x] T027 `npm test` passa com cobertura ≥ 90% em `application/` e `ipc/`. → AC#4, AC#5
- [x] T028 `npm run dev` abre janela; clique no botão mostra o JSON dos defaults. → AC#2
- [x] T029 `npm run build` produz bundles sem erro. → AC#3
- [x] T030 Manual: editar `SettingsService.get` para lançar erro e confirmar envelope `internal` no Renderer; reverter. → AC#7

## Phase 9 — Bookkeeping (sync de docs antes de `status: done`)

> ROADMAP **não** é atualizado nesta phase — entra apenas no retro quinzenal (PRD §6 / CLAUDE.md).

- [ ] T031 Reconciliar `ARCH §9`: garantir que existem ADRs cobrindo as decisões registradas em "Considered alternatives" (electron-vite vs alternativas, hexagonal leve vs Clean/flat, single-channel `call(method, params)` + dispatcher vs multi-channel/tRPC). Criar ou atualizar ADRs se a implementação divergiu; referenciar spec 001.
- [ ] T032 Avaliar se `PRD §4` (must-have/should-have) precisa ajuste após a implementação. Esta spec é infra-only → provavelmente N/A; registrar a decisão (PR description ou nota no spec) se confirmado nada a mudar.
- [ ] T033 Frontmatter de `SPEC.md`: marcar `status: active` ao iniciar Phase 1, `status: done` após Phase 8 verde; atualizar `updated_at` em cada transição; preencher `branch` quando criar a branch de implementação.
