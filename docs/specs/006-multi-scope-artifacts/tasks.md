# Tasks — 006 Multi-scope artifacts

## Phase 1 — Foundational types

- [x] T001 RED `tests/shared/artifact.types.test.ts` — type assertion that `ArtifactFrontmatter.scopes` is `ArtifactScope[]` and the legacy `scope` field is absent → AC#1
- [x] T002 GREEN `src/shared/artifact.ts` — replace `scope: ArtifactScope` with `scopes: ArtifactScope[]` → AC#1

## Phase 2 — Migration on read

- [x] T003 RED `tests/main/infrastructure/artifact/normalize-frontmatter.test.ts` — helper normalizes legacy `scope: '<x>'` into `scopes: ['<x>']` (path adjusted: helper lives at the artifact layer, not the generic markdown parser) → AC#2
- [x] T004 GREEN `src/main/infrastructure/artifact/normalize-frontmatter.ts` — implement `normalizeArtifactFrontmatter` → AC#2
- [x] T005 RED `tests/main/infrastructure/artifact/fs-artifact-repository.legacy-scope.test.ts` — repository loads a legacy on-disk artifact and returns `scopes: ['<value>']` → AC#2
- [x] T006 GREEN `src/main/infrastructure/artifact/fs-artifact-repository.ts` — wire `normalizeArtifactFrontmatter` in `fromRaw`; re-save persists `scopes:` and drops legacy `scope:` → AC#2

## Phase 3 — Validation

- [x] T007 RED `tests/main/application/services/artifact-service.test.ts` — `save` rejects `scopes: []` with `kind: 'validation'` and `details.invalid: ['scopes']` → AC#3
- [x] T008 GREEN `src/main/application/services/artifact-service.ts` — drop `scope` from `REQUIRED_FIELDS`; reject empty `scopes` array as invalid → AC#3

## Phase 4 — Adapter resolution

- [x] T009 [P] RED `tests/main/infrastructure/adapters/__tests__/claude-adapter.skill-multi-scope.test.ts` — `resolveDestinations` returns union of personal + per-linked-repo destinations when `scopes` includes both → AC#4
- [x] T010 [P] (covered by T013 manager test exercising fake-adapter) → AC#4
- [x] T011 GREEN `src/main/infrastructure/adapters/claude-adapter.ts` — refactor `resolveDestinations` to iterate over `scopes` → AC#4
- [x] T012 GREEN `src/main/application/services/__fixtures__/fake-adapter.ts` — refactor analogously → AC#4
- [x] T013 RED `tests/main/application/services/__tests__/adapter-manager.multi-scope-empty-repos.test.ts` — when `scopes` includes both and `linkedRepos` is empty, emit `details.skipped: 'no-linked-repos'` for project AND still sync personal → AC#5
- [x] T014 GREEN `src/main/application/services/adapter-manager.ts` — update both `syncOne` and `syncAll` skip checks → AC#5

## Phase 5 — Templates

- [x] T015 [P] `src/main/templates/skill.md` — `scope: personal` → `scopes: [personal]` → AC#6
- [x] T016 [P] `src/main/templates/agent.md` — same → AC#6
- [x] T017 [P] `src/main/templates/reference.md` — same → AC#6
- [x] T018 `tests/main/infrastructure/template/built-in-template-repository.test.ts` — built-in templates expose `scopes: ['personal']` → AC#6

## Phase 6 — UI

- [x] T019 RED `tests/renderer/screens/artifacts/artifact-editor.test.tsx` — editor renders two checkboxes labelled `personal` and `project`, prechecked from `frontmatter.scopes` → AC#7
- [x] T020 RED — toggling either checkbox updates `frontmatter.scopes` (add/remove) → AC#7
- [x] T021 RED — unchecking the last selected scope leaves `scopes` empty (validation surfaces from service) → AC#3, AC#7
- [x] T022 GREEN `src/renderer/screens/artifacts/ArtifactEditor.tsx` — replace the `<select>` with two `<input type="checkbox">` controls → AC#7

## Phase 7 — Migration sweep across tests

- [x] T023 — update fixtures and assertions in `tests/main/...` (registry, ipc, services, fixtures) from `scope: '<x>'` to `scopes: ['<x>']`; also `src/renderer/screens/artifacts/ArtifactList.tsx` `artifactFromTemplate` (legacy `scope` field still referenced) → AC#8
- [x] T024 — update fixtures and assertions in `tests/renderer/...` analogously → AC#8

## Phase 8 — Verification

- [x] T025 — `pnpm test` passes (56 files / 234 tests) → AC#8
- [x] T026 — `pnpm typecheck` and `pnpm lint` clean → AC#8
- [ ] T027 — manual smoke in Electron: create artifact with `scopes: ['personal','project']`, verify symlinks land in `~/.claude/...` and in every linked repo `.claude/...` → AC#4, AC#5

## Phase 9 — Bookkeeping (Phase 1-8)

- [x] T028 — flip spec frontmatter `status: review` after Phase 8; bump `updated_at`
- [ ] T029 — ROADMAP — deferido ao próximo retro (spec 006 está agrupada na linha "Later" com 005; estrutura Now/Next/Later só muda em retro per CLAUDE.md)
- [x] T030 — ARCH §9 ADR-30 (frontmatter contract change: single `scope` → `scopes` array, legacy auto-migration on read); ADR-29 atualizado para refletir comparação `scopes.includes('project')`

## Phase 10 — Drop `AdapterSettings.defaultScope`

- [x] T031 RED `tests/shared/settings.test.ts` — `getDefaults().adapters.claude` e `.copilot` retornam apenas `{ enabled }` (sem `defaultScope`) → AC#9
- [x] T032 GREEN `src/shared/settings.ts` — remover `defaultScope` de `AdapterSettings` e de `getDefaults()`; remover `AdapterScope` se sem consumidores → AC#9
- [x] T033 RED `tests/main/application/services/settings-service.legacy-default-scope.test.ts` — `load()` descarta `defaultScope` de settings persistidos legados → AC#9
- [x] T034 GREEN `src/main/application/services/settings-service.ts` — strip silencioso da chave legada em `load()` (e em `merge()` se necessário) → AC#9
- [x] T035 RED `tests/renderer/screens/settings.test.tsx` — tela não renderiza `<select aria-label="… default scope">`; nenhum `settings.merge` com `defaultScope` é disparado → AC#9
- [x] T036 GREEN `src/renderer/screens/Settings.tsx` — remover `<select>`, `handleScopeChange`, import de `AdapterScope` → AC#9
- [x] T037 GREEN `src/main/index.ts` — remover `defaultScope` do fallback inline de settings → AC#9
- [x] T038 — sweep: remover `defaultScope` de fixtures em `tests/renderer/...`, `tests/main/ipc/registry.test.ts`, `tests/main/application/services/...`, `tests/main/infrastructure/adapters/...`, `tests/shared/settings.test.ts` → AC#9

## Phase 11 — Verification & Bookkeeping (Phase 10)

- [x] T039 — `pnpm test`, `pnpm typecheck`, `pnpm lint` clean → AC#8, AC#9
- [x] T040 — ARCH §9 ADR-31 (remoção de `defaultScope`: motivo = redundante com `Artifact.frontmatter.scopes`; estratégia = strip on load); atualizar exemplo JSON em ARCH onde `defaultScope` aparece → AC#9
- [x] T041 — flip spec frontmatter `status: review` após Phase 11; bump `updated_at`
