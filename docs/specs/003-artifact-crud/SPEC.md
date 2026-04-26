---
id: "003"
title: Artifact CRUD & templates
status: done
priority: next
created_at: 2026-04-26
updated_at: 2026-04-26
depends_on: ["002"]
labels: [must-have, core]
related_prd: "§4"
related_arch: "§5.3, §6.1, §7.2, §8.4, §9 (ADR-15, ADR-20..ADR-27)"
branch: "main"
---

# 003 — Artifact CRUD & templates

## What

CRUD local de artifacts (`skill`, `reference`, `agent`) em Markdown + YAML frontmatter dentro do `workspacePath` configurado pela spec 002, mais a entrega dos `templates` built-in por tipo. Esta spec entrega o `ArtifactService` (leitura/escrita no workspace, geração de `createdAt`/`updatedAt`, validação mínima de campos obrigatórios), o `TemplateService` (lista templates built-in e instancia conteúdo inicial para "não enfrentar a página em branco") e a UI no Renderer com tela de listagem por tipo, formulário de criação a partir de template, editor com preview Markdown e ação de delete. O contrato IPC ganha `artifact.list | get | save | delete` e `template.list` via `contextBridge`. Sync para Claude/Copilot **não** acontece nesta spec — `artifact.save` retorna `syncReport: []` como stub e a integração real fica para a spec 004.

## Why

O CRUD é o coração funcional do spike: PRD §4 marca "CRUD of skills, references and agent profiles in Markdown + YAML frontmatter" e "Templates by type" como **must-have**, e ARCH §6.1 trata o save de artifact como passo 2 do fluxo principal. Sem esta spec não há o que sincronizar (bloqueia 004), não há o que listar como `reference` flagged (bloqueia 007), e o usuário não consegue dogfooding diário (PRD §6 — métrica de validação exige ≥5 artifacts criados em projeto real). Vem agora porque a 002 já entregou `workspacePath` válido em disco e o `SettingsService`, então `ArtifactService` tem onde escrever.

## Non-goals

- **Não sincronizar para `~/.claude/`, `~/.copilot/` ou repos linkados** — sync é responsabilidade exclusiva da spec 004 (`SymlinkManager` + `AdapterManager`). Esta spec deixa o pipeline de save com hook de sync no shape correto, mas implementação fica vazia.
- **Não validar schema completo de frontmatter.** Validação por tipo com schema rico é responsabilidade do should-have `009-schema-validator` (ARCH §5.3). Aqui só checa presença de campos obrigatórios.
- **Não implementar busca textual.** Search é `010-search-service` (should-have, pós must-have validado). Filtro por tipo na listagem não é busca — é roteamento de UI.
- **Não persistir `_backups/`** — backup só faz sentido em conflito de symlink (ARCH §6.2), que é da 004.
- **Não implementar `CopilotInstructionsGen`** — flag `includeInCopilotInstructions` no frontmatter de `reference` é gravada e lida, mas a agregação em `copilot-instructions.md` é da spec 007.
- **Não cobrir versionamento manual de `version: semver`** — campo é gravado e exibido, mas a app não bumpa nem valida progressão.
- **Não garantir round-trip determinístico de YAML** — `yaml`/`js-yaml` pode reordenar chaves entre save/load. Diff git mínimo no frontmatter não é objetivo do spike.
- **Não mover deletes para `.trash/`** — delete é hard-delete (remoção do arquivo/diretório). Recuperação via `git checkout` quando o workspace estiver versionado.
- **Não tornar `includeInCopilotInstructions` ativo** — flag no frontmatter de `reference` é gravada/lida mas inerte até spec 007. Sem indicador visual na UI nem revalidação ao toggle.

## In scope

