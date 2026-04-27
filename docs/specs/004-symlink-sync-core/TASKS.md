# 004 — Symlink sync core (SymlinkManager + AdapterManager) — tasks

> Convenção: `[Tnnn] [P?] descrição → AC#N`
> `[P]` = pode rodar em paralelo com tasks vizinhas marcadas `[P]` (arquivos distintos, sem dependência).
> Nota de path: a SPEC referencia `domain/ports/Adapter.ts`; a convenção do repo (ADR-13) usa `src/main/application/ports/` — tasks abaixo seguem a convenção existente.

## Mapa de cobertura

| AC | Tasks |
|----|-------|
| AC#1 | T010, T011 |
| AC#2 | T013, T014 |
| AC#3 | T015 |
| AC#4 | T016 |
| AC#5 | T017, T018 |
| AC#6 | T019, T020 |
| AC#7 | T001, T024, T025 |
| AC#8 | T026 |
| AC#9 | T027 |
| AC#10 | T028, T029 |
| AC#11 | T002, T030, T031 |
| AC#12 | T021, T022 |
| AC#13 | T033, T034 |
| AC#14 | T032 |
| AC#15 | T012 |
| AC#16 | T023 |
| AC#17 | T005, T006 |
| AC#18 | T026 |

## Phase 1 — Setup

- [x] T001 Atualizar `src/shared/artifact.ts`: substituir `export type SyncResult = unknown` por tipo concreto `SyncResult = { adapter: string; destination: string | null; status: "ok" | "conflict" | "error"; message?: string; details?: { backupPath?: string; replacedTarget?: string; skipped?: "no-linked-repos"; reason?: string; action?: "overwritten" } }`. Exportar `SyncStatus`. → AC#7
- [x] T002 Atualizar `src/shared/ipc-contract.ts`: adicionar entrada `adapter.syncAll` com payload `{ adapterId?: string }` e retorno `SyncResult[]`. → AC#11

## Phase 2 — Foundational

- [x] T003 [P] Criar `src/main/application/ports/filesystem-port.ts` com interface `FilesystemPort`: `lstat(path)`, `readlink(path)`, `symlink({ target, path })`, `unlink(path)`, `mkdir(path, { recursive })`, `copyFile(src, dest)`, `readdir(path)`, `pathExists(path)`. Tipos retornam `{ kind: "symlink" | "file" | "directory" | "none", target?: string }` para `lstat`. → AC#1, AC#15, AC#16
- [x] T004 [P] Criar `src/main/application/ports/adapter.ts` com interface `Adapter`: `adapterId: string`, `resolveDestinations({ artifact, linkedRepos }): Array<{ scope: "personal" | "project"; destination: string }>`. Sem campos específicos de Claude/Copilot. → AC#17
- [x] T005 [P] RED: criar `src/main/application/ports/__tests__/adapter.contract.test.ts` validando que o tipo `Adapter` exporta apenas `adapterId` e `resolveDestinations` (inspeção via `Object.keys` em fake mínimo) e rejeita extensões. → AC#17
- [x] T006 GREEN: garantir que `adapter.ts` (T004) satisfaz o contract test (T005); ajustar a port se o teste falhar. → AC#17
- [x] T007 Atualizar `src/main/domain/errors.ts`: adicionar `kind: "symlink_conflict"` ao union de `DomainError.kind` e suporte a `details: { backupPath?, reason?, replacedTarget? }`. → AC#12, AC#16

## Phase 3 — Infrastructure

- [x] T008 [P] Criar `src/main/infrastructure/filesystem/node-fs-adapter.ts` implementando `FilesystemPort` via `node:fs/promises` + `node:path`. Normalizar todos os paths com `path.resolve`. → AC#1, AC#15
- [x] T009 [P] Criar `src/main/infrastructure/filesystem/in-memory-filesystem.ts`: fake in-memory de `FilesystemPort` com map `path -> { kind, target?, content? }`, suporte a injeção de erros (`failOn: { op, path, code }`) para simular `EACCES`/`ENOSPC`. → AC#12, AC#16
- [x] T010 [P] Criar `src/main/application/services/__fixtures__/fake-adapter.ts` implementando `Adapter`: `adapterId = "fake"`, `resolveDestinations` parametrizável (mapa scope -> destinos). Não importa de produção. → AC#7

## Phase 4 — Application — SymlinkManager

