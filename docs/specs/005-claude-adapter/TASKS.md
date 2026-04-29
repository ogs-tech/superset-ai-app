# 005 — Claude adapter — tasks

> Convenção: `[Tnnn] [P?] descrição → AC#N`
> `[P]` = pode rodar em paralelo com tasks vizinhas marcadas `[P]` (arquivos distintos, sem dependência).
> Convenção de paths: hexagonal leve (ADR-13). Adapter de produção em `src/main/infrastructure/adapters/`; ports em `src/main/application/ports/`.

## Mapa de cobertura

| AC | Tasks |
|----|-------|
| AC#1 | T003, T004 |
| AC#2 | T005, T006 |
| AC#3 | T007, T008 |
| AC#4 | T009, T010 |
| AC#5 | T011, T012 |
| AC#6 | T013, T014 |
| AC#7 | T015 |
| AC#8 | T016 |
| AC#9 | T019, T020 |
| AC#10 | T021 |
| AC#11 | T022 |
| AC#12 | T023 |
| AC#13 | T024 |
| AC#14 | T017, T018 |

## Phase 1 — Setup

- [x] T001 Confirmar que a port `Adapter` existe em `src/main/application/ports/adapter.ts` com `adapterId` e `resolveDestinations({ artifact, linkedRepos })` (entregue na 004 — não modificar). → AC#1
- [x] T002 Confirmar que `src/main/application/services/adapter-manager.ts` lê `settings.adapters[adapter.adapterId].enabled` para gating (entregue na 004 — não modificar). → AC#10

## Phase 2 — Adapter — resolução de destinos (TDD por (type, scope))

- [x] T003 RED: criar `src/main/infrastructure/adapters/__tests__/claude-adapter.contract.test.ts` reaproveitando o contract test da port `Adapter` (T005/T006 da 004) contra uma instância de `ClaudeAdapter`. → AC#1
- [x] T004 GREEN: criar `src/main/infrastructure/adapters/claude-adapter.ts` com classe `ClaudeAdapter` exportando `adapterId = "claude"` e stub de `resolveDestinations` retornando `[]`; construtor recebe `{ homedir: string }` e valida não-nulo (lança `DomainError({ kind: "internal", details: { reason: "missing-homedir" } })`). → AC#1
- [x] T005 [P] RED: criar `src/main/infrastructure/adapters/__tests__/claude-adapter.skill-personal.test.ts` — `resolveDestinations({ artifact: { type: "skill", slug: "review", scope: "personal" }, linkedRepos: [] })` devolve exatamente um destino `{ scope: "personal", destination: "<homedir>/.claude/skills/review" }`. → AC#2
- [x] T006 GREEN: implementar branch `skill + personal` em `claude-adapter.ts` usando `path.join(this.homedir, ".claude/skills", artifact.slug)`. → AC#2
- [x] T007 [P] RED: criar `claude-adapter.skill-project.test.ts` — com 2 `linkedRepos` (`/r1`, `/r2`), retorna 2 destinos `<repo.path>/.claude/skills/<slug>`. → AC#3
- [x] T008 GREEN: implementar branch `skill + project` mapeando `linkedRepos.map(repo => path.join(repo.path, ".claude/skills", artifact.slug))`. → AC#3
- [x] T009 [P] RED: criar `claude-adapter.agent-personal.test.ts` — agent personal devolve `<homedir>/.claude/agents/<slug>.md`. → AC#4
- [x] T010 GREEN: implementar branch `agent + personal` usando `path.join(this.homedir, ".claude/agents", \`${artifact.slug}.md\`)`. → AC#4
- [x] T011 [P] RED: criar `claude-adapter.agent-project.test.ts` — agent project com 2 repos devolve 2 destinos `<repo.path>/.claude/agents/<slug>.md`. → AC#5
- [x] T012 GREEN: implementar branch `agent + project`. → AC#5
- [x] T013 [P] RED: criar `claude-adapter.reference-noop.test.ts` — `type: "reference"` em qualquer scope/`linkedRepos` devolve `[]`. → AC#6
- [x] T014 GREEN: implementar early-return `[]` para `type === "reference"` antes do switch de scope. → AC#6
- [x] T015 [P] RED+GREEN: caso `scope: "project"` com `linkedRepos: []` em `claude-adapter.skill-project.test.ts` (e equivalente para agent) — adapter devolve `[]`. Não emitir nenhum SyncResult; o ADR-29 fica responsabilidade do `AdapterManager` (já testado na 004). → AC#7
- [x] T016 [P] RED+GREEN: caso em qualquer test file acima — todos os `destination` retornados passam em `path.isAbsolute(d.destination) === true`. Adicionar asserção. → AC#8
- [x] T017 [P] RED: criar `claude-adapter.special-chars.test.ts` — instanciar `ClaudeAdapter({ homedir: "/Users/José Silva" })` e testar com `linkedRepos: [{ path: "/Users/x/My Repo (work)" }]`. Asserir destinos absolutos sem corrupção de string. → AC#14
- [x] T018 GREEN: garantir que a implementação atual passa (delegação ao `path.join` deve resolver). Se quebrar, ajustar. → AC#14

