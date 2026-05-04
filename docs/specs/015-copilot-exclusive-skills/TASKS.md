# 015 — Copilot exclusive skills — tasks

> Convenção: `[Tnnn] [P?] descrição → AC#N`
> `[P]` = pode rodar em paralelo com tasks vizinhas marcadas `[P]` (arquivos distintos, sem dependência).

## Mapa de cobertura

| AC | Tasks |
|----|-------|
| AC#1 | T005 |
| AC#2 | T006, T007 |
| AC#3 | T006, T007 |
| AC#4 | T008 |
| AC#5 | T009 |
| AC#6 | T010 |
| AC#7 | T014 (smoke manual — skipped) |

## Phase 0 — Resolver `[NEEDS CLARIFICATION]` (pré-Phase 1)

- [x] T001 Smoke manual (skipped — out of scope nesta rodada)
- [x] T002 Decidir wiring: injetar `settingsService?: SettingsService` no construtor do `CopilotAdapter` (opcional para retrocompat). Port `Adapter` inalterada.
- [x] T003 Decidir cleanup ON-flip: UI chama `adapter.removeAll(copilot)` ANTES de salvar a flag; ao desligar, salva flag e chama `adapter.syncAll(copilot)`.
- [x] T004 `SPEC.md` atualizado (`status: review`, branch, clarificações resolvidas); branch `015-copilot-exclusive-skills` criada.

## Phase 1 — Settings model

- [x] T005 RED+GREEN: `src/shared/settings.ts` — `CopilotAdapterSettings extends AdapterSettings { exclusiveSkillsWithClaude: boolean }`. `getDefaults()` inclui `exclusiveSkillsWithClaude: false`. `SettingsService.stripLegacyFields` faz default para `false` quando ausente (retrocompat). → AC#1

## Phase 2 — Adapter behavior

- [x] T006 RED `tests/main/infrastructure/adapters/__tests__/copilot-adapter.exclusive-skills.test.ts` — flag `true` + claude.enabled `true` + skill personal → `[]`; flag `true` + claude `true` + skill project → `[]`; flag `true` + claude `false` → comportamento 007; flag `false` → comportamento 007; sem settingsService → retrocompat. → AC#2, AC#3
- [x] T007 GREEN: `CopilotAdapterDeps` ganha `settingsService?: SettingsService`; `resolveDestinations` consulta flag quando settingsService injetado; retorna `[]` para `type === "skill"` quando `exclusiveSkillsWithClaude && claude.enabled`. → AC#2, AC#3
- [x] T008 RED+GREEN: regressão — `copilot-adapter.global-instruction.test.ts` e `copilot-adapter.reference-*.test.ts` passam sem modificação. → AC#4

## Phase 3 — UI

- [x] T009 `src/renderer/screens/Settings.tsx` — checkbox "Skip Copilot skills when Claude is enabled (avoids duplicates in VS Code Copilot)" sob seção Copilot; toggle ON: `removeAll(copilot)` → `settings.merge(flag=true)`; toggle OFF: `settings.merge(flag=false)` → `syncAll(copilot)`. Renderer tests em `tests/renderer/screens/settings/copilot-exclusive-skills.test.tsx`. → AC#5

## Phase 4 — Integration

- [x] T010 e2e `tests/main/infrastructure/adapters/__tests__/copilot-adapter.exclusive-skills.e2e.test.ts`: flag=false → ambos symlinks criados; flag=true + claude on → só claude symlink criado; toggle ON → copilot skill removido; toggle OFF → copilot skill recriado. → AC#6

## Phase 5 — Verification

- [x] T011 [P] `npm run typecheck` passa (node + web).
- [x] T012 [P] `npm run lint` passa.
- [x] T013 [P] `npm test` — 148 test files, 449 tests verdes.
- [ ] T014 Smoke manual VS Code Copilot (skipped — fora do escopo desta rodada). → AC#7

## Phase 6 — Bookkeeping

- [x] T015 SPEC.md atualizado (`status: review`); TASKS.md concluído; ARCH.md §5.3 anotado; ROADMAP linha 015 adicionada.
- [x] T016 Decisão de wiring (construtor opcional, sem mudar port `Adapter`) não introduce ADR — padrão já existente; sem ADR formal necessário.
