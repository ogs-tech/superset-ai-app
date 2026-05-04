# 009 — Disable adapter flow — tasks

> Convenção: `[Tnnn] [P?] descrição → AC#N`
> `[P]` = pode rodar em paralelo com tasks vizinhas marcadas `[P]` (arquivos distintos, sem dependência).

## Mapa de cobertura

| AC | Tasks |
|----|-------|
| AC#1 | T003, T004 |
| AC#2 | T005 |
| AC#3 | T006 |
| AC#4 | T009, T010 |
| AC#5 | T011 |
| AC#6 | T015, T017 |
| AC#7 | T016 |
| AC#8 | T018, T019 |
| AC#9 | T020 |
| AC#10 | T024 |
| AC#11 | T025 |
| AC#12 | T026 |
| AC#13 | T027 |
| AC#14 | T029, T030 |
| AC#15 | T031 |
| AC#16 | T028 |
| AC#17 | T012, T013 |
| AC#18 | T014 |

## Phase 1 — Setup
- [x] T001 Atualizar frontmatter de `docs/specs/009-disable-adapter-flow/spec.md`: `status: active`, `updated_at: 2026-05-03`, preencher `branch: "009-disable-adapter-flow"` ao criar a branch de implementação.
- [x] T002 Criar branch git `009-disable-adapter-flow` a partir de `main` (assume 005, 007 mergeados; recomendado fechar 008 antes da Phase 6 Verification para cobrir o symlink do agregado).

## Phase 2 — Infrastructure — `SymlinkManager.removeIfPointsToWorkspace`
- [x] T003 Adicionar assinatura `removeIfPointsToWorkspace(destination: string, workspacePath: string): Promise<"removed" | "skipped-not-found" | "skipped-real-file" | "skipped-out-of-workspace">` em `src/main/infrastructure/symlink-manager.ts`. Stub lança `not implemented`. → AC#1
- [x] T004 RED `tests/main/infrastructure/__tests__/symlink-manager.remove-if-points.contract.test.ts`: chamadas em 4 cenários (path inexistente, arquivo real, symlink dentro do workspace, symlink fora) devolvem o valor correto correspondente. → AC#1
- [x] T005 RED `tests/main/infrastructure/__tests__/symlink-manager.remove-if-points.real-file.test.ts`: pré-popular um arquivo real (não-symlink) no destino; spy em `fs.unlink`; chamar `removeIfPointsToWorkspace` → devolve `"skipped-real-file"`; spy do `unlink` **não** foi chamado. → AC#2
- [x] T006 RED `tests/main/infrastructure/__tests__/symlink-manager.remove-if-points.external.test.ts`: pré-popular symlink no destino apontando para `/tmp/external-target` (fora do workspace); chamar `removeIfPointsToWorkspace` → devolve `"skipped-out-of-workspace"`; symlink permanece (verifiable por `lstat`). → AC#3
- [x] T007 RED `tests/main/infrastructure/__tests__/symlink-manager.remove-if-points.removed.test.ts`: pré-popular symlink no destino apontando para `<workspacePath>/skills/foo/SKILL.md`; chamar → devolve `"removed"`; `lstat` do destino lança `ENOENT` após. → AC#1
- [x] T008 GREEN implementar: `lstat` (ENOENT → `"skipped-not-found"`); se `!isSymbolicLink()` → `"skipped-real-file"`; `readlink` + `path.resolve(path.dirname(destination), target)`; se `!resolved.startsWith(path.resolve(workspacePath) + path.sep)` → `"skipped-out-of-workspace"`; senão `unlink` + `"removed"`. → AC#1, AC#2, AC#3

