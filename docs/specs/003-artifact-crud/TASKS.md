# 003 — Artifact CRUD & templates — tasks

> Convenção: `[Tnnn] [P?] descrição → AC#N`
> `[P]` = pode rodar em paralelo com tasks vizinhas marcadas `[P]` (arquivos distintos, sem dependência).

## Mapa de cobertura

| AC | Tasks |
|----|-------|
| AC#1 | T001 |
| AC#2 | T013, T014 |
| AC#3 | T024, T025 |
| AC#4 | T026, T027 |
| AC#5 | T028, T029 |
| AC#6 | T015, T016 |
| AC#7 | T017, T018 |
| AC#8 | T011, T012 |
| AC#9 | T019, T036 |
| AC#10 | T030, T031, T032 |
| AC#11 | T020, T021, T022, T023 |
| AC#12 | T040, T041, T042 |
| AC#13 | T043, T044, T045 |
| AC#14 | T024, T025 |
| AC#15 | T011, T012 |
| AC#16 | T047, T048, T049, T050 |

## Phase 1 — Setup

- [x] T001 Criar `docs/specs/003-artifact-crud/TASKS.md` (este arquivo) listando todas as tasks executáveis derivadas das ACs do `SPEC.md`. → AC#1
- [x] T002 Adicionar dependência `yaml` (parser de frontmatter) ao `package.json` via `npm install yaml`; commitar `package.json` e `package-lock.json`. Justificar escolha (`yaml` em vez de `js-yaml`) em comentário no PR. Sem dependência, parsing/serialização de frontmatter não roda.
- [x] T003 Adicionar dependência `react-markdown` ao `package.json` via `npm install react-markdown`; commitar `package.json` e `package-lock.json`. Necessária para o preview do editor.
- [x] T004 [P] Criar diretórios vazios (`mkdir -p`) para a estrutura desta spec: `src/main/application/ports`, `src/main/application/services`, `src/main/infrastructure/artifact`, `src/main/infrastructure/template`, `src/main/infrastructure/clock`, `src/main/templates`, `src/renderer/screens/artifacts`, `tests/main/application/services`, `tests/main/infrastructure/artifact`, `tests/main/infrastructure/template`, `tests/renderer/screens/artifacts`. Diretórios já existentes podem ser reaproveitados.

## Phase 2 — Foundational

- [x] T005 [P] Criar `src/shared/artifact.ts` com tipos `ArtifactType = "skill" | "reference" | "agent"`, `ArtifactScope = "personal" | "project"`, `ArtifactFrontmatter` (campos de ARCH §8.4: `slug`, `name`, `type`, `description`, `scope`, `version`, `tags?`, `createdAt`, `updatedAt`, `includeInCopilotInstructions?`), `Artifact = { id: string; frontmatter: ArtifactFrontmatter; body: string }`, e `Template = { id: string; type: ArtifactType; name: string; description: string; frontmatter: Partial<ArtifactFrontmatter>; body: string }`. Tipos consumidos por Main e Renderer.
- [x] T006 [P] Estender `src/shared/ipc-contract.ts` adicionando assinaturas para `artifact.list`, `artifact.get`, `artifact.save`, `artifact.delete`, `template.list`. `artifact.save` retorna `{ artifact: Artifact; syncReport: SyncResult[] }` (com `SyncResult` declarado como `unknown[]` placeholder até spec 004). `artifact.delete` aceita `{ id: string; removeSymlinks: boolean }` e retorna `{ ok: true }`.
- [x] T007 [P] Criar `src/main/domain/artifact-id.ts` com função `parseArtifactId(id: string): { type: ArtifactType; slug: string }` e `formatArtifactId(type, slug)`. Lança erro de domínio se id não casa o shape `<type>/<slug>`.
- [x] T008 [P] Estender `src/main/domain/errors.ts` com fábrica `validationError({ message, details })` que produz envelope `{ kind: "validation", message, details }` conforme ARCH §8.2 (mantendo padrão existente para `not_found`, `io`, `internal`). Se já existir, apenas garantir que `validation` aceita `details: { missing?, invalid?, conflict? }`.
- [x] T009 RED `tests/main/domain/artifact-id.test.ts`: cobre `parseArtifactId("skill/foo")`, `parseArtifactId("reference/bar")`, rejeição para `"foo"` (sem slash) e `"unknown/foo"` (tipo inválido). `npm test -- artifact-id` falha. → AC#7
- [x] T010 GREEN `src/main/domain/artifact-id.ts`: implementar parsing/validação. `npm test -- artifact-id` verde. → AC#7