## Phase 3 — Wiring em produção

- [x] T019 RED: criar `src/main/infrastructure/adapters/__tests__/claude-adapter.wiring.test.ts` (ou ampliar test integração existente) — boot do app com `settings.adapters.claude.enabled === true` resulta em `AdapterManager.syncAll({ artifact: skill personal })` produzindo um `SyncResult` com `adapter: "claude"` e `status: "ok"`. Usar `InMemoryFilesystem` da 004. → AC#9
- [x] T020 GREEN: editar `src/main/index.ts` linha do `new AdapterManager({ adapters: new Map() ... })` (atualmente em [src/main/index.ts:62](../../../src/main/index.ts#L62)) para construir a Map com `["claude", new ClaudeAdapter({ homedir: os.homedir() })]`. Importar `os` se ainda não importado. → AC#9
- [x] T021 RED+GREEN: caso `enabled: false` no mesmo arquivo de teste — `AdapterManager.syncAll` produz zero `SyncResult` com `adapter: "claude"`. Confirma gating já implementado em [src/main/application/services/adapter-manager.ts:97](../../../src/main/application/services/adapter-manager.ts#L97). → AC#10

## Phase 4 — Integração end-to-end

- [x] T022 RED+GREEN: `src/main/infrastructure/adapters/__tests__/claude-adapter.e2e.test.ts` — montar `ArtifactService` + `AdapterManager` + `SymlinkManager` reais sobre `InMemoryFilesystem`, registrar `ClaudeAdapter`. Chamar `artifact.save` para skill personal; verificar que `InMemoryFilesystem` tem symlink em `<homedir>/.claude/skills/<slug>` resolvendo para `<workspace>/skills/<slug>`. → AC#11
- [x] T023 RED+GREEN: no mesmo e2e file — caso agent project com 2 repos linkados; verificar 2 symlinks em `<repo>/.claude/agents/<slug>.md` resolvendo para `<workspace>/agents/<slug>.md`. → AC#12
- [x] T024 RED+GREEN: no mesmo e2e file — re-save sem alterações: contagem de entradas em `_backups/` e mtime dos symlinks inalterados. Reaproveita garantia da 004 (AC#3) com `ClaudeAdapter` no caminho. → AC#13

## Phase 5 — Verification

- [ ] T025 Rodar `pnpm typecheck` (ou comando equivalente do projeto) — zero erros TS. Verificação manual: nenhum cast de `any` em `claude-adapter.ts`.
- [ ] T026 Rodar `pnpm test` (ou equivalente) — todos os testes da 005 passam, suite completa segue verde.
- [ ] T027 Rodar `pnpm lint` — zero warnings em arquivos novos.
- [ ] T028 Smoke manual: iniciar app, habilitar Claude em Settings (defaultScope: personal), criar skill via UI, salvar; inspecionar `~/.claude/skills/<slug>/` e confirmar symlink apontando para `<workspace>/skills/<slug>/`. Documentar resultado nas notas da spec.

## Phase 6 — Bookkeeping

- [ ] T029 Atualizar `docs/specs/005-claude-adapter/SPEC.md` frontmatter: `status: review` ao terminar Phase 5; `updated_at: <hoje>`.
- [ ] T030 Avaliar promoção da decisão "reference não sincroniza para o Claude" a ADR em ARCH §9 (ADR-30 candidato). Se promover: editar ARCH e referenciar de volta em SPEC.md "Considered alternatives".
- [ ] T031 Ao transicionar SPEC para `done` (após T029, T030 e revisão das notas de smoke): atualizar ROADMAP linha `005-claude-adapter` Status de `—` para `review` (defasagem de uma fase, conforme CLAUDE.md). Apenas a coluna Status muda — Now/Next/Later permanecem congelados até o retro.
