# 008 — Copilot instructions generator — tasks

> Convenção: `[Tnnn] [P?] descrição → AC#N`
> `[P]` = pode rodar em paralelo com tasks vizinhas marcadas `[P]` (arquivos distintos, sem dependência).

## Mapa de cobertura

| AC | Tasks |
|----|-------|
| AC#1 | T003, T005 |
| AC#2 | T006 |
| AC#3 | T008 |
| AC#4 | T010 |
| AC#5 | T012 |
| AC#6 | T013 |
| AC#7 | T015 |
| AC#8 | T011 |
| AC#9 | T017, T018, T019, T020, T021 |
| AC#10 | T024 |
| AC#11 | T025 |
| AC#12 | T026 |
| AC#13 | T022, T023 |
| AC#14 | T028, T029 |
| AC#15 | T027 |

## Phase 1 — Setup
- [x] T001 Atualizar frontmatter de `docs/specs/008-copilot-instructions-gen/spec.md`: `status: active`, `updated_at: 2026-05-03`, preencher `branch: "008-copilot-instructions-gen"` ao criar a branch de implementação.
- [x] T002 Criar branch git `008-copilot-instructions-gen` a partir de `main` (assume 005, 007 já mergeados).

## Phase 2 — Application — `CopilotInstructionsGen`
- [x] T003 Criar arquivo `src/main/application/services/copilot-instructions-gen.ts` exportando o stub `class CopilotInstructionsGen { async generate() { throw new Error("not implemented") } }` e a port `CopilotInstructionsGenPort` em `src/main/application/ports/copilot-instructions-gen.ts`. → AC#1
- [x] T004 [P] Definir tipo `GenerateResult = { path: string; refsIncluded: number }` em `src/main/application/services/copilot-instructions-gen.ts` e exportar. → AC#1
- [x] T005 RED `tests/main/application/services/__tests__/copilot-instructions-gen.contract.test.ts`: `new CopilotInstructionsGen({ artifactRepository, workspaceFs }).generate()` resolve com objeto contendo `path: string` e `refsIncluded: number`. → AC#1
- [x] T006 RED `tests/main/application/services/__tests__/copilot-instructions-gen.filter.test.ts`: dado 3 references onde 2 estão com `includeInCopilotInstructions: true` e 1 sem flag, `generate()` devolve `refsIncluded === 2` e `ArtifactRepository.list({ type: "reference" })` foi chamado. → AC#2
- [x] T007 GREEN implementar leitura via `ArtifactRepository.list({ type: "reference" })` e filtro por `frontmatter.includeInCopilotInstructions === true`. → AC#2
- [x] T008 RED `tests/main/application/services/__tests__/copilot-instructions-gen.header.test.ts`: arquivo escrito começa exatamente com `<!-- GENERATED — edit references in the app -->\n\n`. → AC#3
- [x] T009 GREEN prepender header literal antes do payload. → AC#3
- [x] T010 RED `tests/main/application/services/__tests__/copilot-instructions-gen.order.test.ts`: 3 references com `name` `["Cherry","Apple","banana"]` produzem ordem `["Apple","banana","Cherry"]` no output (via `Intl.Collator('en')`); empate por `name` desempata por `slug`. → AC#4
- [x] T011 GREEN ordenar via `Intl.Collator('en')` antes de concatenar; concatenar bodies separados por `\n\n---\n\n`. Escrita atômica via `tempfile + rename` (helper compartilhado de ADR-15). → AC#4, AC#8
- [x] T012 RED `tests/main/application/services/__tests__/copilot-instructions-gen.chmod.test.ts`: após `generate()`, `(await fs.stat(path)).mode & 0o777 === 0o444`. → AC#5
- [x] T013 GREEN aplicar `fs.chmod(path, 0o444)` após o `rename`; idempotência byte-a-byte preservada (sem timestamp no header). → AC#5, AC#6
- [x] T014 RED `tests/main/application/services/__tests__/copilot-instructions-gen.idempotent.test.ts`: 2 chamadas consecutivas com mesmos inputs produzem `Buffer.equals(bytesAfterFirst, bytesAfterSecond) === true`. → AC#6
- [x] T015 RED `tests/main/application/services/__tests__/copilot-instructions-gen.rewrite-444.test.ts`: pré-aplica `chmod 0o444` no destino e chama `generate()`; sem erro; arquivo final continua `0o444`. → AC#7
- [x] T016 GREEN sequência `chmod 0o644` no destino (se existir) → `tempfile + rename` → `chmod 0o444`. Encapsulada em `writeReadOnly(path, content)` interno. → AC#7
- [x] T022 RED `tests/main/application/services/__tests__/copilot-instructions-gen.zero-refs.test.ts`: pré-popular `<workspace>/_generated/copilot-instructions.md` (`0o444`); des-flaggar todas as references; chamar `generate()` → resolve com `{ path, refsIncluded: 0 }` E `lstat(path)` lança `ENOENT`. → AC#13
- [x] T023 GREEN se `refsIncluded === 0`: `chmod 0o644` no destino se existe → `unlink`; devolver `{ path, refsIncluded: 0 }` sem escrever. → AC#13