## Phase 3 — Application

- [x] T011 RED `tests/main/application/services/artifact-service.test.ts`: testes de validação no `save` — falta de campo obrigatório retorna `{ kind: "validation", details: { missing: [...] } }`; `slug` fora do regex `^[a-z0-9][a-z0-9-]*$` retorna `{ kind: "validation", details: { invalid: ["slug"] } }`; `description` > 200 chars retorna `{ kind: "validation", details: { invalid: ["description"] } }`; criação com `<type>/<slug>` já existente retorna `{ kind: "validation", details: { conflict: "<type>/<slug>" } }`. Usa `InMemoryArtifactRepository` e `FixedClock`. `npm test -- artifact-service` falha. → AC#8, AC#15
- [x] T012 GREEN `src/main/application/services/artifact-service.ts`: implementar `save` com validação mínima (presença + slug regex + description ≤ 200 + colisão em criação). `npm test -- artifact-service` verde para os casos da T011. → AC#8, AC#15
- [x] T013 [P] Criar `src/main/application/ports/artifact-repository.ts` com interface `ArtifactRepository` expondo `list({ type? })`, `get({ id })`, `save({ artifact })`, `delete({ id })`, `exists({ id })`. Métodos retornam `Promise`. → AC#2
- [x] T014 [P] Criar `src/main/application/ports/clock-port.ts` com interface `ClockPort { now(): Date }`. → AC#3
- [x] T015 RED `tests/main/application/services/artifact-service.test.ts` (mesmo arquivo, novos casos): `list({ type: "skill" })` retorna apenas skills; `list()` sem filtro retorna todos os tipos. → AC#6
- [x] T016 GREEN `src/main/application/services/artifact-service.ts`: implementar `list({ type? })` delegando ao repository. `npm test -- artifact-service` verde para T015. → AC#6
- [x] T017 RED `tests/main/application/services/artifact-service.test.ts`: `get({ id: "skill/foo" })` retorna artifact; id inexistente rejeita com `{ kind: "not_found" }`. → AC#7
- [x] T018 GREEN `src/main/application/services/artifact-service.ts`: implementar `get` com tradução de ausência para `not_found`. → AC#7
- [x] T019 RED `tests/main/application/services/artifact-service.test.ts`: `save` de artifact válido retorna `{ artifact, syncReport: [] }` (array vazio enquanto 004 não estiver merged); `createdAt`/`updatedAt` são definidos em ISO-8601 UTC pelo `ClockPort` (não pelo Renderer); re-save preserva `createdAt` e atualiza `updatedAt`. → AC#9, AC#14
- [x] T020 [P] Criar `src/main/application/ports/template-repository.ts` com interface `TemplateRepository { list({ type }): Promise<Template[]> }`. → AC#11
- [x] T021 RED `tests/main/application/services/template-service.test.ts`: `list({ type: "skill" })` retorna ≥1 template; idem para `reference` e `agent`. Usa um `InMemoryTemplateRepository` populado com fixtures. `npm test -- template-service` falha. → AC#11
- [x] T022 GREEN `src/main/application/services/template-service.ts`: implementar `list({ type })` delegando ao repository. `npm test -- template-service` verde. → AC#11
- [x] T023 RED `tests/main/application/services/template-service.test.ts`: cada template retornado contém frontmatter com `type` casando o filtro. → AC#11

## Phase 4 — Infrastructure

