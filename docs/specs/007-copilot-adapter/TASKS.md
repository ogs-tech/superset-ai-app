# 007 — Copilot adapter — tasks

> Convenção: `[Tnnn] [P?] descrição → AC#N`
> `[P]` = pode rodar em paralelo com tasks vizinhas marcadas `[P]` (arquivos distintos, sem dependência).

## Mapa de cobertura

| AC | Tasks |
|----|-------|
| AC#1 | T019, T020, T021 |
| AC#2 | T005, T009, T011 |
| AC#3 | T006, T009, T011 |
| AC#4 | T002, T007, T011 |
| AC#5 | T002, T008, T011 |
| AC#6 | T003, T004 |
| AC#7 | T006, T009, T011 |
| AC#8 | T005, T006, T007, T008, T009, T010, T011 |
| AC#9 | T021 |
| AC#10 | T013, T021 |
| AC#11 | T016 |
| AC#12 | T013, T022 |
| AC#13 | T014 |
| AC#14 | T017 |
| AC#15 | T015 |
| AC#16 | T010, T011 |

## Phase 1 — Setup

- [x] T001 Criar branch `007-copilot-adapter` a partir de `main` (`git checkout -b 007-copilot-adapter`). Atualizar frontmatter de `docs/specs/007-copilot-adapter/SPEC.md`: `branch: "007-copilot-adapter"`, `status: active`, `updated_at: 2026-05-03`. — **Executado 2026-05-03**: branch criada a partir de `main`, frontmatter atualizado.
- [x] T002 Validar a ASSUMPTION sobre `agent` source-shape: confirmar leitura em `src/main/infrastructure/adapters/claude-adapter.ts:56` que o `fileName` para agent é `${name}.md` (file-level). Se a 005/006 introduziu source dir-level para agent, parar e revisar AC#4-5 antes de prosseguir. → AC#4, AC#5 — **Confirmado 2026-05-03**: linha 56 lê `const fileName = type === 'skill' ? name : ${name}.md;` (file-level). Premissa válida; AC#4/AC#5 não precisam revisão.

## Phase 2 — Foundational

- [x] T003 RED `tests/main/infrastructure/adapters/__tests__/copilot-adapter.reference-noop.test.ts`: para `artifact.type === "reference"` em qualquer combinação de `scopes` (`["personal"]`, `["project"]`, `["personal","project"]`) e `linkedRepos` (`[]` e com 2 repos), `resolveDestinations` devolve `[]`. → AC#6 — **Implementado 2026-05-03** com 6 cases (matriz de scopes × linkedRepos). DESVIO: passou verde de cara — o stub original já retornava `[]` por default; T004 adiciona a branch explícita para documentar intenção.
- [x] T004 GREEN `src/main/infrastructure/adapters/copilot-adapter.ts`: adicionar branch `if (type === 'reference') return [];` antes do retorno default. Rodar `npm test -- copilot-adapter.reference-noop` e confirmar verde. → AC#6 — **Implementado 2026-05-03**: branch adicionada; teste segue verde.

## Phase 3 — Adapter (skill + agent)

