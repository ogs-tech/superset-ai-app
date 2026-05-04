---
id: "011"
title: Search service (in-memory text search)
status: review
priority: later
created_at: 2026-05-03
updated_at: 2026-05-03
depends_on: []
labels: [should-have, core, ui]
related_prd: "§4"
related_arch: "§5.3"
branch: "011-search-service"
---

# 011 — Search service (in-memory text search)

## What

Implementa o serviço `SearchService` (ARCH §5.3): busca textual em memória sobre os artifacts do workspace, sem índice persistente (ADR-10). Expõe um IPC method que recebe uma query e devolve os artifacts cujos `name` e `content` contêm a query. Cada chamada re-lê os artifacts via `ArtifactRepository.list()` (ou cache invalidável — ver clarification). UI ganha um campo de busca que, ao digitar, dispara a query (debounce no Renderer) e re-renderiza a listagem com os resultados.

## Why

PRD §4 lista "Text search" como should-have. ARCH §5.3 fixa o serviço como `SearchService` (in-memory, no persistent index). ADR-10 confirma: spike tem N baixo de artifacts, scan in-memory suficiente. Sem 011, descobrir um artifact específico exige scroll na listagem por type — fricção real quando o workspace passa de ~20 artifacts.

A 011 só inicia depois das must-haves validadas em ≥1 semana de uso real (PRD §4 — should-have rule). Se a implementação ultrapassar 3 dias, o trabalho é cortado e vira débito pós-spike.

## Non-goals

- **Não criar índice persistente** (ADR-10 fixa). Sem SQLite FTS, LevelDB, Lunr.
- **Não fazer fuzzy matching** (Levenshtein, soundex). Substring case-insensitive é suficiente para o spike — confirmar via clarification.
- **Não rankear resultados** por relevância sofisticada. Ordem natural (tipo + nome) ou ordem de match — a fixar.
- **Não buscar em arquivos fora do workspace** (artifacts gerados fora do app, ex.: `<workspace>/_generated/copilot-instructions.md` agregado pela 008 — esse arquivo é derivado, não fonte).
- **Não suportar operadores booleanos** (AND/OR/NOT, parens, quoted phrases). Query é uma string única; tokenização básica.
- **Não suportar regex** na query — risco de DoS via patterns catastróficos.
- **Não substituir a listagem por type da 003** — a busca **filtra** a listagem existente, não cria nova UI paralela.
- **Não buscar em settings, templates, ou artifacts legacy não normalizados** — escopo é só artifacts atuais.

## In scope

- Novo serviço `src/main/application/services/search-service.ts` (ou caminho equivalente conforme ADR-13) com a port:
  - `search(query: string, options?: SearchOptions): Promise<SearchResult[]>`
  - `SearchOptions = { types?: ArtifactType[], scopes?: ArtifactScope[], limit?: number }`
  - `SearchResult = { artifact: Artifact, matchedFields: Array<"name" | "content"> }` (mínimo; mais campos via clarification).
- Algoritmo:
  1. Normaliza a query: `query.trim().toLowerCase()`.
  2. Se query é string vazia ou só espaços, devolve `[]` (curto-circuito; UI mostra listagem normal).
  3. Lista artifacts via `ArtifactRepository.list()` (sem cache no path canônico; ver clarification).
  4. Para cada artifact, filtra por `options.types`/`options.scopes` se fornecidos.
  5. Para cada artifact restante, lê body via `ArtifactRepository.getContent(id)` (ou já vem em `list()` — depende de 003).
  6. Match: `name.toLowerCase().includes(query)` || `content.toLowerCase().includes(query)`. Acumula `matchedFields`.
  7. Devolve resultados ordenados por **"name-matches first, then content-matches"** com desempate por `name` via `Intl.Collator('en')` (paridade com 008). Implementação: dois passes — primeiro inclui artifacts com `matchedFields.includes("name")`, depois os com `matchedFields === ["content"]` (sem match em name); cada bucket ordenado pelo collator.
  8. Aplica `options.limit` se fornecido; default **50** (cobre dogfooding com folga; evita render de centenas que travariam UI; UI oferece "show more" via `truncated: true`).