- [x] T011 RED: criar `src/main/application/services/__tests__/symlink-manager.create-symlink.test.ts` — `create({ source, destination })` em destino inexistente cria symlink simbólico cujo `readlink` resolvido (`path.resolve`) bate com `source`. → AC#1
- [x] T012 GREEN: criar `src/main/application/services/symlink-manager.ts` com `create({ source, destination })` que chama `FilesystemPort.symlink` após resolver paths; cria diretórios pais via `mkdir(..., { recursive: true })`. → AC#1
- [x] T013 RED: adicionar caso em `symlink-manager.special-chars.test.ts` com workspace, source e destination contendo espaços e acentos (ex.: `/tmp/My Workspace/skills/skill com acento/`). → AC#15
- [x] T014 RED: criar `symlink-manager.backup.test.ts` — `create` em destino que é arquivo real copia conteúdo idêntico para `<workspace>/_backups/<timestamp>/<destination-relative>` antes de substituir; verificar `copyFile` chamado e symlink criado depois. → AC#2
- [x] T015 GREEN: estender `symlink-manager.ts` para detectar arquivo real via `lstat`, gerar `<timestamp>` ISO segundos `YYYYMMDDTHHmmss` (com sufixo `-N` em colisão), copiar para `_backups/<timestamp>/<rel>` e só então `unlink` + `symlink`. Receber `clock` e `workspacePath` no construtor. → AC#2
- [x] T016 RED+GREEN: caso `idempotent-no-rewrite` — destino já é symlink apontando para `source` correto: `create` retorna sem chamar `symlink`/`unlink`/`copyFile`; mtime não muda. → AC#3
- [x] T017 RED+GREEN: caso `replace-symlink-to-other` — destino é symlink apontando para target diferente: `create` chama `unlink` + `symlink`, retorna `{ replacedTarget: <antigo> }`; nenhum backup gerado. → AC#4
- [x] T018 RED: criar `symlink-manager.validate.test.ts` cobrindo os quatro estados retornados por `validate({ destination })`: `"none"`, `"symlink-to-source"`, `"symlink-to-other"`, `"real-file"`. → AC#5
- [x] T019 GREEN: implementar `validate` em `symlink-manager.ts` usando `FilesystemPort.lstat` + `readlink` + comparação resolvida com `source`. → AC#5
- [x] T020 RED: criar `symlink-manager.remove.test.ts` — `remove({ destination })` em symlink chama `unlink`; em arquivo real rejeita com `DomainError({ kind: "io", details: { reason: "not-a-symlink" } })`. → AC#6
- [x] T021 GREEN: implementar `remove` em `symlink-manager.ts` com guard via `lstat` antes de `unlink`. → AC#6
- [x] T022 RED+GREEN: criar `symlink-manager.errors.test.ts` injetando `EACCES`/`ENOSPC` no `FilesystemPort` fake nas operações `symlink` e `unlink`; assert envelope `{ kind: "io", message, details: { code } }`. → AC#12
- [x] T023 RED+GREEN: caso `symlink-conflict-envelope` — quando há conflito reportável (arquivo real sobrescrito), `SymlinkManager.create` retorna metadata `{ status: "conflict", details: { backupPath } }` para o caller; `AdapterManager` mapeia para `SyncResult.status = "conflict"`. → AC#12
- [x] T024 RED+GREEN: caso `backup-failed-aborts` — injetar falha em `copyFile` durante backup: `create` propaga `{ kind: "io", details: { reason: "backup-failed" } }` e **não** chama `symlink`/`unlink` no destino (verificar via spy do fake FS). → AC#16
- [x] T025 RED+GREEN: criar `symlink-manager.scan.test.ts` — `scanByTarget({ rootPath, workspacePath })` percorre `rootPath` recursivamente e retorna lista de symlinks cujos targets resolvidos estão dentro de `workspacePath`. → cobertura para spec 008 (sem AC, refactor/preparação)

## Phase 5 — Application — AdapterManager

- [x] T026 RED: criar `src/main/application/services/__tests__/adapter-manager.shape.test.ts` — `syncOne({ artifact })` consulta `SettingsService` para adapters habilitados, delega `resolveDestinations` e retorna `SyncResult[]` com chaves `{ adapter, destination, status, message?, details? }`. → AC#7
- [x] T027 GREEN: criar `src/main/application/services/adapter-manager.ts` consumindo `SettingsService`, `SymlinkManager`, e mapa `Map<string, Adapter>` injetado; itera por `Settings.adapters` (claude, copilot) filtrando `enabled`. → AC#7
- [x] T028 RED+GREEN: criar `adapter-manager.scope-count.test.ts` — com 2 adapters habilitados e 3 `linkedRepos`, `syncOne` para `scope: "project"` retorna `length === 6`; para `scope: "personal"` retorna `length === 2`. → AC#8
- [x] T029 RED+GREEN: criar `adapter-manager.granularity.test.ts` — para `artifact.type === "skill"`, fake adapter resolve destination apontando para `<workspace>/skills/<slug>/` (diretório, `lstat` resolvido `isDirectory()`); para `reference`/`agent`, aponta para `<workspace>/<type>/<slug>.md`. → AC#9
- [x] T030 RED+GREEN: criar `adapter-manager.empty-repos.test.ts` — `scope: "project"` com `linkedRepos: []`: retorna `length === N_adapters_habilitados` com cada item `{ adapter, destination: null, status: "ok", details: { skipped: "no-linked-repos" } }`. → AC#18
- [x] T031 RED+GREEN: caso `syncAll` — `AdapterManager.syncAll({ adapterId? })` agrega resultados de todos os artifacts conhecidos × adapters habilitados; quando `adapterId` é passado, filtra para esse único adapter. → AC#11

