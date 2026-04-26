---
id: "001"
title: Walking skeleton
status: done
priority: now
created_at: 2026-04-25
updated_at: 2026-04-26
depends_on: []
labels: [must-have, infra, core]
related_arch: "§3.1, §4.1, §5.3, §8.1, §8.2"
---

# 001 — Walking skeleton

## What

Estabelecer a fundação estrutural do app: Electron + React + TypeScript empacotado por
`electron-vite`, processo Main organizado em camadas hexagonais leves
(`domain` / `application` / `infrastructure` / `ipc`), `contextBridge` expondo um único
`call(method, params)`, dispatcher central com error envelope (ARCH §8.2), e um caso
ponta-a-ponta provando o caminho:

```
Renderer ── window.api.call('settings.get', {}) ──►
Preload ── ipcRenderer.invoke('ipc:call', …) ──►
Main/ipc/dispatcher ──► SettingsService (use case)
                        ──► SettingsRepository (port)
                        ──► InMemorySettingsRepository (adapter, defaults hardcoded)
```

## Why

Todos os specs seguintes (002+) dependem da mesma estrutura: como o Renderer chama o
Main, como erros viajam, onde um service mora, onde um adapter de I/O mora, e onde um
método novo é registrado. Provar isso uma vez com um caminho real (e não um `ping/pong`
descartável) evita retrabalho em cada spec novo. Ver ARCH §3.1, §5.3, §8.1, §8.2.

## Non-goals

Decisões deliberadas de **não fazer** — diferente de "Out of scope" (que defere para
specs futuros):

- **Sem DI container:** composition root manual em `main/ipc/` é suficiente para o
  tamanho do projeto.
- **Sem runtime validation no IPC:** `IpcResult<T>` discriminated union + TS strict
  cobrem o contrato; sem `zod`/`io-ts` no payload.
- **Sem framework de state management no Renderer:** o Renderer é mínimo e acessa
  estado via `window.api.call`. Redux/Zustand/Jotai ficam fora até existir UI de
  domínio real.
- **Sem multi-window:** uma `BrowserWindow` por instância. Multi-window não está
  no roadmap.
- **Sem abstração sobre Electron `ipcRenderer`/`ipcMain`:** evitar wrappers tipo
  `tRPC`/`electron-trpc` enquanto o contrato `call(method, params)` for suficiente.

## In scope

- **Bootstrap `electron-vite`** com 3 entradas (`main`, `preload`, `renderer`) e
  HMR no Renderer.
- **Layout em camadas no Main:**
  ```
  src/main/
  ├─ domain/              # tipos puros + DomainError
  ├─ application/
  │  ├─ ports/            # interfaces (SettingsRepository)
  │  └─ services/         # use cases (SettingsService)
  ├─ infrastructure/      # adapters de saída (InMemorySettingsRepository)
  └─ ipc/                 # dispatcher + registry (composition root delegada)
  src/preload/             # contextBridge
  src/renderer/            # React mínimo
  src/shared/              # tipos cruzando IPC (Settings, IpcResult, IpcError)
  ```
- **Regras de dependência (convenção documentada, sem lint automatizado):**
  - `domain/` não importa nada do projeto.
  - `application/` importa só `domain/` e `shared/`.
  - `infrastructure/` implementa ports de `application/`; pode usar Node stdlib.
  - `ipc/` é a composition root do Main: instancia adapters, injeta nos services,
    registra handlers.
  - `renderer/` nunca importa de `main/`. Só `shared/` para tipos e `window.api`.
  - `preload/` é a única ponte: importa `shared/` para tipar `window.api`.
- **`contextBridge`** com `contextIsolation: true`, `nodeIntegration: false`,
  `sandbox: true`.
- **IPC contract** em `shared/ipc-contract.ts`:
  ```ts
  type IpcErrorKind =
    | 'validation' | 'io' | 'symlink_conflict' | 'not_found'
    | 'external_api' | 'unauthorized' | 'internal';
  interface IpcError { kind: IpcErrorKind; message: string; details?: Record<string, unknown> }
  type IpcResult<T> = { ok: true; data: T } | { ok: false; error: IpcError };
  ```
- **Dispatcher** em `main/ipc/dispatcher.ts`: recebe `(method, params)`, busca handler
  no registry, encapsula resultado em `IpcResult<T>`, traduz `DomainError` para envelope
  com `kind` preservado e `Error` genérico para `kind: 'internal'`.
- **`SettingsService.get()`** retornando `Settings` default via `InMemorySettingsRepository`:
  ```ts
  {
    workspacePath: '~/sde-ai-app',
    adapters: {
      claude:  { enabled: false, defaultScope: 'personal' },
      copilot: { enabled: false, defaultScope: 'personal' }
    },
    linkedRepos: [],
    ui: { theme: 'system' }
  }
  ```
  Subset de ARCH §8.5 — campos extras entram quando o spec 002 substituir por
  `JsonFileSettingsRepository`.
- **Renderer mínimo:** botão "Get settings" disparando `window.api.call('settings.get', {})`
  e renderizando `data` ou `error.message` conforme `IpcResult`.
- **TypeScript strict** (`"strict": true`, `"noUncheckedIndexedAccess": true`).
- **ESLint + Prettier** com defaults sensatos para o stack (TS + React).
- **Vitest no Main** com testes unitários do dispatcher (4 ramos) e do `SettingsService`
  (happy + propagação de erro).

