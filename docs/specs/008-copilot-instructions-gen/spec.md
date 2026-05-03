---
id: "008"
title: Copilot instructions generator
status: draft
priority: later
created_at: 2026-05-03
updated_at: 2026-05-03
depends_on: ["007"]
labels: [must-have, core, adapter]
related_prd: "§4"
related_arch: "§6.4, §5.3"
branch: ""
---

# 008 — Copilot instructions generator

## What

Implementa o serviço `CopilotInstructionsGen` (ARCH §5.3): agrega artifacts do tipo `reference` que tenham `frontmatter.includeInCopilotInstructions === true` em um único arquivo gerado em `<workspace>/_generated/copilot-instructions.md`, ordenados alfabeticamente por `name`, com header de "GENERATED" e `chmod 444` aplicado após cada escrita. O `CopilotAdapter` (entregue pela 014/007) passa a tratar o branch `reference` que hoje devolve `[]` para — em vez disso — disparar a geração e produzir o(s) symlink(s) do arquivo agregado nos destinos do Copilot. O serviço roda no Main, é puramente filesystem (sem rede/API), e é idempotente: re-rodar com o mesmo input produz bytes idênticos.

## Why

PRD §4 marca "`copilot-instructions.md` generated from flagged references" como must-have. ARCH §6.4 fixa o fluxo de regeneração e os triggers (save de reference flagged, toggle do flag, "Sync all", botão manual em Settings). A 007 entregou `CopilotAdapter` cobrindo `skill`/`agent`/`global-instruction:copilot` e deixou `reference` em no-op explícito (AC#6 da 007); sem a 008, references flagged continuam invisíveis para o Copilot — o must-have não fecha. A 008 também é pré-requisito real da 009 (disable flow precisa saber o que remover quando o Copilot é desligado, incluindo o symlink do agregado).

## Non-goals

- **Não sincronizar references individualmente para o Copilot** — agregação é o único caminho (decisão da 007 em "Considered alternatives").
- **Não tocar no `ClaudeAdapter` nem nos branches `skill`/`agent`/`global-instruction` do `CopilotAdapter`** — a 008 só preenche o branch `reference` e adiciona o serviço novo.
- **Não cobrir disable flow** — limpeza do `_generated/` e de symlinks ao desligar Copilot é spec 009.
- **Não suportar editores Copilot além de `vscode`** — mesmo recorte da 014/007.
- **Não validar schema de frontmatter** além do que a 003 já valida — completo fica para 010.
- **Não criar UI de "preview do agregado"** — geração roda silenciosa; a UI atual já exibe o `SyncResult[]` no toast/modal pós-save (006).
- **Não persistir cache do agregado** — re-leitura a cada trigger é aceitável (volume baixo no spike).

## In scope

- Novo serviço `src/main/application/services/copilot-instructions-gen.ts` (ou caminho equivalente conforme ADR-13) com a port:
  - `generate(): Promise<{ path: string; refsIncluded: number }>`
  - Dependências injetadas: `ArtifactRepository` (porta da 003), `WorkspaceFs` (porta de filesystem da 004) e `clock` (para o header timestamp, se aplicável — ver "Considered alternatives").
- Algoritmo:
  1. Lista todos os artifacts via `ArtifactRepository.list({ type: "reference" })`.
  2. Filtra por `frontmatter.includeInCopilotInstructions === true`.
  3. Ordena por `name` (case-insensitive, locale-aware via `Intl.Collator('en')` para evitar não-determinismo entre máquinas).
  4. Concatena em ordem com separador entre referências `[NEEDS CLARIFICATION: separador entre referências — `\n\n` puro vs `\n\n## <name>\n\n` vs `\n\n---\n\n`?]`.
  5. Prepende o header literal `<!-- GENERATED — edit references in the app -->\n\n` (ARCH §6.4 fixou o texto).
  6. Escreve atomicamente em `<workspace>/_generated/copilot-instructions.md` (ADR-15: tempfile + `rename`). Antes do `rename`, garante que o destino é escrita-permitida — se já existir como `0o444`, faz `chmod 0o644` no destino atual, sobrescreve via rename, depois `chmod 0o444`.
  7. Devolve `{ path, refsIncluded }` para o caller logar/exibir.
- Integração com `CopilotAdapter`:
  - Branch `type === "reference"` deixa de devolver `[]` (AC#6 da 007); passa a:
    - Disparar `CopilotInstructionsGen.generate()` (com short-circuit: se nenhum reference está flagged, ver clarification abaixo).
    - Devolver os destinos do arquivo agregado:
      - personal: `[NEEDS CLARIFICATION: filename canônico do destino personal — `~/.copilot/copilot-instructions.md` (legado/ARCH §6.4) vs `~/.copilot/instructions/copilot-instructions.md` (paridade com a 014, que já usa `~/.copilot/instructions/global.instructions.md`)?]`.
      - project (por repo em `linkedRepos`): `<repo.path>/.github/copilot-instructions.md` (ARCH §6.4 fixou).
  - O symlink aponta para `<workspace>/_generated/copilot-instructions.md` (file-level).
  - Se `_generated/copilot-instructions.md` ainda não existe ao resolver (cold start), o adapter dispara `generate()` antes de devolver os destinos.
- Triggers cobertos pela 008 (ARCH §6.4):
  - **Save de reference** (qualquer reference, flagged ou não): `ArtifactService.save` → após `AdapterManager.syncOne`, dispara `CopilotInstructionsGen.generate()` se Copilot está enabled e algum reference está flagged. Para reference flagged que mudou conteúdo, o trigger é direto via o branch `reference` do `CopilotAdapter`.
  - **Toggle do flag** (`includeInCopilotInstructions` true↔false): coberto pelo trigger anterior (toggle implica save).
  - **"Sync all"**: a 008 expõe `CopilotInstructionsGen.generate()` para o `AdapterManager.syncAll` chamar uma vez por execução.
  - **Botão manual em Settings**: novo IPC method `[NEEDS CLARIFICATION: nome do método IPC — `copilot.regenerateInstructions` vs `adapter.copilot.regenerate` vs reuse de `artifact.save` com flag]`.
- Comportamento quando **0 references flagged**: `[NEEDS CLARIFICATION: gerar arquivo vazio (só com header)? pular geração e remover `_generated/copilot-instructions.md` se existir? manter o arquivo prévio (stale)?]`.
- Testes:
  - Unit: ordenação alfabética estável (`Intl.Collator('en')`); empate por `name` é tratado por `slug` como tiebreaker.
  - Unit: filtro inclui só `type === "reference"` com `includeInCopilotInstructions === true`.
  - Unit: header literal e `chmod 444` aplicados após escrita; idempotência (mesmo input → mesmos bytes).
  - Unit: re-escrita sobre arquivo `0o444` funciona (chmod 644 → write atômico → chmod 444).
  - Unit: comportamento do branch "0 references flagged" (após resolver clarification).
  - Integração: e2e via `AdapterManager.syncOne` para um reference flagged → gera `_generated/copilot-instructions.md` + cria symlinks personal/project esperados.
  - Integração: 2 references flagged + 1 reference não flagged → arquivo agregado contém os 2 flagged em ordem alfabética; o terceiro não aparece.
  - Integração: toggle de `includeInCopilotInstructions` true → false em uma reference dispara regeneração e o conteúdo some do agregado.
  - Integração: 2 repos linkados em scope project + Copilot enabled → 2 symlinks em `<repo>/.github/copilot-instructions.md`, ambos resolvendo para o `_generated/copilot-instructions.md` único.
  - Integração: paths com espaços/acentos em `homedir` e `repo.path` continuam funcionando (delegação ao `SymlinkManager`).

## Out of scope (deferred to later specs)

- Disable flow + cleanup massivo (incluindo remoção do `_generated/copilot-instructions.md` e seus symlinks ao desligar Copilot) → spec 009.
- Suporte a outros editores Copilot (intellij, vim, emacs) → débito pós-spike (mesmo recorte da 014/007).
- Validação de schema de reference (ex.: `description ≤ N`) → spec 010.
- Cache persistente do agregado → ADR-10 fixa "no persistent search index"; mesma lógica vale aqui.
- UI de preview do agregado em Settings → revisitar pós-spike se aparecer demanda.
- ADR formal sobre o pattern "service + adapter cooperando para resolver destinations" → bookkeeping decide se promove.

## Considered alternatives

| Decisão | Escolhida | Alternativas descartadas | Motivo |
|---|---|---|---|
| Onde mora a geração do agregado | **Service novo `CopilotInstructionsGen`** (ARCH §5.3 já listou) | (b) Método estático no `CopilotAdapter`; (c) Inline em `ArtifactService.save` | ARCH §5.3 já fixa `CopilotInstructionsGen` como service separado. Adapter é resolução de paths (porta `Adapter` da 004) — embutir geração viola SRP e quebra contract test. Inline em `ArtifactService` acopla CRUD a sync logic. |
| Trigger ao salvar reference não flagged | **Re-gerar mesmo assim** se Copilot enabled e existe ≥1 reference flagged | (b) Pular geração quando o reference salvo não é flagged | Custo é baixo (re-leitura + write atômico); evita drift se o reference salvo previamente era flagged e foi des-flagged no save (toggle). Simplifica a regra: "qualquer save de reference + Copilot enabled → re-gera". |
| Ordenação | **Alfabética por `name` via `Intl.Collator('en')`** | (b) Ordem cronológica (`createdAt`); (c) Ordem por `slug`; (d) Sem ordenação (insertion order do FS) | ARCH §6.4 fixa "alphabetical order by `name`". `Intl.Collator('en')` garante determinismo cross-machine (default `Array.sort` para strings é OK em ASCII mas inconsistente para acentos). |
| Atomicidade da escrita | **tempfile + `rename`** (ADR-15) | (b) Write direto; (c) `proper-lockfile` | ADR-15 já fixa o padrão para artifacts e settings; mesma lógica aplica. `chmod 444` no destino exige `chmod 644` antes do rename para sobrescrever — coberto no in scope. |
| Header com timestamp | **Header fixo sem timestamp** (literal de ARCH §6.4) | (b) Header com `Generated at: <ISO>` para auditabilidade | Timestamp quebra idempotência byte-a-byte (re-escrita gera diff mesmo sem mudança real). Auditabilidade vem do `mtime` do arquivo no FS; mais barato. |
| Re-escrita em arquivo `0o444` | **`chmod 0o644` → write atômico → `chmod 0o444`** | (b) `unlink` + write + chmod; (c) Falhar e exigir delete manual | `unlink` + write quebra atomicidade (janela com arquivo ausente); (c) é hostil. Sequência chmod-write-chmod é local ao serviço e testável. |
| Localização do `_generated/` | **`<workspace>/_generated/copilot-instructions.md`** | (b) `<workspace>/copilot-instructions.md` (raiz); (c) `<workspace>/references/_generated/`; (d) Pasta separada fora do workspace | ARCH §7.2 fixa `_generated/` como pasta dedicada no workspace; raiz polui listagem; pasta dentro de `references/` confunde "source vs generated"; fora do workspace quebra portabilidade. |

## Acceptance criteria

1. Existe `src/main/application/services/copilot-instructions-gen.ts` (ou caminho equivalente seguindo ADR-13) exportando `CopilotInstructionsGen` com método `generate(): Promise<{ path: string; refsIncluded: number }>`. Verificável por unit test instanciando o service com fakes e chamando `generate()`.
2. `generate()` lê todos os artifacts `type === "reference"` via `ArtifactRepository.list`, filtra por `frontmatter.includeInCopilotInstructions === true`, e devolve `refsIncluded` igual à contagem do filtro.
3. O conteúdo escrito em `<workspace>/_generated/copilot-instructions.md` começa **exatamente** com `<!-- GENERATED — edit references in the app -->\n\n` (header literal de ARCH §6.4).
4. Após o filtro, references são concatenadas em ordem alfabética por `name` segundo `Intl.Collator('en')`. Verificável por unit test com 3+ references com nomes que dependem do collator (ex.: `"Apple"`, `"banana"`, `"Cherry"`).
5. Após cada `generate()`, o arquivo `<workspace>/_generated/copilot-instructions.md` tem permissões `0o444`. Verificável por `(await fs.stat(path)).mode & 0o777 === 0o444`.
6. Re-rodar `generate()` com o mesmo input (mesmos artifacts, mesmo conteúdo, mesma flag) produz **bytes idênticos** ao output anterior. Verificável por `expect(bufferAfterFirst).toEqual(bufferAfterSecond)`.
7. Re-rodar `generate()` com o destino já em `0o444` **não falha**: o serviço faz `chmod 0o644` → write atômico (tempfile + rename) → `chmod 0o444`. Verificável por unit test que pre-aplica `chmod 444` e chama `generate()` duas vezes consecutivas.
8. Escrita é atômica via tempfile + `rename` (ADR-15). Verificável por inspeção de código (uso explícito de `fs.rename` ou helper compartilhado).
9. Para `artifact.type === "reference"` (qualquer scope, qualquer flag), `CopilotAdapter.resolveDestinations` deixa de retornar `[]` (atual AC#6 da 007) e passa a:
   - 9a. Disparar `CopilotInstructionsGen.generate()` antes de resolver (ou garantir que o `_generated/copilot-instructions.md` existe).
   - 9b. Devolver `1 destino personal` em `[NEEDS CLARIFICATION: filename canônico personal — ver In scope]` quando `scopes.includes("personal")`.
   - 9c. Devolver `N destinos project` (`<repo.path>/.github/copilot-instructions.md`) quando `scopes.includes("project")` com N repos linkados.
   - 9d. Cada destino tem `destination` absoluto, `scope` correto, e o symlink aponta para `<workspace>/_generated/copilot-instructions.md`.
10. Save end-to-end de uma reference com `includeInCopilotInstructions: true`, scope `personal`, Copilot enabled, sobre `InMemoryFilesystem` → produz no FS fake (a) `<workspace>/_generated/copilot-instructions.md` com header + conteúdo da reference + `chmod 444`, e (b) symlink no destino personal apontando para o arquivo gerado.
11. Save end-to-end de uma reference flagged com `scopes: ["personal", "project"]` e 2 repos linkados → produz 1 arquivo gerado + 3 symlinks (1 personal + 2 project), todos resolvendo para o mesmo arquivo gerado.
12. Toggle de `includeInCopilotInstructions: true → false` em uma reference + save → próxima geração **não inclui** essa reference no agregado; `refsIncluded` decresce em 1.
13. Comportamento quando 0 references estão flagged: `[NEEDS CLARIFICATION: gerar arquivo só com header? pular geração e remover arquivo prévio? manter stale?]` — após resolver, AC adicional descrevendo a observação verificável.
14. Botão manual "Regenerate Copilot instructions" em Settings dispara `CopilotInstructionsGen.generate()` via novo IPC method `[NEEDS CLARIFICATION: nome do método]`. Verificável por teste integração no dispatcher.
15. Comportamento existente da 007 permanece intacto para `skill`, `agent` e `global-instruction` (ACs 2-5 e 9 da 007 continuam verdes).

## Risks & assumptions

- **ASSUMPTION:** Source canônico de reference no workspace é `<workspace>/references/<slug>.md` (ARCH §7.2). O conteúdo lido para concatenação é o **body** do arquivo (sem o frontmatter). Confirmar no `ArtifactRepository` da 003 antes de Phase 1.
- **ASSUMPTION:** O VS Code Copilot lê `~/.copilot/copilot-instructions.md` (ou `~/.copilot/instructions/copilot-instructions.md` — pendente de clarification) e `<repo>/.github/copilot-instructions.md` automaticamente. Validar via smoke manual em Phase Verification.
- **ASSUMPTION:** Nenhum reference tem nome duplicado **dentro do escopo flagged** — `name` por si é estável o suficiente para ordenação. Caso colida, `slug` desempata (sempre único por type — ADR-21).
- **RISCO baixo:** `Intl.Collator('en')` pode dar ordens diferentes para nomes com caracteres não-latinos. **Mitigação:** o spike é dogfooding em pt-BR; nomes serão majoritariamente ASCII/Latin-1. Se aparecer caso, trocar locale ou normalizar via `Intl.Collator(undefined)`.
- **RISCO médio:** Header em formato HTML comment (`<!-- ... -->`) pode ser **renderizado como conteúdo** em alguns parsers Copilot. **Mitigação:** ARCH §6.4 já registrou que header + chmod 444 são "friction only, not security". Validar no smoke se o header polui o contexto na palette do Copilot; se sim, abrir débito para mudar formato.
- **RISCO baixo:** Chmod sequence (`644 → write → 444`) tem janela curta onde outro processo poderia sobrescrever. **Mitigação:** Main é o único escritor; janela é interna ao serviço (μs).
- **DEBT consciente:** Geração re-lê todos os references a cada trigger (sem cache em memória). Volume esperado < 50 references no spike — performance OK. Revisitar pós-spike se aparecer fricção.
- **DEBT consciente:** Não há detecção de "reference flagged removida do disco fora do app" — exige novo trigger (filesystem watcher). Fica como débito; ARCH §6.4 lista os triggers cobertos.

## References

- [PRD.md §4](../../PRD.md) — must-have "`copilot-instructions.md` generated from flagged references".
- [ARCH.md §5.3](../../ARCH.md) — `CopilotInstructionsGen` na tabela de Main services.
- [ARCH.md §6.4](../../ARCH.md) — Fluxo de regeneração, ordem alfabética, header literal, `chmod 444`.
- [ARCH.md §7.2](../../ARCH.md) — Layout do workspace com `_generated/`.
- [ARCH.md §7.4](../../ARCH.md) — Symlink destinations Copilot.
- [ARCH.md §9 ADR-7](../../ARCH.md) — Flag `includeInCopilotInstructions` no frontmatter da reference.
- [ARCH.md §9 ADR-15](../../ARCH.md) — Escrita atômica via tempfile + `rename`.
- [Spec 003](../003-artifact-crud/spec.md) — `ArtifactService` + `ArtifactRepository`.
- [Spec 004](../004-symlink-sync-core/spec.md) — `SymlinkManager`, `AdapterManager`, port `Adapter`.
- [Spec 007](../007-copilot-adapter/SPEC.md) — `CopilotAdapter`; AC#6 (reference → `[]`) que esta spec substitui.
- [Spec 014](../014-global-instructions/spec.md) — pattern de path `~/.copilot/instructions/...` (referência para clarification do filename canônico).
- ROADMAP — `008-copilot-instructions-gen` em "Later → Must-have remaining".
