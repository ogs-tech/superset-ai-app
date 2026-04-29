# 014 — Global instructions — tasks

> Convenção: `[Tnnn] [P?] descrição → AC#N`
> `[P]` = pode rodar em paralelo com tasks vizinhas marcadas `[P]` (arquivos distintos, sem dependência).
> Convenção de paths: hexagonal leve (ADR-13). Adapter de produção em `src/main/infrastructure/adapters/`; ports em `src/main/application/ports/`; templates em `src/main/templates/`.

## Mapa de cobertura

| AC | Tasks |
|----|-------|
| AC#1 | T003, T004 |
| AC#2 | T005, T006 |
| AC#3 | T007, T008 |
| AC#4 | T009 |
| AC#5 | T010, T011 |
| AC#6 | T013, T014 |
| AC#7 | T015 |
| AC#8 | T016, T017 |
| AC#9 | T018, T019 |
| AC#10 | T020 |
| AC#11 | T017 |
| AC#12 | T021, T022 |
| AC#13 | T023 |
| AC#14 | T024 |
| AC#15 | T025 |
| AC#16 | T026 |

## Phase 1 — Setup e validação de premissas

- [x] T001 Verificar contra docs oficiais do GitHub Copilot o path canônico de `global-copilot-instructions.md` para VS Code (Context7 → fallback WebFetch). Se divergir de `~/.config/github-copilot/vscode/global-copilot-instructions.md`, atualizar AC#9 e AC#14 antes de seguir para Phase 5. **Resolvido 2026-04-29:** path antigo era híbrido inválido (mistura JetBrains + segmento `vscode/` inventado); canônico do VS Code é `~/.copilot/instructions/global.instructions.md`. AC#9, AC#14, T018, T019, T024 e referências em spec.md atualizados.
- [x] T002 Confirmar existência de `src/main/application/ports/adapter.ts` com `adapterId` e `resolveDestinations({ artifact, linkedRepos })` (entregue pela 004 — não modificar). **Verificado 2026-04-29:** port existe (`Adapter` interface), `adapterId: string` (L10), `resolveDestinations({ artifact, linkedRepos }): AdapterDestination[]` (L11-14); `AdapterDestination = { scope: 'personal' | 'project'; destination: string }` (L4-7) bate com AC#6/AC#9.

## Phase 2 — Type e validação no domain/service

- [x] T003 RED: criar/ampliar test `src/main/domain/__tests__/artifact-type.test.ts` afirmando que `ArtifactType` inclui `"global-instruction"`. → AC#1 — **Implementado em** `tests/shared/artifact.types.test.ts` (path corrigido p/ convenção real do repo).
- [x] T004 GREEN: adicionar `"global-instruction"` ao enum `ArtifactType` em `src/main/domain/artifact.ts` (path canônico do enum). → AC#1 — **Implementado em** `src/shared/artifact.ts` (path real do enum). Cascata: `FOLDER_BY_TYPE`/`ARTIFACT_TYPES` em `fs-artifact-repository.ts`, `FILES_BY_TYPE` em `built-in-template-repository.ts` (placeholder p/ T011), `ARTIFACT_TYPES` em `artifact-id.ts`.
- [x] T005 [P] RED: criar `src/main/application/services/__tests__/artifact-service.global-instruction-slug.test.ts` cobrindo rejeição para `slug: "foo"`, `slug: "Claude"`, `slug: ""`. Asserir `DomainError` com `kind: "validation"` e `details.reason: "global-instruction-slug-not-allowed"`. → AC#2 — **Implementado em** `tests/main/application/services/__tests__/artifact-service.global-instruction-slug.test.ts` (5 testes verdes).
- [x] T006 GREEN: implementar branch de validação em `ArtifactService.save` (ou helper de validação chamado por `save`) que rejeita slug fora do enum quando `type === "global-instruction"`. → AC#2 — Helper `validateGlobalInstruction` em `artifact-service.ts` checa slug ANTES das validações genéricas (necessário p/ casos `""` e `"Claude"`). `ValidationDetails` estendido com `reason?: string`.
- [x] T007 [P] RED: criar `src/main/application/services/__tests__/artifact-service.global-instruction-scope.test.ts` cobrindo `scopes: ["project"]`, `scopes: ["personal", "project"]`, `scopes: []`. Asserir `DomainError({ kind: "validation", details: { reason: "global-instruction-scope-must-be-personal" } })`. → AC#3 — 4 testes verdes; checagem já implementada junto com T006 no mesmo helper.
- [x] T008 GREEN: implementar branch em `ArtifactService.save` que exige `scopes` exatamente `["personal"]` para `type === "global-instruction"`. → AC#3 — Implementado em conjunto com T006 (mesmo helper `validateGlobalInstruction`).
- [x] T009 RED+GREEN: ampliar test integração de `ArtifactService` (ou criar `artifact-service.global-instruction-save.test.ts`) verificando que save com `slug: "claude"` persiste em `<workspace>/global-instructions/claude.md` e `slug: "copilot"` em `<workspace>/global-instructions/copilot.md`. Estender `FsArtifactRepository.resolvePath` (ou equivalente) se necessário para mapear o type ao subdiretório. → AC#4 — 4 testes verdes em `artifact-service.global-instruction-save.test.ts` (testa `FsArtifactRepository` direto via tmpdir).