- `src/main/services/ArtifactService.ts` — métodos `list({ type? })`, `get({ id })`, `save({ artifact })`, `delete({ id })`. Persistência em `<workspace>/<type-folder>/<slug>(.md|/SKILL.md)` conforme ARCH §7.2.
- `src/main/services/TemplateService.ts` — método `list({ type })` retornando templates built-in (≥1 por tipo: skill, reference, agent).
- `src/main/templates/` — arquivos-fonte dos templates built-in (Markdown + frontmatter mínimo).
- Hexagonal layering (ADR-13): portas em `domain/`, casos de uso em `application/`, adapter de filesystem em `infrastructure/`, dispatcher IPC em `ipc/`.
- IPC dispatcher: registrar `artifact.list`, `artifact.get`, `artifact.save`, `artifact.delete`, `template.list` no `call(method, params)` central (ADR-14).
- `artifact.save` retorna `{ artifact, syncReport: [] }` — shape final, payload vazio até spec 004.
- Renderer: tela de listagem por tipo (skills | references | agents), criação a partir de template (modal/dialog escolhendo template), tela de edição com editor `textarea` nativo + preview via `react-markdown`, ação de delete com confirmação.
- Geração automática de `createdAt`/`updatedAt` no `ArtifactService` (nunca confiar no Renderer).
- Geração de `slug`: derivado de `name` via kebab-case (`Hello World` → `hello-world`), editável pelo usuário no formulário antes do primeiro save.
- Validação mínima no save: presença de `slug`, `name`, `type`, `description`, `scope`, `version`; `slug` casa regex `^[a-z0-9][a-z0-9-]*$`; `description` ≤ 200 chars. Falha rejeita com `kind: validation` (ARCH §8.2).
- Colisão de `<type>/<slug>` em criação rejeita com `{ kind: "validation", message, details: { conflict: "<type>/<slug>" } }`. Re-save do mesmo `<type>/<slug>` é update legítimo (preserva `createdAt`, atualiza `updatedAt`).
- Tipo `skill` cria diretório `<slug>/SKILL.md`; `reference` e `agent` criam arquivo `<slug>.md` na pasta correspondente.
- Frontmatter parseado/serializado com `yaml`/`js-yaml` (stack confirmada em ARCH §4.1).

## Out of scope (deferred to later specs)

- Sync via symlink → spec 004 (`004-symlink-sync-core`).
- Adapters Claude/Copilot → specs 005, 006.
- Geração de `copilot-instructions.md` a partir de references flagged → spec 007.
- Schema completo por tipo → spec 009 (`009-schema-validator`).
- Busca textual → spec 010 (`010-search-service`).
- Token consumption por artifact → specs 011, 012.
- Templates customizados em `.sde/templates/` — debt futura, sem spec atribuída. Apenas built-in nesta spec.

## Considered alternatives

| Decisão | Escolhida | Alternativas descartadas | Motivo |
|---|---|---|---|
| Identidade do artifact | `id = <type>/<slug>` derivado do path | UUID; hash de conteúdo | `<type>/<slug>` é o próprio path no disco, não precisa de catálogo paralelo; remove fonte de drift entre arquivo e índice |
| Slug | Derivado de `name` via kebab-case, editável; regex `^[a-z0-9][a-z0-9-]*$`; colisão rejeita com `kind: validation` | UUID/hash; auto-resolver colisão com sufixo `-2` | Slug humano é o path no disco e o que aparece na URL do Claude/Copilot; auto-sufixo esconde duplicatas e gera drift entre `name` e `slug` |
| Pipeline de sync no save | Hook stub vazio nesta spec, shape final preservado | Adiar IPC `artifact.save` até a 004; entregar com sync hardcoded para Claude personal | Stub mantém contrato IPC estável e desbloqueia UX de save desde já; sem hardcode acidental |
| Persistência | Filesystem direto via `fs/promises` | Repository pattern com `InMemoryArtifactRepository` no Main para testes | Filesystem é a fonte de verdade do produto; in-memory adapter cabe em testes da port `ArtifactRepository` (hexagonal) sem virar runtime de produção |
| Editor Markdown | `textarea` nativo + preview com `react-markdown` | Monaco/CodeMirror; editor WYSIWYG (Tiptap) | PRD §5 tira polish de escopo; textarea cobre dogfooding sem yak-shave de bundle/setup. Upgrade vira debt se fricção real aparecer |
| Atomicidade de write | Tempfile + `rename` (ADR-15) | Write direto | Mesma justificativa da 002 — escritor único, evita arquivo truncado |
| Templates customizados | Apenas built-in nesta spec; `.sde/templates/` fica como debt futura | Suportar `.sde/templates/` agora; arquivo único por tipo sem catálogo | PRD §4 só pede "templates by type"; built-in cobre o must-have. Custom adiciona resolução de catálogo + UX de gerenciamento sem demanda comprovada |
| Delete | Remove arquivo/diretório no workspace; flag `removeSymlinks` no contrato é no-op | Bloquear delete até 004; soft-delete (mover para `.trash/`) | No-op explícito mantém contrato estável (ADR-14); soft-delete vira debt sem demanda do PRD; recuperação via `git checkout` quando workspace versionado |
| Validação no save | Presença de campos obrigatórios + `slug` regex + `description ≤ 200` | Validação completa de schema agora; nenhuma validação até 009 | Nenhuma deixa lixo no disco; completa duplica esforço com 009. Mínimo cobre os campos que viram path ou aparecem em UI |

## Acceptance criteria