- [x] T024 RED `tests/main/infrastructure/artifact/fs-artifact-repository.test.ts`: `save` de skill com `slug: foo` cria `<workspace>/skills/foo/SKILL.md` com frontmatter parseado e `createdAt`/`updatedAt` em ISO-8601 UTC; re-save preserva `createdAt` no disco. Usa workspace temporário via `os.tmpdir()` e cleanup no `afterEach`. `npm test -- fs-artifact-repository` falha. → AC#3, AC#14
- [x] T025 GREEN `src/main/infrastructure/artifact/fs-artifact-repository.ts`: implementar `save` para tipo `skill` em `<workspace>/skills/<slug>/SKILL.md` usando `yaml.stringify` para frontmatter + body, escrita atômica via tempfile + `rename` (ADR-15). `npm test -- fs-artifact-repository` verde para T024. → AC#3, AC#14
- [x] T026 RED `tests/main/infrastructure/artifact/fs-artifact-repository.test.ts`: `save` de reference cria `<workspace>/references/bar.md`. → AC#4
- [x] T027 GREEN `src/main/infrastructure/artifact/fs-artifact-repository.ts`: estender `save` para `reference` em `<workspace>/references/<slug>.md`. → AC#4
- [x] T028 RED `tests/main/infrastructure/artifact/fs-artifact-repository.test.ts`: `save` de agent cria `<workspace>/agents/baz.md`. → AC#5
- [x] T029 GREEN `src/main/infrastructure/artifact/fs-artifact-repository.ts`: estender `save` para `agent` em `<workspace>/agents/<slug>.md`. → AC#5
- [x] T030 RED `tests/main/infrastructure/artifact/fs-artifact-repository.test.ts`: `delete({ id: "skill/foo" })` remove `<workspace>/skills/foo/` recursivamente; `delete({ id: "reference/bar" })` remove apenas o arquivo; idem para `agent/baz`; `delete` em id inexistente rejeita com `{ kind: "not_found" }`. → AC#10
- [x] T031 GREEN `src/main/infrastructure/artifact/fs-artifact-repository.ts`: implementar `delete` (recursivo para skill via `fs.rm({ recursive: true })`, file unlink para reference/agent). → AC#10
- [x] T032 RED `tests/main/infrastructure/artifact/fs-artifact-repository.test.ts`: `delete({ id, removeSymlinks: true })` aceita a flag e não executa nenhum filesystem call fora do `<workspace>`. Verificável por: cria sentinela em diretório irmão (`<workspace>/../sentinel.md`) antes do delete, executa delete com `removeSymlinks: true`, confirma que sentinela permanece intacta. → AC#10
- [x] T033 RED `tests/main/infrastructure/artifact/fs-artifact-repository.test.ts`: `list({ type? })` lê do disco e retorna artifacts do tipo solicitado; sem filtro retorna todos os tipos. `get({ id })` lê o arquivo e retorna `{ frontmatter, body }` parseado via `yaml`. → AC#6, AC#7
- [x] T034 GREEN `src/main/infrastructure/artifact/fs-artifact-repository.ts`: implementar `list` (lê `<workspace>/<type>/`) e `get` (lê arquivo correspondente, faz split de frontmatter `---` / body). → AC#6, AC#7
- [x] T035 [P] Criar `src/main/infrastructure/artifact/in-memory-artifact-repository.ts` implementando `ArtifactRepository` em `Map<string, Artifact>`. Usado em testes de service (Phase 3). → AC#2
- [x] T036 [P] Criar `src/main/infrastructure/clock/system-clock.ts` implementando `ClockPort.now()` via `new Date()`; criar `src/main/infrastructure/clock/fixed-clock.ts` (helper de teste) que retorna data injetada.
- [x] T037 [P] Criar arquivos-fonte de templates built-in em `src/main/templates/`: `skill.md`, `reference.md`, `agent.md`. Cada arquivo contém frontmatter inicial com `type` casando o nome (skeleton para "não enfrentar a página em branco"). → AC#11
- [x] T038 RED `tests/main/infrastructure/template/built-in-template-repository.test.ts`: `list({ type: "skill" })` retorna template lido de `src/main/templates/skill.md` com `frontmatter.type === "skill"`; idem para `reference` e `agent`. → AC#11
- [x] T039 GREEN `src/main/infrastructure/template/built-in-template-repository.ts`: implementar leitura dos arquivos em `src/main/templates/` (caminho resolvido via `import.meta.url`/`__dirname` compatível com `electron-vite`). → AC#11

## Phase 5 — IPC

- [x] T040 RED `tests/main/ipc/dispatcher.test.ts`: dispatcher resolve `artifact.list`, `artifact.get`, `artifact.save`, `artifact.delete`, `template.list` para os services correspondentes; rejeições viram envelope `{ kind, message, details }` conforme ARCH §8.2; `artifact.save` retorna `{ artifact, syncReport: [] }`. → AC#9, AC#12
- [x] T041 GREEN `src/main/ipc/dispatcher.ts`: registrar handlers `artifact.list`, `artifact.get`, `artifact.save`, `artifact.delete`, `template.list` no `call(method, params)` central, instanciando `ArtifactService` e `TemplateService` com seus adapters de produção (`FsArtifactRepository`, `BuiltInTemplateRepository`, `SystemClock`). `artifact.save` envelopa o resultado em `{ artifact, syncReport: [] }`. → AC#9, AC#12
- [x] T042 GREEN `src/preload/index.ts`: confirmar que `window.api.call(method, params)` já roteia para o dispatcher (single channel — ADR-14). Sem alteração se a 002 já entregou; documentar no PR a verificação. → AC#12