## Phase 6 — IPC

- [x] T032 RED: criar `src/main/application/services/__tests__/artifact-service.sync-report.test.ts` — `save` populando `syncReport` com `SyncResult[]` produzido pelo `AdapterManager` injetado; cobrir caminho idempotente (re-save sem alterações: backup count em `_backups/` antes/depois é igual). → AC#10, AC#14
- [x] T033 GREEN: alterar `src/main/application/services/artifact-service.ts` linha ~87 — receber `AdapterManager` no construtor e substituir `syncReport: []` por `await adapterManager.syncOne({ artifact: saved })`. → AC#10
- [x] T034 Verificar via `grep -n "syncReport: \[\]" src/main/` que zero ocorrências em código de produção (`__tests__` permitido). → AC#10
- [x] T035 GREEN: registrar handler `adapter.syncAll` em `src/main/ipc/registry.ts` (parser de payload `{ adapterId? }`, chamada a `AdapterManager.syncAll`); listar no dispatcher central `src/main/ipc/dispatcher.ts`. → AC#11
- [x] T036 RED+GREEN: criar `src/main/ipc/__tests__/adapter-sync-all.test.ts` — invocar via dispatcher `adapter.syncAll` com e sem `adapterId`; assert shape `SyncResult[]`. → AC#11
- [x] T037 GREEN: wiring em `src/main/index.ts` — instanciar `NodeFsAdapter`, `SymlinkManager`, `AdapterManager` e injetar no `ArtifactService` e no `IpcDeps`. → AC#10, AC#11

## Phase 7 — Renderer

- [x] T038 RED: criar `src/renderer/components/__tests__/SyncReportModal.test.tsx` — recebendo `SyncResult[]`, renderiza apenas itens com `status !== "ok"`, mostrando `adapter`, `destination` e `details.backupPath` quando presente; modal não dispara para lista vazia ou só `ok`. → AC#13
- [x] T039 GREEN: criar `src/renderer/components/SyncReportModal.tsx` com markup do modal pós-save. → AC#13
- [x] T040 GREEN: integrar `SyncReportModal` no fluxo de save do renderer (screen de criação/edição de artifact); abrir modal com `syncReport` retornado pelo IPC quando `syncReport.some(r => r.status !== "ok")`. → AC#13

## Phase 8 — Verification

- [x] T041 [P] `npm run lint` passa sem warnings novos em `src/main/application/services/symlink-manager.ts`, `adapter-manager.ts`, `src/main/application/ports/`, `src/main/infrastructure/filesystem/`, `src/renderer/components/SyncReportModal.tsx`. → AC#1, AC#7
- [x] T042 [P] `npm run typecheck` passa. → AC#1, AC#7, AC#17
- [x] T043 `npm test` passa com cobertura ≥ 80% em `src/main/application/services/symlink-manager.ts` e `src/main/application/services/adapter-manager.ts`. → AC#1–AC#9, AC#12, AC#14, AC#16, AC#18
- [x] T044 **DEFERIDA para spec 005.** Smoke manual incoerente com a decisão da 004 de não entregar adapter de produção (SPEC §"Considered alternatives": fake adapter vive apenas em `__fixtures__/`, `index.ts` instancia `AdapterManager` com `adapters: new Map()`). AC#2 e AC#13 cobertos por testes automatizados: T015 (backup happy-path), T024 (backup-failed), T038–T040 (`SyncReportModal`). Smoke end-to-end retorna na 005, quando `ClaudeAdapter` plugar como primeiro adapter rodável em prod. → AC#2, AC#13

## Phase 9 — Bookkeeping (sync de docs antes de `status: done`)

> ROADMAP **não** é atualizado nesta phase — entra apenas no retro quinzenal (PRD §6 / CLAUDE.md).

- [x] T045 [P] Reconciliar `docs/ARCH.md §9`: garantir que ADR-3 (symlink sync) e ADR-8 (overwrite + backup) refletem a implementação; criar ADR novo se a decisão de timestamp `YYYYMMDDTHHmmss-N` ou de `details.skipped: "no-linked-repos"` não estiver registrada; referenciar spec `004`.
- [x] T046 [P] Avaliar se `docs/PRD.md §4` (must-have / should-have / nice-to-have) precisa ajuste após a implementação. Registrar a decisão (PR description ou nota no `SPEC.md`) mesmo se for N/A.
- [x] T047 Frontmatter de `docs/specs/004-symlink-sync-core/SPEC.md`: marcar `status: active` ao iniciar Phase 1, `status: review` após Verification verde, `status: done` após esta phase; atualizar `updated_at` em cada transição; preencher `branch` quando criar a branch de implementação.