- Match strategy: **substring case-insensitive** (decisão default proposta; cobre 90% dos casos no spike). Implementação: `normalize(field).includes(normalize(query))` onde `normalize` faz `.toLowerCase()` + NFD strip de diacríticos (ver "Diacríticos" abaixo). Token-based e fuzzy ficam como pós-spike se aparecer demanda.
- Campos buscados: **`name + description + content`**. ARCH §5.3 fixa "name + content" como mínimo; adicionar `description` é trivial (já em frontmatter normalizado, sem I/O extra) e cobre o caso comum de busca por palavra-chave da descrição. `tags` e `slug` são busca estruturada (filtro), não free-text — ficam fora.
- Cache: **sem cache** (re-scan a cada query — ADR-10 strict). SSD macOS local + N baixo (PRD §4 should-have, < 100 artifacts) garantem perf OK. Cache + invalidation adiciona complexidade (event bus interno) sem ganho mensurável; se benchmark da AC#17 falhar, vira spec separada.
- Diacríticos: **NFD normalize + strip diacríticos** em ambos query e fields (`String.normalize('NFD').replace(/[̀-ͯ]/g, '')`). Reduz fricção pt-BR ("revisao" casa "revisão"); custo é negligível por field por query.
- IPC method: **`artifact.search`** (paridade com `artifact.list/get/save/delete`; mantém namespace coeso).
  - Params: `{ query: string, options?: SearchOptions }`.
  - Result: `{ results: SearchResult[], total: number, truncated: boolean }`.
- UI:
  - Campo de busca na **topbar global** (sempre visível, descoberta consistente; pattern padrão de Cmd+K → topbar) com placeholder `"Search artifacts..."`.
  - Debounce no Renderer de **250ms** antes de disparar IPC (sweet-spot entre 200ms — possíveis disparos prematuros em digitação rápida — e 300ms — perceptível em queries curtas).
  - Resultados re-renderizam a lista existente; conta de resultados visível (`"3 results"`).
  - Limpar query (Esc ou botão X) restaura listagem normal.
  - Filtros (type, scope) reaproveitam os já existentes na 003.
- Testes:
  - Unit: query vazia → `[]`.
  - Unit: query que casa em `name` mas não `content` → `matchedFields: ["name"]`.
  - Unit: query que casa em `content` mas não `name` → `matchedFields: ["content"]`.
  - Unit: query que casa em ambos → `matchedFields: ["name", "content"]`.
  - Unit: query com case mismatch (`"REVIEW"` vs `"review"`) → casa.
  - Unit: query com acento (`"crítica"` casa `"critica"` e vice-versa via NFD + strip diacríticos).
  - Unit: filtro por `types: ["skill"]` exclui references/agents.
  - Unit: filtro por `scopes: ["personal"]` exclui artifacts só `["project"]`.
  - Unit: `limit: 5` trunca resultados; `truncated: true`.
  - Unit: ordenação de resultados conforme clarification.
  - Integração: e2e via IPC dispatcher → query "review" sobre 10 artifacts pré-populados devolve N resultados esperados.
  - Integração: cache (se escolhido) é invalidado após `artifact.save` (verificar nova query inclui o salvo).
  - UI: digitar query no campo de busca dispara IPC após debounce; lista re-renderiza com resultados; contador "X results" aparece.

## Out of scope (deferred to later specs)

- Índice persistente (ADR-10 fixa). Revisitar pós-spike só se volume crescer absurdamente.
- Fuzzy matching, regex, operadores booleanos, quoted phrases.
- Highlight de matches no preview (UI debt; revisitar pós-spike).
- Busca em frontmatter (campos individuais como `tags`, `description`) — ver clarification; parte pode entrar.
- Busca em arquivos gerados (`_generated/copilot-instructions.md` da 008) — agregação não é fonte.
- Search history / saved queries — não pedido pelo PRD.
- Atalho de teclado global (Cmd+K) — UI debt; revisitar pós-spike.

## Considered alternatives