## Phase 6 — Renderer

- [x] T043 RED `tests/renderer/screens/artifacts/artifact-list.test.tsx`: tela renderiza listagem por tipo (`skills | references | agents`); chamada `window.api.call('artifact.list', { type: 'skill' })` é feita ao montar a aba `skills`; cada item exibe `name` e `slug`. Mock de `window.api.call`. → AC#12
- [x] T044 GREEN `src/renderer/screens/artifacts/ArtifactList.tsx`: implementar listagem com tabs por tipo; chamar `artifact.list` por aba. → AC#12
- [x] T045 RED `tests/renderer/screens/artifacts/new-from-template.test.tsx`: clique em "Novo a partir de template" abre modal listando templates de `template.list({ type })`; seleção navega para tela de edição com formulário populado pelos campos do template. → AC#12
- [x] T046 GREEN `src/renderer/screens/artifacts/NewFromTemplateDialog.tsx` + integração na `ArtifactList`: modal de seleção, navegação para `ArtifactEditor` populada. → AC#12
- [x] T047 RED `tests/renderer/screens/artifacts/artifact-editor.test.tsx`: editor renderiza `<textarea>` para body Markdown e preview via `react-markdown`; clique em "Salvar" dispara `window.api.call('artifact.save', { artifact })`; resposta de sucesso exibe toast; resposta de erro `{ kind: "validation", message, details }` exibe toast com a `message`. → AC#13
- [x] T048 GREEN `src/renderer/screens/artifacts/ArtifactEditor.tsx`: implementar editor com textarea + preview lado a lado; integração com `react-markdown`; toast envelope-shaped (componente simples `Toast` em `src/renderer/components/Toast.tsx` se inexistente). → AC#13
- [x] T049 RED `tests/renderer/screens/artifacts/artifact-delete.test.tsx`: ação de delete pede confirmação (modal/dialog); ao confirmar, dispara `window.api.call('artifact.delete', { id, removeSymlinks: true })` e remove o item da lista. → AC#10
- [x] T050 GREEN `src/renderer/screens/artifacts/ArtifactList.tsx` + componente de confirmação: implementar fluxo de delete com confirmação. → AC#10

## Phase 7 — Verification

- [x] T051 [P] `npm run lint` passa sem warnings novos introduzidos por esta spec.  → AC#16
- [x] T052 [P] `npm run typecheck` passa sem erros.  → AC#16
- [x] T053 `npm test` passa com todos os testes desta spec verdes; cobertura ≥ 80% nos paths `src/main/application/services/artifact-service.ts`, `src/main/application/services/template-service.ts`, `src/main/infrastructure/artifact/fs-artifact-repository.ts`. → AC#16
- [x] T054 Verificação manual com `npm run dev`: criar 1 skill, 1 reference, 1 agent a partir de template; editar e salvar (toast de sucesso); confirmar arquivos em `<workspace>/skills/<slug>/SKILL.md`, `<workspace>/references/<slug>.md`, `<workspace>/agents/<slug>.md` com frontmatter ISO-8601 UTC; deletar 1 skill (diretório some) e 1 reference (arquivo some). Registrar resultado no PR. → AC#3, AC#4, AC#5, AC#10, AC#12, AC#13

## Phase 8 — Bookkeeping (sync de docs antes de `status: done`)

> ROADMAP **não** é atualizado nesta phase — entra apenas no retro quinzenal (PRD §6 / CLAUDE.md).

- [x] T055 Reconciliar `ARCH §9`: garantir ADRs cobrindo as decisões registradas em "Considered alternatives" do `SPEC.md` (identidade `<type>/<slug>`, slug humano com regex, sync stub no save, filesystem direto via `fs/promises`, editor `textarea` + `react-markdown`, write atômico já em ADR-15, templates apenas built-in, delete hard, validação mínima). Criar ADRs faltantes (numeração sequencial após ADR-19) ou atualizar existentes; cada ADR referencia spec `003`.
- [x] T056 Avaliar se `PRD §4` (must-have / should-have / nice-to-have) precisa ajuste após a implementação (ex.: `templates by type` permanece must-have? aparecer item que migre para should/nice?). Registrar a decisão no PR description ou em nota no `SPEC.md`, mesmo se for N/A.
- [x] T057 Frontmatter de `SPEC.md`: marcar `status: active` ao iniciar Phase 1; `status: done` após Verification (Phase 7) verde; atualizar `updated_at` em cada transição; preencher `branch` ao criar a branch de implementação.