## Phase 3 — Application — `AdapterManager.removeAll` / `countDestinations`
- [x] T009 Adicionar `removeAll(adapterId: string): Promise<{ removed: number; skipped: number; errors: SymlinkError[] }>` em `src/main/application/services/adapter-manager.ts`. Stub lança `not implemented`. → AC#4
- [x] T010 RED `tests/main/application/services/__tests__/adapter-manager.remove-all.unknown.test.ts`: `removeAll("unknown")` devolve `{ removed: 0, skipped: 0, errors: [] }` sem chamar `ArtifactRepository.list`. → AC#4
- [x] T011 RED `tests/main/application/services/__tests__/adapter-manager.remove-all.shape.test.ts`: shape `{ removed, skipped, errors }` com `errors[i]` no shape `{ destination, kind, message }`. → AC#5
- [x] T012 Adicionar `countDestinations(adapterId: string): Promise<number>` em `AdapterManager`. → AC#17
- [x] T013 RED `tests/main/application/services/__tests__/adapter-manager.count-destinations.test.ts`: dado 2 artifacts × 2 destinos cada (todos symlinks dentro do workspace) → `countDestinations("claude")` devolve `4`; symlinks fora do workspace ou arquivos reais não contam. → AC#17
- [x] T014 RED `tests/main/application/services/__tests__/adapter-manager.remove-all.copilot-generated.test.ts`: pré-popular `<workspace>/_generated/copilot-instructions.md` (`0o444`) + 1 reference flagged + symlinks Copilot derivados; chamar `removeAll("copilot")` → todos os symlinks Copilot removidos E `lstat` do `_generated/copilot-instructions.md` lança `ENOENT`. → AC#18
- [x] T015 GREEN implementar `removeAll`: lookup do `Adapter` por id (no-op se desconhecido); `ArtifactRepository.list()`; para cada artifact × cada `adapter.resolveDestinations({ artifact, linkedRepos })` → `SymlinkManager.removeIfPointsToWorkspace`; acumular contadores; capturar exceções inesperadas como `errors[]`. **Branch Copilot**: após o loop, se adapterId === "copilot" e `<workspace>/_generated/copilot-instructions.md` existe, fazer `chmod 0o644` + `unlink`. → AC#4, AC#5, AC#18
- [x] T016 GREEN implementar `countDestinations`: mesma iteração de `removeAll` mas, ao invés de `removeIfPointsToWorkspace`, conta destinos onde `lstat.isSymbolicLink() === true` E `readlink` resolvido começa com `path.resolve(workspacePath) + path.sep`. → AC#17

## Phase 4 — IPC — `adapter.setEnabled`
- [x] T017 RED `tests/main/ipc/__tests__/dispatcher.adapter-set-enabled.disable-with-remove.test.ts`: `dispatcher.call("adapter.setEnabled", { adapterId: "claude", enabled: false, removeSymlinks: true })` invoca `AdapterManager.removeAll("claude")` (spy) E `SettingsService.save({ adapters: { claude: { enabled: false } } })` (spy); result expõe `{ removed, skipped, errors }`. → AC#6
- [x] T018 RED `tests/main/ipc/__tests__/dispatcher.adapter-set-enabled.disable-no-remove.test.ts`: `{ adapterId: "claude", enabled: false, removeSymlinks: false }` **não** chama `removeAll`; só `SettingsService.save`; result `{ removed: 0, skipped: 0, errors: [] }`. → AC#7
- [x] T019 RED `tests/main/ipc/__tests__/dispatcher.adapter-set-enabled.enable.test.ts`: `{ adapterId: "claude", enabled: true }` (sem `runSyncAll`) → default `runSyncAll: true` → invoca `AdapterManager.syncAll({ adapterId: "claude" })` (spy) e devolve `{ syncReport: SyncResult[] }`. Caso `runSyncAll: false` → `syncAll` **não** chamado; result `{ syncReport: [] }`. → AC#8
- [x] T020 RED `tests/main/ipc/__tests__/dispatcher.adapter-set-enabled.persist-on-error.test.ts`: forçar erro de FS em 1 `unlink` durante `removeAll`; após `dispatcher.call(...)`, `SettingsService.load().adapters.claude.enabled === false`; result tem `errors.length > 0`. → AC#9
- [x] T021 GREEN registrar handler `adapter.setEnabled` em `src/main/ipc/dispatcher.ts`. Branch `enabled: false`: `removeAll` se `removeSymlinks !== false` (default `true`) → `SettingsService.save` (sempre, mesmo com erros). Branch `enabled: true`: `SettingsService.save` → `syncAll` se `runSyncAll !== false` (default `true`). → AC#6, AC#7, AC#8, AC#9