## Phase 3 — Infrastructure — `CopilotAdapter` reference branch
- [x] T017 RED `tests/main/infrastructure/adapters/__tests__/copilot-adapter.reference-personal.test.ts`: para `artifact.type === "reference"` flagged, `scopes: ["personal"]`, Copilot enabled, `resolveDestinations` devolve 1 destino com `path === "<HOME>/.copilot/instructions/copilot-instructions.md"` e `target` apontando para `<workspace>/_generated/copilot-instructions.md`. → AC#9 (9a, 9b, 9d)
- [x] T018 RED `tests/main/infrastructure/adapters/__tests__/copilot-adapter.reference-project.test.ts`: para reference flagged, `scopes: ["project"]`, 2 repos linkados, devolve 2 destinos `<repo>/.github/copilot-instructions.md` apontando para o gerado. → AC#9 (9c)
- [x] T019 RED `tests/main/infrastructure/adapters/__tests__/copilot-adapter.reference-cold-start.test.ts`: ao chamar `resolveDestinations` para reference flagged sem `<workspace>/_generated/copilot-instructions.md` no FS, `CopilotInstructionsGen.generate()` é invocado antes do retorno (spy). → AC#9 (9a)
- [x] T020 RED `tests/main/infrastructure/adapters/__tests__/copilot-adapter.reference-zero-refs.test.ts`: para reference flagged com 0 refs flagged no workspace inteiro, `resolveDestinations` devolve `[]`. → AC#9, AC#13
- [x] T021 GREEN substituir o branch `type === "reference"` em `src/main/infrastructure/adapters/copilot-adapter.ts`: invocar `copilotInstructionsGen.generate()`; se `refsIncluded === 0` devolver `[]`; senão devolver destinos `personal` e/ou `project` conforme `artifact.frontmatter.scopes`. Injetar `copilotInstructionsGen` via construtor (atualizar wiring no `Main`/`AdapterManager`). → AC#9
- [x] T027 Garantir regressão da 007: rodar `npm test -- copilot-adapter` com filtros existentes (`agent-*`, `skill-*`, `global-instruction`) e confirmar que ACs 2-5 e 9 da 007 continuam verdes. → AC#15

## Phase 4 — Application — Triggers
- [x] T024 Integração `tests/main/application/__tests__/save-reference-personal.e2e.test.ts`: salvar 1 reference flagged `scopes: ["personal"]` via `ArtifactService.save` → `_generated/copilot-instructions.md` existe com header + body + `chmod 0o444`; symlink em `<HOME>/.copilot/instructions/copilot-instructions.md` aponta para o gerado. → AC#10
- [x] T025 Integração `tests/main/application/__tests__/save-reference-multi-scope.e2e.test.ts`: salvar 1 reference flagged `scopes: ["personal","project"]` com 2 `linkedRepos` → 1 arquivo gerado + 3 symlinks (1 personal + 2 project), todos resolvendo para o mesmo arquivo. → AC#11
- [x] T026 Integração `tests/main/application/__tests__/toggle-flag-removes-from-aggregate.e2e.test.ts`: salvar reference flagged → toggle `includeInCopilotInstructions: true → false` + save → próximo `generate()` (chamado pelo CopilotAdapter no save) tem `refsIncluded` decrescido em 1; conteúdo da reference some do arquivo agregado. → AC#12