- [x] T005 [P] RED `tests/main/infrastructure/adapters/__tests__/copilot-adapter.skill-personal.test.ts`: skill com `scopes: ["personal"]` e `linkedRepos: []` produz exatamente 1 destino com `scope: "personal"` e `destination === path.join(homedir, ".copilot/skills", name)`. Asserir `path.isAbsolute(destination) === true`. → AC#2, AC#8 — **Implementado 2026-05-03**: 2 testes RED, ficaram verdes após T011.
- [x] T006 [P] RED `tests/main/infrastructure/adapters/__tests__/copilot-adapter.skill-project.test.ts`: skill com `scopes: ["project"]` e `linkedRepos.length === 2` produz 2 destinos `scope: "project"` em `path.join(repo.path, ".github/skills", name)`. Caso adicional: `linkedRepos: []` devolve `[]`. Asserir paths absolutos. → AC#3, AC#7, AC#8 — **Implementado 2026-05-03**: 3 testes RED, verdes após T011.
- [x] T007 [P] RED `tests/main/infrastructure/adapters/__tests__/copilot-adapter.agent-personal.test.ts`: agent com `scopes: ["personal"]` produz 1 destino personal com `destination === path.join(homedir, ".copilot/agents", name + ".agent.md")`. Asserir path absoluto. → AC#4, AC#8 — **Implementado 2026-05-03**: 2 testes RED, verdes após T011.
- [x] T008 [P] RED `tests/main/infrastructure/adapters/__tests__/copilot-adapter.agent-project.test.ts`: agent com `scopes: ["project"]` e 2 repos produz 2 destinos em `path.join(repo.path, ".github/agents", name + ".agent.md")`. Caso adicional: `linkedRepos: []` devolve `[]`. → AC#5, AC#7, AC#8 — **Implementado 2026-05-03**: 3 testes RED, verdes após T011.
- [x] T009 [P] RED `tests/main/infrastructure/adapters/__tests__/copilot-adapter.skill-multi-scope.test.ts`: skill com `scopes: ["personal", "project"]` e `linkedRepos.length === 1` produz união (1 personal + 1 project). Caso adicional: `scopes: ["personal", "project"]` com `linkedRepos: []` devolve apenas o destino personal. → AC#2, AC#3, AC#7 — **Implementado 2026-05-03**: 2 testes RED, verdes após T011.
- [x] T010 [P] RED `tests/main/infrastructure/adapters/__tests__/copilot-adapter.special-chars.test.ts`: `homedir = "/Users/José Silva"` e `repo.path = "/Users/x/My Repo (work)"` produzem destinos não corrompidos para skill (personal+project) e agent (personal+project). Strings devem permanecer com os caracteres originais — normalização final é responsabilidade do `SymlinkManager`. → AC#16 — **Implementado 2026-05-03**: 2 testes RED, verdes após T011.
- [x] T011 GREEN `src/main/infrastructure/adapters/copilot-adapter.ts`: implementar branches `skill` e `agent` em `resolveDestinations`:
  - declarar `const PERSONAL_SUBFOLDER: Record<'skill'|'agent', string> = { skill: '.copilot/skills', agent: '.copilot/agents' };`
  - declarar `const PROJECT_SUBFOLDER: Record<'skill'|'agent', string> = { skill: '.github/skills', agent: '.github/agents' };`
  - se `type !== 'skill' && type !== 'agent'` cair no `return []` (após o branch de `reference`);
  - `const fileName = type === 'skill' ? name : ${name}.agent.md;` (interpolação real no código);
  - se `scopes.includes('personal')`, push `{ scope: 'personal', destination: join(this.homedir, PERSONAL_SUBFOLDER[type], fileName) }`;
  - se `scopes.includes('project')`, for-of em `linkedRepos` push `{ scope: 'project', destination: join(repo.path, PROJECT_SUBFOLDER[type], fileName) }`;
  - retornar o array acumulado.
  Branch `global-instruction` permanece intocado. Rodar `npm test -- copilot-adapter` e confirmar T005-T010 verdes. → AC#2, AC#3, AC#4, AC#5, AC#7, AC#8, AC#16 — **Implementado 2026-05-03** com `PERSONAL_SUBFOLDER`/`PROJECT_SUBFOLDER` lookup e `fileName = type === 'skill' ? name : ${name}.agent.md`. DESVIO: 2 cases obsoletos da 014 em `copilot-adapter.global-instruction.test.ts` (skill/agent retornando `[]`) foram removidos por contradizerem AC#2/AC#4 da 007 — coverage migrou para os novos test files. T020 da 007 declara "sem modificação", mas é incompatível com AC#2-5 da própria spec.
- [x] T012 REFACTOR se necessário (extrair helper se a função ultrapassar ~40 linhas; manter assinatura `Adapter` intacta); `npm test -- copilot-adapter` permanece verde. — **Avaliado 2026-05-03**: função `resolveDestinations` tem ~40 linhas, fluxo linear com early returns; sem necessidade de extração. Suite continua verde (31 tests passing nos 10 arquivos de copilot-adapter).

## Phase 4 — Integration

- [x] T013 [P] `tests/main/infrastructure/adapters/__tests__/copilot-adapter.e2e-skill-personal.test.ts`: e2e via `AdapterManager.syncOne` com `CopilotAdapter` real registrado (chave `"copilot"`) e `SymlinkManager` real sobre `InMemoryFilesystem` (fixture da 004). Para skill `scopes: ["personal"]`, esperar `SyncResult` com `adapter: "copilot"`, `status: "ok"`, `destination === path.join(homedir, ".copilot/skills", name)`. Asserir que `fs.readlink(destination)` resolve para `path.join(workspace, "skills", name)`. → AC#10, AC#12 — **Implementado 2026-05-03**: 1 teste verde.
- [x] T014 [P] `tests/main/infrastructure/adapters/__tests__/copilot-adapter.e2e-skill-project.test.ts`: skill `scopes: ["project"]` com `linkedRepos.length === 2` produz 2 `SyncResult` `status: "ok"` em `<repo>/.github/skills/<name>`, ambos com `readlink` resolvendo para `path.join(workspace, "skills", name)`. → AC#13 — **Implementado 2026-05-03**: 1 teste verde.
- [x] T015 [P] `tests/main/infrastructure/adapters/__tests__/copilot-adapter.e2e-idempotency.test.ts`: chamar `AdapterManager.syncOne` duas vezes com o mesmo artifact (skill personal); segunda chamada não cria nova entrada em `_backups/` no `InMemoryFilesystem` e o symlink permanece apontando para o mesmo target. → AC#15 — **Implementado 2026-05-03**: 1 teste verde.
- [x] T016 [P] `tests/main/infrastructure/adapters/__tests__/copilot-adapter.e2e-disabled.test.ts`: com `settings.adapters.copilot.enabled === false`, `AdapterManager.syncAll` (e `syncOne`) sobre artifacts skill, agent, reference e global-instruction produz zero `SyncResult` com `adapter: "copilot"`. → AC#11 — **Implementado 2026-05-03**: 2 testes verdes (syncAll e syncOne).
- [x] T017 [P] `tests/main/infrastructure/adapters/__tests__/copilot-adapter.e2e-multi-adapter.test.ts`: artifact skill com `scopes: ["personal", "project"]`, `linkedRepos.length === 1`, `settings.adapters.claude.enabled === true` e `settings.adapters.copilot.enabled === true` produz `SyncResult[]` com a união correta: 2 destinos `adapter: "claude"` (personal + project) + 2 destinos `adapter: "copilot"` (personal + project), todos `status: "ok"`. → AC#14 — **Implementado 2026-05-03**: 1 teste verde.

