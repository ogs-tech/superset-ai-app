# 001 — Walking skeleton — tasks

> Convenção: `[Tnnn] [P?] descrição → AC#N`
> `[P]` = pode rodar em paralelo com tasks vizinhas marcadas `[P]` (arquivos distintos, sem dependência).

## Phase 1 — Tooling baseline
- [ ] T001 `npm init` + commit `package.json` mínimo. → AC#1
- [ ] T002 Adicionar devDependencies (`electron`, `electron-vite`, `react`, `react-dom`, `typescript`, `vite`, `@types/react`, `@types/react-dom`); Electron pinado em LTS. → AC#1
- [ ] T003 Configurar `electron.vite.config.ts` com 3 entradas (`main`, `preload`, `renderer`). → AC#2, AC#3
- [ ] T004 [P] `tsconfig.json` base + `tsconfig.node.json` + `tsconfig.web.json`; `strict: true`, `noUncheckedIndexedAccess: true`. → AC#6
- [ ] T005 [P] ESLint + Prettier (presets TS + React); scripts `lint`, `typecheck`, `format`. → AC#6
- [ ] T006 [P] Vitest config para Main (env node); scripts `test` e `test:watch`. → AC#4

## Phase 2 — Foundational (shared contracts + domain)
- [ ] T007 [P] `src/shared/ipc-contract.ts`: `IpcErrorKind`, `IpcError`, `IpcResult<T>`.
- [ ] T008 [P] `src/shared/settings.ts`: interface `Settings` (subset de ARCH §8.5).
- [ ] T009 [P] `src/main/domain/errors.ts`: `DomainError extends Error` com `kind` e `details`.

## Phase 3 — Application: SettingsService (TDD)
- [ ] T010 RED `tests/main/application/settings-service.test.ts`:
  - `get()` retorna o objeto produzido por `repo.load()`.
  - `get()` propaga `DomainError` do repo sem swallow. → AC#4
- [ ] T011 GREEN `src/main/application/ports/settings-repository.ts` (interface `SettingsRepository`).
- [ ] T012 GREEN `src/main/application/services/settings-service.ts` (`SettingsService.get()`). → AC#4
- [ ] T013 REFACTOR se necessário; `npm test` verde.

## Phase 4 — Infrastructure
- [ ] T014 `src/main/infrastructure/settings/in-memory-settings-repository.ts`: implementa `SettingsRepository.load()` com defaults do spec.

## Phase 5 — IPC dispatcher (TDD)
- [ ] T015 RED `tests/main/ipc/dispatcher.test.ts`:
  - Handler conhecido → `{ ok: true, data }`.
  - Método desconhecido → envelope `not_found`.
  - `DomainError` → envelope com `kind` preservado e `details`.
  - `Error` genérico → envelope `internal` com message preservada.
  - Lançamento não-`Error` → envelope `internal` com message `'Unknown error'`. → AC#4
- [ ] T016 GREEN `src/main/ipc/dispatcher.ts` (`createDispatcher(handlers)`). → AC#4
- [ ] T017 GREEN `src/main/ipc/registry.ts` (`buildHandlers({ settingsService })` registra `'settings.get'`).
- [ ] T018 REFACTOR se necessário; `npm test` verde.

## Phase 6 — Composition root + boundary
- [ ] T019 `src/main/index.ts`: cria `BrowserWindow` (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`); instancia repo → service → handlers → dispatcher; `ipcMain.handle('ipc:call', …)`; aponta para `index.html` do Renderer. → AC#2
- [ ] T020 [P] `src/preload/index.ts`: `contextBridge.exposeInMainWorld('api', { call })` tipado como `IpcResult<T>`. → AC#2

## Phase 7 — Renderer
- [ ] T021 [P] `src/renderer/index.html`.
- [ ] T022 [P] `src/renderer/main.tsx` (React root).
- [ ] T023 [P] `src/renderer/vite-env.d.ts`: declarar `window.api` tipado.
- [ ] T024 `src/renderer/App.tsx`: botão "Get settings" + `useState<IpcResult<Settings> | null>(null)` + render condicional do `data` (JSON pretty) ou de `error.message`. → AC#2

## Phase 8 — Verification
- [ ] T025 [P] `npm run lint` passa. → AC#6
- [ ] T026 [P] `npm run typecheck` passa. → AC#6
- [ ] T027 `npm test` passa com cobertura ≥ 90% em `application/` e `ipc/`. → AC#4, AC#5
- [ ] T028 `npm run dev` abre janela; clique no botão mostra o JSON dos defaults. → AC#2
- [ ] T029 `npm run build` produz bundles sem erro. → AC#3
- [ ] T030 Manual: editar `SettingsService.get` para lançar erro e confirmar envelope `internal` no Renderer; reverter. → AC#7

## Bookkeeping
- [ ] T031 Atualizar `updated_at` do `spec.md` ao mover para `status: active` e novamente para `status: done`.
- [ ] T032 Atualizar coluna Status do ROADMAP §Now.