## Phase 5 — IPC
- [x] T028 RED `tests/main/ipc/__tests__/dispatcher.copilot-regenerate.test.ts`: `dispatcher.call("copilot.regenerateInstructions", {})` invoca `CopilotInstructionsGen.generate()` (spy) e devolve `{ path, refsIncluded }`. → AC#14
- [x] T029 GREEN registrar handler `copilot.regenerateInstructions` em `src/main/ipc/dispatcher.ts` (sem params; result `{ path, refsIncluded }`). → AC#14

## Phase 6 — Renderer
- [x] T030 [P] Adicionar botão `"Regenerate Copilot instructions"` em `src/renderer/features/settings/CopilotSection.tsx` (ou equivalente) que chama `window.api.call("copilot.regenerateInstructions", {})` e mostra toast `"<refsIncluded> references aggregated"`. → AC#14
- [x] T031 [P] Teste de UI `tests/renderer/features/settings/__tests__/copilot-section.regenerate.test.tsx`: clicar no botão dispara 1 chamada IPC; toast aparece com a contagem retornada. → AC#14

## Phase 7 — Verification
- [x] T032 [P] `npm run lint` passa sem warnings novos no diff. → AC#1-15
- [x] T033 [P] `npm run typecheck` passa. → AC#1-15
- [x] T034 `npm test` passa, com cobertura ≥ 90% em `src/main/application/services/copilot-instructions-gen.ts` e `src/main/infrastructure/adapters/copilot-adapter.ts` (branch `reference`). → AC#1-15
- [x] T035 Smoke manual em `npm run dev`: criar reference flagged → salvar → confirmar `<workspace>/_generated/copilot-instructions.md` existe + symlinks aparecem em `~/.copilot/instructions/copilot-instructions.md` e em pelo menos 1 repo linkado (`<repo>/.github/copilot-instructions.md`); abrir VS Code no repo e confirmar que o Copilot reconhece o conteúdo (validação de paths canônicos). → AC#10, AC#11
- [x] T036 Smoke manual: paths com espaços/acentos em `homedir` e `repo.path` continuam funcionando (delegação ao `SymlinkManager` da 004). → AC#9

## Phase 8 — Bookkeeping (sync de docs antes de `status: done`)

> ROADMAP **não** é atualizado nesta phase — entra apenas no retro quinzenal (PRD §6 / CLAUDE.md).

- [x] T037 Reconciliar `ARCH §9`: avaliar se as decisões fixadas em "Considered alternatives" (separator `\n\n---\n\n`, filename canônico personal, IPC method, comportamento 0 refs) merecem ADR(s) novo(s) ou atualização do ADR-7. Criar/atualizar referenciando spec `008`.
- [x] T038 Reconciliar `ARCH §6.4`: confirmar que o fluxo descrito reflete a implementação (separator, filename canônico personal, comportamento 0 refs); atualizar texto se divergente.
- [x] T039 Reconciliar `ARCH §7.4`: adicionar linha `~/.copilot/instructions/copilot-instructions.md` (personal) na seção Copilot destinations; atualizar `<repo>/.github/copilot-instructions.md` (project) se ainda não estiver explícito.
- [x] T040 Reconciliar `ARCH §5.3`: confirmar que `CopilotInstructionsGen` na tabela de Main services está descrito de forma consistente com a implementação.
- [x] T041 Avaliar se `PRD §4` (must-have "`copilot-instructions.md` generated from flagged references") precisa ajuste de redação após implementação. Registrar a decisão (PR description ou nota no spec) mesmo se for N/A.
- [x] T042 Frontmatter de `spec.md`: marcar `status: review` ao terminar Phase 7 verde; após bookkeeping completo, marcar `status: done`; atualizar `updated_at` em cada transição; preencher `branch: "008-copilot-instructions-gen"`.
