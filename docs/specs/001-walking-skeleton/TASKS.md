# 001 — Walking skeleton — tasks

## Tooling baseline
- [ ] `npm init` + commit `package.json` mínimo.
- [ ] Adicionar `electron`, `electron-vite`, `react`, `react-dom`, `typescript`, `vite`, `@types/react`, `@types/react-dom` como devDependencies (Electron pinado a uma versão LTS).
- [ ] Configurar `electron.vite.config.ts` com 3 entradas (`main`, `preload`, `renderer`).
- [ ] `tsconfig.json` base + `tsconfig.node.json` (main/preload) + `tsconfig.web.json` (renderer); `strict: true`, `noUncheckedIndexedAccess: true`.
- [ ] ESLint + Prettier com presets para TS + React; scripts `lint`, `typecheck`, `format`.
- [ ] Vitest com config para o Main (ambiente node); script `test` e `test:watch`.

## Shared contracts (TDD: tipos não têm teste, mas escrever antes do uso)
- [ ] `src/shared/ipc-contract.ts`: `IpcErrorKind`, `IpcError`, `IpcResult<T>`.
- [ ] `src/shared/settings.ts`: interface `Settings` (subset de ARCH §8.5 definido no spec).

## Domain
- [ ] `src/main/domain/errors.ts`: classe `DomainError extends Error` com `kind` e `details`.

## Application — SettingsService (RED → GREEN → REFACTOR)
- [ ] RED: `tests/main/application/settings-service.test.ts`
  - `get()` retorna o objeto produzido por `repo.load()`.
  - `get()` propaga `DomainError` do repo sem swallow.
- [ ] GREEN: `src/main/application/ports/settings-repository.ts` (interface `SettingsRepository`).
- [ ] GREEN: `src/main/application/services/settings-service.ts` (`SettingsService` com `get()`).
- [ ] REFACTOR se necessário; rodar `npm test` verde.

## Infrastructure
- [ ] `src/main/infrastructure/settings/in-memory-settings-repository.ts`: implementa `SettingsRepository.load()` retornando os defaults definidos no spec.

## IPC dispatcher (RED → GREEN → REFACTOR)
- [ ] RED: `tests/main/ipc/dispatcher.test.ts`
  - Handler conhecido → `{ ok: true, data }`.
  - Método desconhecido → envelope `not_found`.
  - `DomainError` lançado → envelope com `kind` preservado e `details`.
  - `Error` genérico → envelope `internal` com message preservada.
  - Lançamento não-`Error` → envelope `internal` com message `'Unknown error'`.
- [ ] GREEN: `src/main/ipc/dispatcher.ts` (`createDispatcher(handlers)`).
- [ ] GREEN: `src/main/ipc/registry.ts` (`buildHandlers({ settingsService })` registra `'settings.get'`).
- [ ] REFACTOR se necessário; rodar `npm test` verde.

## Composition root (Main)
- [ ] `src/main/index.ts`:
  - Cria `BrowserWindow` com `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
  - Instancia `InMemorySettingsRepository` → `SettingsService` → `buildHandlers` → `createDispatcher`.
  - `ipcMain.handle('ipc:call', (_, { method, params }) => dispatcher(method, params))`.
  - Apontar para `index.html` do Renderer (dev e prod via electron-vite).

## Preload
- [ ] `src/preload/index.ts`: `contextBridge.exposeInMainWorld('api', { call })` chamando `ipcRenderer.invoke('ipc:call', { method, params })` e tipado como `IpcResult<T>`.

## Renderer
- [ ] `src/renderer/index.html`.
- [ ] `src/renderer/main.tsx` (React root).
- [ ] `src/renderer/App.tsx`: botão "Get settings" + `useState<IpcResult<Settings> | null>(null)` + render condicional do `data` (JSON pretty) ou de `error.message`.
- [ ] `src/renderer/vite-env.d.ts`: declarar `window.api` tipado.

## Verification
- [ ] `npm run lint` passa.
- [ ] `npm run typecheck` passa.
- [ ] `npm test` passa com cobertura ≥ 90% em `application/` e `ipc/`.
- [ ] `npm run dev` abre janela; clique no botão mostra o JSON dos defaults.
- [ ] `npm run build` produz bundles sem erro.
- [ ] Manual: editar `SettingsService.get` para lançar erro e confirmar envelope `internal` no Renderer; reverter.

## Bookkeeping
- [ ] Atualizar `updated_at` do `spec.md` ao mover para `status: active` e novamente para `status: done`.
- [ ] Atualizar coluna Status do ROADMAP §Now (manualmente ou via `scripts/roadmap-snapshot.sh` quando existir).