## Phase 5 — Application — e2e disable scenarios
- [x] T022 Integração `tests/main/application/__tests__/disable-claude.e2e.test.ts`: pré-popular 3 symlinks Claude dentro do workspace (1 skill personal + 1 skill project + 1 agent personal) + 1 arquivo real no destino esperado de outro skill. `dispatcher.call("adapter.setEnabled", { adapterId: "claude", enabled: false, removeSymlinks: true })` → `{ removed: 3, skipped: 1, errors: [] }`; arquivo real continua existindo (`lstat`). → AC#10
- [x] T023 Integração `tests/main/application/__tests__/disable-copilot-aggregate.e2e.test.ts`: 1 reference flagged + 2 repos linkados + `<workspace>/_generated/copilot-instructions.md` gerado. `removeAll("copilot")` → símbolos do agregado em `~/.copilot/instructions/copilot-instructions.md` E em cada `<repo>/.github/copilot-instructions.md` removidos (`lstat` ENOENT). Símbolos de skill/agent Copilot, se houver, também removidos. → AC#11
- [x] T024 Reusar T022 como cobertura de AC#10 sem duplicar; verificar caso "removed: 3, skipped: 1" estritamente. → AC#10
- [x] T025 Reusar T023 como cobertura de AC#11. → AC#11
- [x] T026 Integração `tests/main/application/__tests__/disable-copilot-no-repos.e2e.test.ts`: reference flagged com `scopes: ["personal","project"]` + `linkedRepos: []` → `removeAll("copilot")` não crasha; devolve `{ removed: <só personal>, skipped: 0, errors: [] }`. → AC#12
- [x] T027 Integração `tests/main/application/__tests__/disable-claude-external-symlink.e2e.test.ts`: pré-popular symlink Claude existente apontando para `/tmp/external-target` → após `removeAll("claude")`, `lstat` do destino mostra que o symlink ainda existe; result tem `skipped` incrementado. → AC#13
- [x] T028 Regressão da 002: `tests/main/infrastructure/__tests__/settings-service.atomic-write.test.ts` (existente) continua verde após mudanças neste spec. → AC#16

## Phase 6 — Renderer
- [x] T029 Atualizar `src/renderer/features/settings/AdaptersSection.tsx` (ou equivalente): toggle off de cada adapter → chama `window.api.call("adapter.countDestinations", { adapterId })` (necessário expor um IPC method dedicado — adicionar `adapter.countDestinations` ao dispatcher) → abre `ConfirmDisableModal` com `N` calculado. → AC#14
- [x] T030 Criar `src/renderer/features/settings/ConfirmDisableModal.tsx` com 3 botões: `"Sim, remover N symlinks"`, `"Não, só desligar"`, `"Cancelar"`. Sim → `adapter.setEnabled` com `removeSymlinks: true`; Não → `removeSymlinks: false`; Cancelar → no-op. Em sucesso, toast `"<removed> removidos, <skipped> ignorados"`; se `errors.length > 0`, abre `ErrorsModal` listando `errors`. → AC#14
- [x] T031 Toggle on de cada adapter dispara `adapter.setEnabled` com `enabled: true` (sem confirmação) → como `runSyncAll` default é `true`, o `syncReport` retornado é re-renderizado no `SyncReportModal` existente (pattern da 006). Teste de UI `tests/renderer/features/settings/__tests__/adapters-section.toggle-on.test.tsx`: 1 chamada IPC + abre `SyncReportModal` com N entradas. → AC#15
- [x] T032 [P] Teste de UI `tests/renderer/features/settings/__tests__/adapters-section.toggle-off.test.tsx`: clicar toggle off → modal abre com botão "Sim, remover 5 symlinks" (N pré-calculado mockado); clicar Sim → IPC chamado com `removeSymlinks: true`; toast aparece após sucesso. → AC#14
- [x] T033 [P] Adicionar IPC handler `adapter.countDestinations` em `src/main/ipc/dispatcher.ts` (params `{ adapterId }`; result `{ count: number }`); teste `tests/main/ipc/__tests__/dispatcher.adapter-count-destinations.test.ts`. → AC#17