## Phase 3 — Templates

- [x] T010 [P] RED: ampliar `src/main/application/services/__tests__/template-service.test.ts` cobrindo `TemplateService.list({ type: "global-instruction" })` devolvendo 2 templates com slugs `claude` e `copilot`, `content.length > 0` em ambos. → AC#5 — Estendido `tests/main/application/services/template-service.test.ts` + `tests/main/infrastructure/template/built-in-template-repository.test.ts`.
- [x] T011 GREEN: criar `src/main/templates/global-instruction-claude.md` e `src/main/templates/global-instruction-copilot.md` com cabeçalho explicativo + 2-3 bullets de exemplo cada. Registrar no catálogo do `TemplateService` para o type. → AC#5 — Templates criados; `BuiltInTemplateRepository` refatorado para `Record<ArtifactType, ReadonlyArray<string>>` (multi-file por type).

## Phase 4 — Extensão do `ClaudeAdapter`

- [x] T012 Confirmar shape atual de `ClaudeAdapter.resolveDestinations` em `src/main/infrastructure/adapters/claude-adapter.ts` (ler arquivo, identificar branch switch atual entre `skill | agent | reference`). — Confirmado: branches `reference → []`, `skill | agent → personal/project paths`, demais → `[]`.
- [x] T013 [P] RED: criar `src/main/infrastructure/adapters/__tests__/claude-adapter.global-instruction.test.ts` — `resolveDestinations({ artifact: { type: "global-instruction", slug: "claude", scopes: ["personal"] }, linkedRepos: [] })` devolve `[{ scope: "personal", destination: "<homedir>/.claude/CLAUDE.md" }]`. → AC#6 — 3 testes verdes.
- [x] T014 GREEN: adicionar branch `type === "global-instruction" && slug === "claude"` em `claude-adapter.ts` retornando o destino esperado via `path.join(this.homedir, ".claude/CLAUDE.md")`. → AC#6
- [x] T015 [P] RED+GREEN: no mesmo test file — `resolveDestinations` para `type: "global-instruction", slug: "copilot"` (chegando ao Claude adapter) devolve `[]`. → AC#7 — Coberto no mesmo arquivo de teste.

## Phase 5 — Stub `CopilotAdapter`