## Out of scope (deferred to later specs)

- Persistência de `settings.json` em disco, onboarding, link de repos → spec 002.
- CRUD de artifacts, templates → spec 003.
- Symlinks, AdapterManager, ClaudeAdapter, CopilotAdapter → spec 004+.
- `keytar`, `electron-rebuild`, `CopilotUsageClient` → spec 012 (nice-to-have).
- Packaging `.app`, code signing, notarização → post-spike (ARCH §7.1).
- Vitest no Renderer (jsdom), Playwright e2e → debt explícito; entram quando
  houver UI de domínio (provavelmente spec 003).
- `dependency-cruiser` ou outro lint de camada → debt; entra se a fricção aparecer
  com a 2ª service.

## Considered alternatives

| Decisão | Escolhida | Alternativas descartadas | Motivo |
|---|---|---|---|
| Build/bundle | `electron-vite` | Vite cru + `tsc` no Main; `electron-forge` | LTS suporta os 3 entry points + HMR sem config significativa. Forge agrega packaging mas é overhead pré-spike. Vite + `tsc` fica como fallback se `electron-vite` der fricção. |
| Layering no Main | Hexagonal leve (`domain`/`application`/`infrastructure`/`ipc`) | Clean Architecture completa; flat | Hexagonal leve dá clareza de fronteiras sem cerimônia. Clean cheio (entities/use-cases/interfaces/frameworks) é overkill para um app desktop solo. Flat dificulta substituir adapter (ex.: `InMemorySettingsRepository` → `JsonFileSettingsRepository` no spec 002). |
| Contrato IPC | Single `call(method, params)` + dispatcher | Um `ipcMain.handle` por operação; `tRPC`/`electron-trpc` | Single channel reduz superfície exposta via `contextBridge` e centraliza o error envelope (ARCH §8.2). Multi-channel duplica boilerplate. tRPC adiciona dependência runtime + schemas — colide com os non-goals desta spec. |

## Acceptance criteria

1. `npm install` instala dependências sem erro.
2. `npm run dev` abre janela Electron; clicar em "Get settings" mostra o JSON dos
   defaults na UI.
3. `npm run build` produz bundles em `out/` (ou equivalente do `electron-vite`)
   sem erro.
4. `npm test` passa com:
   - Dispatcher: handler conhecido devolve `{ ok: true, data }`.
   - Dispatcher: método desconhecido devolve envelope `not_found`.
   - Dispatcher: `DomainError` lançado por handler vira envelope com `kind` preservado.
   - Dispatcher: `Error` genérico lançado por handler vira envelope `internal`.
   - Dispatcher: lançamento não-`Error` (ex.: `throw 'x'`) vira envelope `internal`
     com message `'Unknown error'`.
   - `SettingsService.get()` devolve o objeto produzido por `repo.load()`.
   - `SettingsService.get()` propaga `DomainError` do repo sem swallow.
5. Cobertura de linhas ≥ 90% em `src/main/application/` e `src/main/ipc/` pelo
   Vitest. Sem meta para `infrastructure/` ou `renderer/`.
6. `npm run lint` e `npm run typecheck` passam sem warnings.
7. Lançar uma exceção dentro do handler de `settings.get` (teste manual: editar o
   service para `throw new Error('x')` temporariamente) produz envelope no Renderer
   com `kind: 'internal'` e a mensagem renderizada.

## Risks & assumptions

- **ASSUMPTION:** `electron-vite` LTS suporta os 3 entry points e HMR no Renderer
  sem configuração customizada significativa. Se a fricção for grande, considerar
  fallback para Vite cru + `tsc` no Main (revisitar antes de cair em
  `electron-forge`).
- **ASSUMPTION:** ESLint + Prettier defaults para TS+React não conflitam com a
  separação `main/preload/renderer`. Se conflitar, isolar configs por workspace
  do `electron-vite`.
- **RISCO baixo:** versão do Electron (latest LTS) pode introduzir mudança de API
  no `contextBridge`. Mitigação: pinar versão no `package.json` e documentar no
  README.
- **DEBT consciente:** ausência de teste no Preload e no bootstrap do Main
  (`BrowserWindow` real) — coberto manualmente nesta spec; e2e fica para depois.

## References

- ARCH §3.1 — Process boundaries (Main + Renderer + contextBridge).
- ARCH §4.1 — Confirmed stack.
- ARCH §5.3 — Main services (SettingsService listada).
- ARCH §8.1 — Renderer ↔ Main contract.
- ARCH §8.2 — Error handling envelope.
- ARCH §8.5 — `settings.json` data model (subset usado aqui).
- ARCH ADR-11 — TypeScript-only no Main.
- ROADMAP — `001-walking-skeleton` na fila Now.

## Bookkeeping notes

- **PRD §4 (T032):** spec é infra-only — must-have/should-have descrevem produto (CRUD, sync, settings) e não foram alterados pela implementação. Nenhuma mudança no PRD.
- **ARCH §9 (T031):** ADR-12 (electron-vite), ADR-13 (hexagonal leve), ADR-14 (single-channel `call` + dispatcher) registrados a partir das "Considered alternatives" desta spec.