## Phase 7 — Verification
- [x] T034 [P] `npm run lint` passa sem warnings novos no diff. → AC#1-18
- [x] T035 [P] `npm run typecheck` passa. → AC#1-18
- [x] T036 `npm test` passa, com cobertura ≥ 90% em `src/main/infrastructure/symlink-manager.ts` (novo método), `src/main/application/services/adapter-manager.ts` (novos métodos) e `src/main/ipc/dispatcher.ts` (handler `adapter.setEnabled`). → AC#1-18
- [x] T037 Smoke manual em `npm run dev`: ligar Claude, criar 2 artifacts (1 skill, 1 agent personal), confirmar symlinks em `~/.claude/`. Toggle off → modal aparece com `"Sim, remover 2 symlinks"` → confirmar → toast `"2 removidos, 0 ignorados"`; `ls -la ~/.claude/` mostra ausência. Toggle on → `SyncReportModal` aparece com 2 entradas; symlinks recriados. → AC#10, AC#14, AC#15
- [x] T038 Smoke manual: com Copilot ligado e ≥1 reference flagged, confirmar `<workspace>/_generated/copilot-instructions.md` existe; toggle off Copilot → modal → confirmar → arquivo gerado some E symlinks de aggregate somem (`ls -la ~/.copilot/instructions/` e `ls -la <repo>/.github/`). → AC#11, AC#18

## Phase 8 — Bookkeeping (sync de docs antes de `status: done`)

> ROADMAP **não** é atualizado nesta phase — entra apenas no retro quinzenal (PRD §6 / CLAUDE.md).

- [x] T039 Reconciliar `ARCH §9`: criar/atualizar ADR registrando: (a) IPC `adapter.setEnabled` paramétrico (vs métodos pares); (b) auto-`syncAll` ao religar (default `runSyncAll: true`); (c) cleanup do `_generated/copilot-instructions.md` ao desligar Copilot (paridade com a regra "0 refs flagged → remove file" da 008); (d) modal com pré-cálculo via `countDestinations` (dry-run); (e) settings persistidas mesmo com `errors.length > 0`. Referenciar spec `009`.
- [x] T040 Reconciliar `ARCH §6.3`: confirmar/atualizar o fluxo descrito para incluir o passo de cleanup do `_generated/copilot-instructions.md` (Copilot only) e o auto-`syncAll` no religar.
- [x] T041 Reconciliar `ARCH §5.3`: atualizar descrições de `AdapterManager` e `SymlinkManager` se a tabela de Main services não menciona `removeAll` / `countDestinations` / `removeIfPointsToWorkspace`.
- [x] T042 Reconciliar `ARCH §8.1`: adicionar `adapter.setEnabled` e `adapter.countDestinations` à tabela "Methods" da seção Renderer ↔ Main contract.
- [x] T043 Avaliar se `PRD §4` (must-have "Settings: enable/disable adapter") precisa ajuste após implementação. Registrar a decisão (PR description ou nota no spec) mesmo se for N/A.
- [x] T044 Frontmatter de `spec.md`: marcar `status: review` ao terminar Phase 7 verde; após bookkeeping completo, marcar `status: done`; atualizar `updated_at` em cada transição; preencher `branch: "009-disable-adapter-flow"`.
