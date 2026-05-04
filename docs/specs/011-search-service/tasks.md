# 011 — Search service (in-memory text search) — tasks

> Convenção: `[Tnnn] [P?] descrição → AC#N`
> `[P]` = pode rodar em paralelo com tasks vizinhas marcadas `[P]` (arquivos distintos, sem dependência).

## Mapa de cobertura

| AC | Tasks |
|----|-------|
| AC#1 | T003, T005 |
| AC#2 | T006 |
| AC#3 | T007 |
| AC#4 | T009 |
| AC#5 | T010 |
| AC#6 | T011 |
| AC#7 | T013 |
| AC#8 | T014 |
| AC#9 | T015 |
| AC#10 | T016 |
| AC#11 | T012 |
| AC#12 | T018, T019 |
| AC#13 | T021, T022 |
| AC#14 | T023 |
| AC#15 | T024 |
| AC#16 | T017 |
| AC#17 | T026 |

## Phase 1 — Setup
- [x] T001 Atualizar frontmatter de `docs/specs/011-search-service/spec.md`: `status: active`, `updated_at: 2026-05-03`, preencher `branch: "011-search-service"` ao criar a branch de implementação.
- [x] T002 Criar branch git `011-search-service` a partir de `main`.

## Phase 2 — Application — `SearchService`
- [x] T003 Criar `src/main/application/services/search-service.ts` com `class SearchService { async search(query: string, options?: SearchOptions): Promise<SearchOutput> }`. Stub inicial devolve `{ results: [], total: 0, truncated: false }`. Exportar tipos `SearchOptions`, `SearchResult`, `SearchOutput`. → AC#1, AC#2
- [x] T004 [P] Definir helper interno `normalize(s: string): string` em `src/main/application/services/search-service.ts` que faz `.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()`. Não exportado.
- [x] T005 RED `tests/main/application/services/__tests__/search-service.contract.test.ts`: `new SearchService({ artifactRepository }).search("x")` resolve com objeto contendo `results: SearchResult[]`, `total: number`, `truncated: boolean`. → AC#1
- [x] T006 RED `tests/main/application/services/__tests__/search-service.shape.test.ts`: cada `SearchResult` tem `{ artifact, matchedFields }` onde `matchedFields` é subset de `["name","description","content"]` (ordem fixa). → AC#2
- [x] T007 RED `tests/main/application/services/__tests__/search-service.empty-query.test.ts`: query `""` e query `"   "` devolvem `{ results: [], total: 0, truncated: false }` E `ArtifactRepository.list` (spy) **não** é chamado. → AC#3
- [x] T008 GREEN curto-circuito para query vazia/whitespace antes de qualquer I/O. → AC#3
- [x] T009 RED `tests/main/application/services/__tests__/search-service.match-name.test.ts`: artifact com `name: "Code Review"` casa query `"REVIEW"` (case-insensitive); `matchedFields.includes("name") === true`. → AC#4
- [x] T010 RED `tests/main/application/services/__tests__/search-service.match-content.test.ts`: artifact cujo body contém `"review"` (e cujo `name` não casa) é incluído com `matchedFields.includes("content") === true`. → AC#5
- [x] T011 RED `tests/main/application/services/__tests__/search-service.match-both.test.ts`: artifact onde query casa em `name` E `content` produz `matchedFields === ["name","content"]` (ordem fixa). → AC#6
- [x] T012 RED `tests/main/application/services/__tests__/search-service.diacritics.test.ts`: query `"revisao"` casa artifact com `name: "Revisão de código"`; query `"revisão"` casa artifact com `name: "Revisao Express"`. → AC#11
- [x] T013 RED `tests/main/application/services/__tests__/search-service.filter-types.test.ts`: 3 artifacts (1 skill, 1 reference, 1 agent) todos com query no name → `search("x", { types: ["skill"] })` devolve só o skill. → AC#7
- [x] T014 RED `tests/main/application/services/__tests__/search-service.filter-scopes.test.ts`: artifacts com `scopes: ["personal"]`, `["project"]`, `["personal","project"]` → `search("x", { scopes: ["personal"] })` exclui o que tem só `["project"]`. → AC#8
- [x] T015 RED `tests/main/application/services/__tests__/search-service.limit.test.ts`: 10 artifacts casam → `search("x", { limit: 5 })` devolve `{ results: SearchResult[5], total: 10, truncated: true }`; `search("x")` (sem limit) usa default 50. → AC#9
- [x] T016 RED `tests/main/application/services/__tests__/search-service.order.test.ts`: 4 artifacts: 2 com match em `name` (`name: ["Banana","apple"]`), 2 só com match em `content` (`name: ["Cherry","date"]`) → ordem do array devolvido: `["apple","Banana","Cherry","date"]` (name-matches primeiro, depois content-matches; collator `en` desempata dentro de cada bucket). → AC#10
- [x] T017 RED `tests/main/application/services/__tests__/search-service.no-cache.test.ts`: 3 chamadas consecutivas a `search("x")` → `ArtifactRepository.list` (spy) é invocado 3 vezes. → AC#16
- [x] T020 GREEN implementar `search()`: para cada artifact em `list()`, normalizar `name`, `description`, `content` e a query; aplicar `String.includes`; preencher `matchedFields` na ordem `["name","description","content"]` (filtrando por quais casaram); aplicar filtros `types`/`scopes`; ordenar via "name-matches first, content-only after" + `Intl.Collator('en')` para desempate; aplicar `limit` (default 50); devolver `{ results, total, truncated }`. → AC#3-11, AC#16