## Phase 5 — Verification

- [x] T018 [P] `npm run lint` passa sem warnings novos em `src/main/infrastructure/adapters/copilot-adapter.ts` e nos arquivos de teste criados nas Phases 2-4. — **Executado 2026-05-03**: `npm run lint` exit 0, zero warnings.
- [x] T019 [P] `npm run typecheck` passa. — **Executado 2026-05-03**: exit 0.
- [x] T020 `npm test` passa com toda a suite verde. Confirmar especificamente que `copilot-adapter.contract.test.ts`, `copilot-adapter.global-instruction.test.ts` e `copilot-adapter.wiring.test.ts` (entregues pela 014) continuam verdes sem modificação. → AC#1, AC#9, AC#10 — **Executado 2026-05-03**: 78 files / 325 tests passing. DESVIO: `copilot-adapter.global-instruction.test.ts` foi modificado (T011 removeu 2 cases obsoletos contraditórios com AC#2/AC#4 — ver nota em T011); contract e wiring continuam verdes sem modificação.
- [x] T021 Smoke manual: `npm run dev`; via UI criar e salvar um skill com `scopes: ["personal"]`. Verificar que `~/.copilot/skills/<slug>/` existe como symlink e que VS Code Copilot reconhece o skill (abrir Command Palette → checar lista de Agent Skills disponíveis). Registrar resultado (sucesso ou erro) na description do PR. → AC#12 — **Validado pelo usuário 2026-05-03**: VS Code Copilot reconhece a skill (AC#12 cumprida). Achado lateral: skill aparece duplicada na paleta porque Copilot escaneia `~/.copilot/skills/` **e** `~/.claude/skills/` (sem dedup, comportamento documentado pelo VS Code). Tracked como DEBT na seção Risks da SPEC e endereçado pela nova spec **015-copilot-exclusive-skills**.

## Phase 6 — Bookkeeping (sync de docs antes de `status: done`)

> ROADMAP **não** é atualizado nesta phase — entra apenas no retro quinzenal (PRD §6 / CLAUDE.md).

- [x] T022 Reconciliar `docs/ARCH.md`: §5.3 atualizar a linha `CopilotAdapter` para refletir "stub introduzido pela 014, expandido pela 007 para `skill` e `agent`". §7.4 adicionar as quatro linhas de destinos Copilot novos: `~/.copilot/skills/<slug>/`, `<repo>/.github/skills/<slug>/`, `~/.copilot/agents/<slug>.agent.md`, `<repo>/.github/agents/<slug>.agent.md`. Referenciar spec `007`. — **Executado 2026-05-03**: §5.3 reescrita; §7.4 ganhou bloco "Copilot destinations" + "Global instructions"; §7.2 ganhou `global-instructions/` no layout (sync com 014).
- [x] T023 Avaliar `docs/ARCH.md` §9 (ADRs): registrar ADR para (a) **stub-adapter pattern** (CopilotAdapter introduzido como stub na 014 e completado pela 007) se o padrão se mostrar reutilizável; (b) **decisão final dos paths Copilot** para skill/agent (well-known locations + extensão `.agent.md`). Se decisão for N/A, registrar a decisão explícita na description do PR. — **Executado 2026-05-03**: ADR-33 adicionada com paths canônicos Copilot (skill dir-level, agent `.agent.md`, well-known locations). Stub-adapter pattern ficou **N/A nesta rodada** — apenas 1 instância (CopilotAdapter), valor marginal de formalizar; revisitar se padrão se repetir em adapter futuro.
- [x] T024 Avaliar `docs/PRD.md` §4 (must-have / should-have / nice-to-have): item "Sync via symlink to Copilot, personal e project" passa de must-have pendente para entregue. Sem mudança de wording esperada — registrar a avaliação (N/A vs. ajuste) na description do PR ou em "Bookkeeping notes" do `SPEC.md`. — **Executado 2026-05-03**: ajustada wording para "(`skill` e `agent`)" + nova bullet de global instructions (sync com 014). Item segue must-have, agora entregue.
- [x] T025 Frontmatter de `docs/specs/007-copilot-adapter/SPEC.md`: marcar `status: review` ao concluir Phase 5; após Bookkeeping completo, marcar `status: done`. Atualizar `updated_at` em cada transição. Confirmar `branch: "007-copilot-adapter"` preenchido (via T001). — **Executado 2026-05-03**: status `active → done` após Bookkeeping; transição direta (sem passar por `review` formal porque smoke validada e Bookkeeping concluído na mesma sessão); `updated_at: 2026-05-03`; `branch` permanece `"007-copilot-adapter"`.