1. `ls docs/specs/003-artifact-crud/` retorna `SPEC.md` e `tasks.md` (este último gerado pelo `eng-create-spec-tasks` em momento separado).
2. `grep -r "ArtifactService" src/main/` localiza o serviço e o teste correspondente; testes passam com `npm test` (ou comando equivalente confirmado pela 001).
3. Após `artifact.save` de um `skill` com `slug: foo`, existe `<workspace>/skills/foo/SKILL.md` com frontmatter válido e `createdAt`/`updatedAt` em ISO-8601 UTC.
4. Após `artifact.save` de um `reference` com `slug: bar`, existe `<workspace>/references/bar.md`.
5. Após `artifact.save` de um `agent` com `slug: baz`, existe `<workspace>/agents/baz.md`.
6. `artifact.list({ type: "skill" })` retorna apenas itens do tipo skill, lendo do disco; `artifact.list()` (sem filtro) retorna todos os tipos.
7. `artifact.get({ id: "skill/foo" })` retorna o artifact completo (frontmatter parseado + body) ou rejeita com `kind: not_found`.
8. `artifact.save` sem campo obrigatório (`slug`, `name`, `type`, `description`, `scope`, `version`) rejeita com `{ kind: "validation", message, details: { missing: [...] } }`. `slug` fora do regex `^[a-z0-9][a-z0-9-]*$` ou `description` > 200 chars rejeita com `{ kind: "validation", details: { invalid: [...] } }`.
9. `artifact.save` retorna sempre `{ artifact, syncReport: [] }` enquanto a spec 004 não estiver merged — verificável por leitura do dispatcher e teste.
10. `artifact.delete({ id: "skill/foo", removeSymlinks: true })` remove `<workspace>/skills/foo/` (diretório recursivo); para `reference`/`agent` remove o arquivo. A flag `removeSymlinks` é aceita no contrato e ignorada — teste confirma que nenhum filesystem call externo ao workspace é executado.
11. `template.list({ type: "skill" })` retorna ≥1 template; idem para `reference` e `agent`. Conteúdo dos templates inclui frontmatter inicial com `type` correspondente.
12. Renderer renderiza a listagem por tipo navegável, com botão "novo a partir de template" que abre seleção de template e leva à tela de edição populada.
13. Tela de edição mostra `textarea` para edição do body Markdown e preview renderizado via `react-markdown`; save dispara `window.api.call('artifact.save', ...)` e exibe toast de sucesso/erro envelope-shaped (ARCH §8.2).
14. Re-save de um artifact existente atualiza `updatedAt` mas preserva `createdAt`.
15. Tentativa de criação com `<type>/<slug>` já existente rejeita com `{ kind: "validation", message, details: { conflict: "<type>/<slug>" } }`. Re-save (update) do mesmo `<type>/<slug>` é permitido — verificável por teste.
16. Lint e typecheck passam sem warnings novos: `npm run lint`, `npm run typecheck` (ou comandos confirmados pela 001).

## References

- ARCH §5.3 — `ArtifactService`, `TemplateService` no inventário de Main services.
- ARCH §6.1 — fluxo de save (esta spec entrega passos 1, 2 e 6; passos 3-5 são da 004).
- ARCH §7.2 — layout do workspace (skills como diretório, references/agents como arquivo).
- ARCH §8.1 — contrato IPC; métodos `artifact.*` e `template.list`.
- ARCH §8.2 — error envelope.
- ARCH §8.4 — schema de frontmatter inicial.
- ARCH §9 ADR-13, ADR-14, ADR-15 — layering hexagonal, single-channel IPC, write atômico.
- ARCH §9 ADR-20..ADR-27 — decisões registradas nesta spec (identidade `<type>/<slug>`, slug humano + colisão, sync stub, `fs/promises` direto, editor `textarea` + `react-markdown`, templates built-in, delete hard, validação mínima).
- PRD §4 — must-have de CRUD, templates, preview Markdown.
- PRD §6 — métrica de ≥5 artifacts criados em projeto real.
- ROADMAP — `003-artifact-crud` na fila Next.

## Bookkeeping outcome (Phase 8)

**PRD §4 review (T056):** N/A — escopo confirmado. A 003 entregou os três must-have correspondentes ("CRUD of skills, references and agent profiles in Markdown + YAML frontmatter", "Templates by type", "Markdown preview on save") sem necessidade de mover itens para should/nice-to-have. Os demais must-have (sync via symlink, `copilot-instructions.md`, settings) permanecem fora do escopo desta spec e são responsabilidade das specs 004, 006 e 007 conforme `Out of scope`.

**ARCH §9 reconciliation (T055):** ADRs 20–27 adicionados cobrindo as decisões de `Considered alternatives`; ADR-15 atualizada para citar a 003 como segundo validador de write atômico (ver linha 384–402 de `docs/ARCH.md`).