| Decisão | Escolhida | Alternativas descartadas | Motivo |
|---|---|---|---|
| Persistência do índice | **Sem índice persistente** (re-scan a cada query, possivelmente com cache em memória) | (b) SQLite FTS5; (c) LevelDB; (d) Lunr.js | ADR-10 já fixa: "spike, low N of artifacts, in-memory scan suffices". Lib externa adiciona dependency sem ganho mensurável em < 100 artifacts. Re-leitura em FS local macOS é I/O cache-quente (negligível). |
| Match strategy | **Substring case-insensitive (com NFD strip)** | (b) Token-based (split whitespace, AND); (c) Fuzzy (Levenshtein) | Cobre 90% no spike (declarado em "Considered alternatives"); fuzzy adiciona dependency sem demanda; token-based é meio-termo subótimo para queries curtas. |
| Campos buscados | **`name + description + content`** | (b) `name + content` (mínimo ARCH §5.3); (c) todos os fields incluindo `tags`/`slug` | `description` é trivial de adicionar (já no frontmatter, sem I/O extra) e cobre busca por keyword da descrição. `tags`/`slug` são busca estruturada (filtro) — fora do escopo free-text. |
| Cache em memória | **Sem cache** (re-scan a cada query) | (b) Invalidate-on-write via event bus; (c) TTL ~5s sem invalidation | ADR-10 strict; SSD macOS + N baixo garantem perf OK. Cache + invalidation adiciona event bus interno sem ganho mensurável no spike; vira spec separada se benchmark da AC#17 falhar. |
| Debounce na UI | **250ms** | (b) 200ms; (c) 300ms | Sweet-spot: 200ms pode disparar prematuro em digitação rápida; 300ms é perceptível em queries curtas. 250ms é o padrão React-search comum. |
| Posição do campo de busca | **Topbar global** (sempre visível) | (b) Sidebar global; (c) Per-type na header da lista | Descoberta consistente; pattern padrão Cmd+K → topbar; sidebar encolhe área de listagem; per-type obriga abrir cada type. |
| Diacríticos | **NFD normalize + strip diacríticos** | (b) Comparação literal | Fricção pt-BR é real ("revisao" não casaria "revisão" sem normalize); custo é trivial (`String.normalize('NFD').replace(...)` por field por query). |
| Ordenação | **Name-matches first, content-matches after; collator `Intl.Collator('en')` desempata** | (b) Type alfabético + name; (c) Count de ocorrências; (d) `updatedAt` desc | Match em name é mais forte que em corpo (relevância intuitiva); collator garante determinismo cross-machine (paridade com 008). Type-name é arbitrário; count exige contagem mais cara; `updatedAt` é não-relevante para busca textual. |
| Limit default | **50** | (b) Sem limit; (c) 100 | Cobre dogfooding (< 50 references esperadas); evita render de centenas que travariam UI; "show more" via `truncated: true` é UI debt fácil. |
| IPC method | **`artifact.search`** | (b) `search.query`; (c) `search.artifacts` | Paridade com `artifact.list/get/save/delete` (mesmo domínio); `search.query` cria namespace só para um method; `search.artifacts` é redundante. |
| Forma do retorno | **`{ results, total, truncated }`** | (b) Só `results: Artifact[]` (sem metadata); (c) Stream de resultados via async iterator | UI precisa saber `total` para mostrar contador e `truncated` para botão "Mostrar mais". Stream é overkill para N baixo. |
| Tratamento de query vazia | **Devolve `[]`** (curto-circuito); UI mostra listagem normal | (b) Devolve todos os artifacts (igual a `list()`); (c) Throw `{ kind: "validation" }` | (b) duplica `list()` — confunde semantica. (c) hostil para UX (digitação parcial). Curto-circuito preserva listagem normal sem latência extra. |
| Regex / operadores booleanos | **Não suportar** | (b) Suportar com lib (ex.: `lunr`, `flexsearch`) | DoS via patterns catastróficos é risco real; spike não tem caso de uso para queries complexas. Substring resolve 90% dos casos. |

## Acceptance criteria