- [x] T016 RED: criar `src/main/infrastructure/adapters/__tests__/copilot-adapter.contract.test.ts` reaproveitando o contract test da port `Adapter` (T005/T006 da 004) contra uma instância de `CopilotAdapter`. → AC#8 — 5 testes verdes (adapterId, resolveDestinations function, 3 variantes de homedir inválido).
- [x] T017 GREEN: criar `src/main/infrastructure/adapters/copilot-adapter.ts` com classe `CopilotAdapter` exportando `adapterId = "copilot"` e `resolveDestinations` retornando `[]` por padrão. Construtor recebe `{ homedir: string }` e valida não-vazio com `DomainError({ kind: "internal", details: { reason: "missing-homedir" } })` (mesmo padrão da 005, T004). → AC#8, AC#11
- [x] T018 [P] RED: criar `src/main/infrastructure/adapters/__tests__/copilot-adapter.global-instruction.test.ts` — `resolveDestinations({ artifact: { type: "global-instruction", slug: "copilot", scopes: ["personal"] }, linkedRepos: [] })` devolve `[{ scope: "personal", destination: "<homedir>/.copilot/instructions/global.instructions.md" }]`. → AC#9 — 6 testes verdes.
- [x] T019 GREEN: implementar branch `type === "global-instruction" && slug === "copilot"` em `copilot-adapter.ts` usando `path.join(this.homedir, ".copilot/instructions/global.instructions.md")`. → AC#9
- [x] T020 [P] RED+GREEN: no mesmo test file — testar `[]` retornado para `type: "skill"`, `type: "agent"`, `type: "reference"`, e `type: "global-instruction" + slug: "claude"`. → AC#10 — Cobertos no mesmo arquivo.

## Phase 6 — Wiring em produção

- [x] T021 RED: criar `src/main/infrastructure/adapters/__tests__/copilot-adapter.wiring.test.ts` (ou estender existente) — boot do app com `settings.adapters.copilot.enabled === true` resulta em `AdapterManager.syncAll({ artifact: global-instruction:copilot })` produzindo um `SyncResult` com `adapter: "copilot"` e `status: "ok"`. Usar `InMemoryFilesystem` da 004. → AC#12 — 2 testes verdes. Cascata: `artifactSourcePath` em `adapter-manager.ts` estendido para `global-instruction → global-instructions/<slug>.md`.
- [x] T022 GREEN: editar `src/main/index.ts` para registrar `["copilot", new CopilotAdapter({ homedir: os.homedir() })]` na map do `AdapterManager` (na mesma linha onde `["claude", new ClaudeAdapter(...)]` foi adicionado pela 005). → AC#12 — Map tipada como `Map<string, Adapter>` para acomodar adapters heterogêneos.

## Phase 7 — Integração end-to-end

- [x] T023 RED+GREEN: `src/main/infrastructure/adapters/__tests__/global-instruction.e2e.test.ts` — montar `ArtifactService` + `AdapterManager` + `SymlinkManager` reais sobre `InMemoryFilesystem`, registrar `ClaudeAdapter` e `CopilotAdapter`. Save de `global-instruction:claude` produz symlink em `<homedir>/.claude/CLAUDE.md` resolvendo para `<workspace>/global-instructions/claude.md`. → AC#13 — Verde.
- [x] T024 RED+GREEN: no mesmo e2e file — save de `global-instruction:copilot` produz symlink em `<homedir>/.copilot/instructions/global.instructions.md` resolvendo para `<workspace>/global-instructions/copilot.md`. → AC#14 — Verde.
- [x] T025 RED+GREEN: no mesmo e2e file — fixture com `<homedir>/.claude/CLAUDE.md` preexistente como **arquivo real** (não symlink) com conteúdo `"prior content"`. Save de `global-instruction:claude` produz `SyncResult.status: "conflict"` com `details.action: "overwritten"` e backup em `<workspace>/_backups/<timestamp>/.claude/CLAUDE.md` contendo `"prior content"`. → AC#15 — Verde. **DESVIO da spec**: backup real fica em `<workspace>/_backups/<timestamp>/Users/alice/.claude/CLAUDE.md` (caminho absoluto sem leading slash) porque `SymlinkManager` precisou ser estendido para destinos fora do workspace (rejeitava com `backup-outside-workspace`). Spec assumiu format homedir-relative; ajustar AC#15 wording em Bookkeeping (T034 vizinho).
- [x] T026 [P] RED+GREEN: em qualquer test file de adapter acima — adicionar asserção `path.isAbsolute(d.destination) === true` para todos os destinos retornados por `global-instruction`. → AC#16 — Coberto em `claude-adapter.global-instruction.test.ts`, `copilot-adapter.global-instruction.test.ts` e `global-instruction.e2e.test.ts`.