## Phase 3 — IPC
- [x] T018 RED `tests/main/ipc/__tests__/dispatcher.artifact-search.test.ts`: `dispatcher.call("artifact.search", { query: "review" })` invoca `SearchService.search` (spy) com `("review", undefined)` e devolve `{ results, total, truncated }`. → AC#12
- [x] T019 GREEN registrar handler `artifact.search` em `src/main/ipc/dispatcher.ts` (params `{ query: string, options?: SearchOptions }`; result `{ results, total, truncated }`). → AC#12

## Phase 4 — Renderer
- [x] T021 [P] Criar componente `src/renderer/components/TopbarSearch.tsx` com `<input placeholder="Search artifacts..." />`. Hook interno usa `useDebouncedCallback(query => window.api.call("artifact.search", { query }), 250)`. Estado de resultados é levantado via callback prop `onResults`. → AC#13
- [x] T022 [P] Integrar `<TopbarSearch />` no `src/renderer/layout/AppShell.tsx` (topbar global, sempre visível). → AC#13
- [x] T023 [P] Atualizar `src/renderer/features/artifacts/ArtifactList.tsx` para receber `searchResults?: SearchOutput`; quando presente, renderizar `results` no lugar da listagem normal e exibir `<span>{total} results{truncated ? " (truncated)" : ""}</span>`. → AC#14
- [x] T024 [P] No `<TopbarSearch />`: botão `X` e tecla `Esc` limpam o input → callback `onResults(undefined)` (sem chamar IPC); `ArtifactList` volta à listagem normal. → AC#15
- [x] T025 [P] Teste de UI `tests/renderer/components/__tests__/topbar-search.test.tsx`: digitar `"review"` (typing rápido) + advance timers 250ms → 1 chamada IPC; digitar mais 100ms depois sem completar 250ms → ainda 1 chamada (debounce); resultados re-renderizam lista; pressionar Esc → `onResults(undefined)` chamado, IPC não chamado. → AC#13, AC#14, AC#15

## Phase 5 — Verification
- [x] T026 Benchmark `tests/main/application/services/__tests__/search-service.perf.bench.ts`: pré-popular 100 artifacts (200-500 LOC body cada, conteúdo random); medir `performance.now()` em torno de `await new SearchService(...).search("review")`; assert `elapsed < 100` (ms). Roda como teste vitest normal. → AC#17
- [x] T027 [P] `npm run lint` passa sem warnings novos no diff. → AC#1-17
- [x] T028 [P] `npm run typecheck` passa. → AC#1-17
- [x] T029 `npm test` passa, com cobertura ≥ 90% em `src/main/application/services/search-service.ts`. → AC#1-17
- [x] T030 Smoke manual em `npm run dev`: criar 5 artifacts diversos; digitar query parcial na topbar; confirmar resultados aparecem após ~250ms; contador `"<N> results"` visível; Esc limpa. → AC#13, AC#14, AC#15

## Phase 6 — Bookkeeping (sync de docs antes de `status: done`)

> ROADMAP **não** é atualizado nesta phase — entra apenas no retro quinzenal (PRD §6 / CLAUDE.md).

- [x] T031 Reconciliar `ARCH §9`: avaliar se as decisões fixadas em "Considered alternatives" (substring + NFD strip, sem cache, debounce 250ms, ordenação name-first) merecem promoção a ADR. ADR-10 (no persistent index) já cobre o eixo principal — só atualizar referência se necessário.
- [x] T032 Reconciliar `ARCH §5.3`: confirmar que `SearchService` na tabela de Main services está descrito consistentemente ("In-memory text search (name + description + content)" — atualizar se ainda diz só "name + content").
- [x] T033 Reconciliar `ARCH §8.1`: adicionar `artifact.search` à tabela "Methods" da seção Renderer ↔ Main contract.
- [x] T034 Avaliar se `PRD §4` (should-have "Text search") precisa ajuste após implementação. Registrar a decisão (PR description ou nota no spec) mesmo se for N/A.
- [x] T035 Frontmatter de `spec.md`: marcar `status: review` ao terminar Phase 5 verde; após bookkeeping completo, marcar `status: done`; atualizar `updated_at` em cada transição; preencher `branch: "011-search-service"`.
