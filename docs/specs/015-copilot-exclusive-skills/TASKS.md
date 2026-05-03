# 015 — Copilot exclusive skills — tasks

> Convenção: `[Tnnn] [P?] descrição → AC#N`
> `[P]` = pode rodar em paralelo com tasks vizinhas marcadas `[P]` (arquivos distintos, sem dependência).
> Spec em `draft` — bloqueada por 3 `[NEEDS CLARIFICATION]` (ver `SPEC.md` Bookkeeping notes). Resolver antes de Phase 1.

## Mapa de cobertura

| AC | Tasks |
|----|-------|
| AC#1 | TBD |
| AC#2 | TBD |
| AC#3 | TBD |
| AC#4 | TBD |
| AC#5 | TBD |
| AC#6 | TBD |
| AC#7 | TBD |

## Phase 0 — Resolver `[NEEDS CLARIFICATION]` (pré-Phase 1)

- [ ] T001 Smoke manual: criar 1 agent com `scopes: ["personal"]`, Claude habilitado, **Copilot desabilitado**, salvar; abrir VS Code Copilot e verificar se o `.md` em `~/.claude/agents/<slug>.md` aparece como Custom Agent na paleta. Documentar resultado em `SPEC.md` "Bookkeeping notes". → resolve clarif #1 (cobertura agent).
- [ ] T002 Decidir wiring de leitura de `claude.enabled` no `CopilotAdapter`: (a) injetar `settingsService` no construtor, ou (b) estender port `Adapter` para passar settings/peer state em `resolveDestinations`. Registrar decisão em `SPEC.md` "Considered alternatives" (substituir o `[NEEDS CLARIFICATION]`). Se (b), abrir ADR cruzado em `ARCH §9`. → resolve clarif #2.
- [ ] T003 Decidir comportamento de cleanup ao OFF→ON da flag: (a) `AdapterManager.removeAll` filtrável por type, (b) aceitar débito UX (usuário re-salva). Documentar em `SPEC.md` Risks. → resolve clarif #3.
- [ ] T004 Atualizar frontmatter de `SPEC.md`: `status: draft → active` quando T001-T003 fechados; `updated_at`; criar branch `015-copilot-exclusive-skills`.

## Phase 1 — Settings model

- [ ] T005 RED+GREEN: estender `Settings.adapters.copilot` com `exclusiveSkillsWithClaude: boolean` (default `false`); migrar leitura no `SettingsService` para retornar default quando ausente. Cobrir com test de retrocompat (settings antigas carregam OK). → AC#1

## Phase 2 — Adapter behavior

- [ ] T006 RED `tests/main/infrastructure/adapters/__tests__/copilot-adapter.exclusive-skills.test.ts`: flag `true` + claude.enabled `true` + skill personal → `[]`; flag `true` + claude `true` + skill project → `[]`; flag `true` + claude `false` → comportamento 007 (AC#2/AC#3). → AC#2, AC#3
- [ ] T007 GREEN: aplicar wiring decidido em T002; `CopilotAdapter.resolveDestinations` consulta flag e claude.enabled; retorna `[]` quando ambos ativos para `type === "skill"`. → AC#2, AC#3
- [ ] T008 RED+GREEN: regressão `global-instruction` e `reference` permanecem inalterados em qualquer combinação. → AC#4

## Phase 3 — UI

- [ ] T009 Adicionar checkbox em Settings sob seção Copilot: "Skip Copilot skills when Claude is enabled (avoids duplicates in VS Code Copilot)". Persiste valor; on-change dispara `AdapterManager.syncAll`. Renderer test cobre toggle. → AC#5

## Phase 4 — Integration

- [ ] T010 e2e: salvar skill personal, toggle flag ON → symlink `~/.copilot/skills/<slug>` removido (cleanup conforme T003); toggle OFF → symlink recriado. `~/.claude/skills/<slug>` intocado. → AC#6

## Phase 5 — Verification

- [ ] T011 [P] `npm run typecheck` passa.
- [ ] T012 [P] `npm run lint` passa.
- [ ] T013 [P] `npm test` full suite verde; testes da 007 (`copilot-adapter.*`) continuam verdes sem modificação.
- [ ] T014 Smoke manual VS Code Copilot: skill aparece **uma vez** com flag ON, **duas vezes** com flag OFF (regressão controlada). Documentar. → AC#7

## Phase 6 — Bookkeeping

- [ ] T015 Atualizar PRD §4 (should-have entregue), ARCH §5.3 (nota sobre cross-adapter coupling), ROADMAP linha `015-copilot-exclusive-skills` Status `—` → `review`.
- [ ] T016 Avaliar promoção a ADR formal em ARCH §9 sobre **cross-adapter coupling pattern** se a decisão de wiring (T002) introduzir precedente reutilizável.