## Phase 8 — UI

- [x] T027 Adicionar seção "Global Instructions" no sidebar do renderer (path provável: `src/renderer/...`). Botão "+ New" abre modal com seleção de slug (`claude` | `copilot`); aplica template do `TemplateService.list({ type: "global-instruction" })` correspondente. Validação visual cobre fluxo (Phase 9, T031). — Renderer usa **tabs** (não sidebar): adicionado `'global-instruction'` ao array `TABS` em `ArtifactList.tsx`, `tabLabel` retorna `'global instructions'`. `NewFromTemplateDialog` já filtra por type — exibe os 2 templates automaticamente. 44 testes do renderer continuam verdes.

## Phase 9 — Verification

- [ ] T028 Rodar `pnpm typecheck` (ou comando do projeto) — zero erros TS. Nenhum cast de `any` em `copilot-adapter.ts` ou nos branches novos de `claude-adapter.ts`.
- [ ] T029 Rodar `pnpm test` — todos os testes da 014 passam, suite completa segue verde.
- [ ] T030 Rodar `pnpm lint` — zero warnings em arquivos novos/modificados.
- [ ] T031 Smoke manual: iniciar app, habilitar Claude e Copilot em Settings, criar `global-instruction:claude` via UI, salvar; inspecionar `~/.claude/CLAUDE.md` e confirmar symlink apontando para `<workspace>/global-instructions/claude.md`. Repetir para `copilot`. Documentar resultado nas notas da spec — incluir hash `sha256` do conteúdo backupeado em `_backups/` se houver `~/.claude/CLAUDE.md` preexistente real, comparado com o conteúdo original.

## Phase 10 — Bookkeeping

- [ ] T032 Atualizar `docs/specs/014-global-instructions/spec.md` frontmatter: `status: review` ao terminar Phase 9; `updated_at: <hoje>`.
- [ ] T033 Atualizar `docs/PRD.md` §4 must-have: incluir global instructions (Claude `CLAUDE.md` e Copilot `global.instructions.md` em `~/.copilot/instructions/`) explicitamente. Sync com ARCH.
- [ ] T034 Atualizar `docs/ARCH.md`:
  - §5.3: linha `CopilotAdapter` reflete "stub introduzido pela 014, expandido pela 007".
  - §7.2: adicionar `global-instructions/<slug>.md` ao layout.
  - §7.4: adicionar linhas para `<workspace>/global-instructions/claude.md` → `~/.claude/CLAUDE.md` e `<workspace>/global-instructions/copilot.md` → `~/.copilot/instructions/global.instructions.md`.
  - §8.4: incluir `global-instruction` no enum de `type`; documentar restrições (slug ∈ `{claude, copilot}`, scope `personal` only).
- [ ] T035 Atualizar `docs/ROADMAP.md`:
  - Linha `014-global-instructions`: Status `—` → `review`.
  - Linha `007-copilot-adapter`: ajustar description para refletir que `CopilotAdapter` já existe como stub e a 007 estende para skills/agents/references; ajustar dependência (`Depends on 014`).
- [ ] T036 Avaliar promoção a ADR formal em ARCH §9 do **stub-adapter pattern** (CopilotAdapter introduzido como stub na 014, completado pela 007) e/ou **single-instance type via slug enum**. Se promover, editar ARCH e referenciar de volta em `spec.md` "Considered alternatives".
- [ ] T037 Ao transicionar SPEC para `done` (após T032-T036): confirmar que ROADMAP foi atualizado conforme defasagem de uma fase (CLAUDE.md). Apenas a coluna Status muda — Now/Next/Later permanecem congelados até o retro.