1. Existe `src/main/application/services/search-service.ts` (ou caminho equivalente seguindo ADR-13) exportando `SearchService` com método `search(query, options?): Promise<SearchResult[]>`. Verificável por unit test.
2. `SearchResult` tem shape `{ artifact: Artifact, matchedFields: Array<"name" | "content"> }`. Verificável por type assertion + shape check.
3. Query vazia ou só whitespace devolve `[]` sem chamar `ArtifactRepository.list()`. Verificável por spy/mock.
4. Query que casa em `name` (case-insensitive) inclui o artifact em `results` com `matchedFields.includes("name") === true`.
5. Query que casa em `content` (case-insensitive) inclui o artifact em `results` com `matchedFields.includes("content") === true`.
6. Query que casa em ambos os fields produz `matchedFields === ["name", "content"]` (ordem fixa).
7. `options.types: ["skill"]` exclui artifacts cujo `type !== "skill"` do resultado. Verificável por unit test parametrizado.
8. `options.scopes: ["personal"]` exclui artifacts cujo `scopes` não inclui `"personal"`. Idem.
9. `options.limit: N` trunca os resultados em N items; o método retorna metadata `truncated: true` quando `total > N` (em result via `{ results, total, truncated }`).
10. Ordenação: resultados com `matchedFields.includes("name")` aparecem **antes** dos com `matchedFields === ["content"]`; dentro de cada bucket, ordenação alfabética por `name` via `Intl.Collator('en')`. Verificável por unit test com 4 artifacts (2 com match em name, 2 só em content) checando a ordem do array devolvido.
11. Match com diacríticos: query `"revisao"` casa artifact com `name`/`description`/`content` contendo `"revisão"` (e vice-versa). Implementação via `String.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()` aplicada em ambos os lados antes do `includes`. Verificável por unit test parametrizado.
12. IPC method `artifact.search` é registrado no dispatcher; params `{ query: string, options?: SearchOptions }`; result tem shape `{ results: SearchResult[], total: number, truncated: boolean }`.
13. UI: existe campo de busca na **topbar global** com placeholder `"Search artifacts..."`. Digitar dispara IPC após debounce de **250ms**. Verificável por teste de UI (input + advance timers + checa contagem de IPC calls).
14. UI: resultados aparecem na listagem existente; contador `"<N> results"` é visível.
15. UI: limpar query (botão X ou Esc) devolve a listagem normal sem chamar IPC.
16. Cache: **sem cache em memória** — `SearchService.search` chama `ArtifactRepository.list()` a cada invocação (ADR-10 strict). Verificável por spy/mock no `ArtifactRepository.list`: 3 queries consecutivas → 3 chamadas a `list`.
17. Performance: query sobre 100 artifacts pré-populados (200-500 LOC body cada) completa em **<100ms** no IPC roundtrip (read + scan + serialize + IPC overhead). Verificável por benchmark integração com `performance.now()` no Renderer e `assert(elapsed < 100)`.

## Risks & assumptions

- **ASSUMPTION:** `ArtifactRepository.list()` (003) devolve artifacts com `content` (body Markdown) já carregado, ou expõe `getContent(id)` separado para lazy load. Validar antes de Phase 1; se for lazy, considerar batch read para evitar N+1 syscalls.
- **ASSUMPTION:** Volume real do dogfooding fica < 100 artifacts × ~500 LOC cada; scan in-memory é viável. Se passar de 1k artifacts, latência pode ficar perceptível — débito de cache.
- **ASSUMPTION:** Body Markdown de artifacts é UTF-8 encoded (Node default `fs.readFile(path, 'utf8')`). Não há binários no caminho.
- **RISCO baixo:** Re-scan a cada query soma I/O — em SSD macOS local com cache quente é negligível, mas se aparecer fricção (medir via clarification AC#17), cache em memória resolve.
- **RISCO baixo:** Diacríticos podem dar falsos negativos ("revisão" não casa "revisao") — clarification resolve via NFD normalize ou literal.
- **RISCO baixo:** Query muito curta (1-2 chars) pode produzir centenas de matches → travar UI. **Mitigação:** debounce + `limit` default + counter UI ("loading...") cobrem.
- **DEBT consciente:** Sem highlight de matches no preview/listagem. Revisitar pós-spike.
- **DEBT consciente:** Sem search analytics (queries mais comuns, no-result rate). Aceito; spike é dogfooding solo.
- **DEBT consciente:** Sem atalho de teclado (Cmd+K) — friction marginal.

## References

- [PRD.md §4](../../PRD.md) — should-have "Text search".
- [ARCH.md §5.3](../../ARCH.md) — `SearchService` na tabela de Main services; "In-memory text search (name + content)".
- [ARCH.md §9 ADR-10](../../ARCH.md) — "No persistent search index"; PRD é spike, low N, in-memory scan suffices.
- [ARCH.md §9 ADR-14](../../ARCH.md) — Single `call(method, params)` IPC contract.
- [Spec 003](../003-artifact-crud/spec.md) — `ArtifactService` / `ArtifactRepository`; listagem por type que a 011 estende com filtro.
- [Spec 006](../006-multi-scope-artifacts/spec.md) — `Artifact.frontmatter.scopes` (filtro `options.scopes` baseia-se nisso).
- ROADMAP — `011-search-service` em "Later → Should-have".
