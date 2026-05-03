---
id: "007"
title: Copilot adapter
status: done
priority: later
created_at: 2026-05-03
updated_at: 2026-05-03
depends_on: ["014"]
labels: [must-have, adapter, core]
related_prd: "§4"
related_arch: "§5.3, §7.4, §6.4"
branch: "007-copilot-adapter"
---

# 007 — Copilot adapter

## What

Estende o `CopilotAdapter` introduzido como stub pela 014 (`src/main/infrastructure/adapters/copilot-adapter.ts`) para cobrir os tipos `skill` e `agent` em ambos os scopes (`personal` e `project`), espelhando a função do `ClaudeAdapter` da 005. Mesma classe — não cria adapter paralelo; apenas adiciona branches em `resolveDestinations` e expõe os destinos esperados pelo `AdapterManager` da 004 quando `settings.adapters.copilot.enabled === true`. Não envolve rede, API, geração de `copilot-instructions.md` (spec 008), nem disable flow (spec 009).

## Why

PRD §4 marca "Sync via symlink to Copilot, personal e project" como must-have. ARCH §5.3 fixa o contrato do `CopilotAdapter` (mapeia artifact → Copilot paths; delega ao `SymlinkManager`; não toca em tokens). A 014 entregou o stub cobrindo só `global-instruction:copilot` — sem a 007, nenhum skill ou agent criado pelas 003+004+006 chega ao Copilot. A 008 (aggregation de references em `copilot-instructions.md`) e a 009 (disable flow) precisam do CopilotAdapter completo para fazerem sentido.

ROADMAP linha `007-copilot-adapter` originalmente declarava `Depends on 004`; bookkeeping da 014 ajustou para `Depends on 014` por causa do stub-adapter pattern. 014 está em `status: active` na data desta spec — a 007 pode chegar em `draft`/`review` em paralelo, mas só inicia Phase 1 quando 014 atingir `review`.

## Non-goals

- **Não criar uma segunda classe `CopilotAdapter`** — estende a existente da 014.
- **Não gerar `copilot-instructions.md`** (aggregation de references flagged) — spec 008.
- **Não cobrir disable flow** — varredura/limpeza ao desligar adapter é spec 009.
- **Não suportar editores Copilot além de `vscode`** — `intellij`, `vim`, `emacs` etc. ficam como débito pós-spike (mesmo recorte da 014). Reconfirmado.
- **Não fazer HTTP nem tocar na API do GitHub Copilot** — `CopilotUsageClient` é nice-to-have separado (PRD §4, ARCH §5.3).
- **Não validar schema de frontmatter** além do que a 003 já valida — completo fica para 010 (`SchemaValidator`).
- **Não sincronizar `reference` individualmente para o Copilot** — references vão ao Copilot **apenas** via `copilot-instructions.md` agregado (spec 008). Decisão registrada em "Considered alternatives".
- **Não mexer no branch `global-instruction` do `CopilotAdapter`** — entregue e validado pela 014; manter inalterado.

## In scope

- Estender `src/main/infrastructure/adapters/copilot-adapter.ts` adicionando branches para `type === "skill"` e `type === "agent"`. Manter o branch existente de `global-instruction` intocado.
- Resolução de destinos por `(type, scope)`:
  - `skill` + `personal` → 1 destino: `<homedir>/.copilot/skills/<slug>/` (dir-level, symlink para `<workspace>/skills/<slug>/`).
  - `skill` + `project` → 1 destino por repo em `linkedRepos`: `<repo.path>/.github/skills/<slug>/` (dir-level).
  - `agent` + `personal` → 1 destino: `<homedir>/.copilot/agents/<slug>.agent.md` (file-level, extensão `.agent.md` exigida pelo Custom Agents).
  - `agent` + `project` → 1 destino por repo: `<repo.path>/.github/agents/<slug>.agent.md`.
  - `reference` → `[]` (no-op silencioso; aggregation via 008).
  - `global-instruction` + `slug: "copilot"` → comportamento existente da 014 (inalterado).
  - `global-instruction` + `slug: "claude"` → `[]` (inalterado).
- **Granularidade de `skill`** — dir-level confirmado pela spec aberta agentskills.io e pela documentação Copilot ("each skill is a folder with a `SKILL.md` file inside"). Symlink aponta para `<workspace>/skills/<slug>/`; o `SKILL.md` e assets opcionais ficam dentro do source.
- **Granularidade de `agent`** — file-level (`<slug>.agent.md`). Source canônico segue o que a 005 estabelecer (provavelmente `<workspace>/agents/<slug>.md`); o adapter só compõe o destino com a extensão `.agent.md`. Ver ASSUMPTION em "Risks & assumptions".
- **Validação do `homedir`** — já implementada pela 014 no construtor; sem mudança.
- **Wiring** — `CopilotAdapter` já está registrado pela 014 em `src/main/index.ts`. Nenhuma mudança de wiring; apenas a expansão da implementação.
- Testes:
  - Unit: contract test de `Adapter` (port da 004) reaproveitado contra `CopilotAdapter` expandido.
  - Unit: cada combinação `(type, scope)` resolvendo o destino esperado, incluindo `linkedRepos: []` em `project` (devolve array vazio; "skipped: no-linked-repos" é responsabilidade do `AdapterManager` por ADR-29).
  - Unit: `reference` de qualquer scope devolve array vazio.
  - Unit: `global-instruction:copilot` continua resolvendo o destino da 014 (regressão).
  - Unit: `global-instruction:claude` continua devolvendo `[]` (regressão).
  - Unit: paths com espaços/acentos em `homedir` simulado e em `repo.path` continuam absolutos (delegação a `path.join` + `os.homedir()`; normalização final no `SymlinkManager`).
  - Integração: e2e via `AdapterManager.syncOne` com `CopilotAdapter` registrado e `SymlinkManager` real sobre `InMemoryFilesystem` (fixture da 004) — verifica `SyncResult[]` `status: "ok"` com `destination` apontando para os paths esperados.
  - Integração: `settings.adapters.copilot.enabled === false` produz zero `SyncResult` com `adapter: "copilot"`.
  - Integração: artifact com `scopes: ["personal", "project"]` e Claude+Copilot habilitados produz a união correta de `SyncResult[]` (regressão da 006).

## Out of scope (deferred to later specs)

- Aggregation de references em `copilot-instructions.md` → spec 008.
- Disable flow + cleanup massivo de symlinks → spec 009.
- Suporte a `~/.config/github-copilot/intellij/`, `vim/`, `emacs/` e outros editores Copilot → débito pós-spike.
- Validação de tamanho/forma específica do Copilot (ex.: front-matter requerido para `.instructions.md`, `applyTo` glob) → spec 010 (`SchemaValidator`) se aparecer demanda.
- `CopilotUsageClient` (HTTP GET na Usage API) → nice-to-have separado.

## Considered alternatives

| Decisão | Escolhida | Alternativas descartadas | Motivo |
|---|---|---|---|
| Adapter para `reference` no Copilot | **Não sincronizar individualmente** (`resolveDestinations` devolve `[]` para `type === "reference"`) | (b) sincronizar reference como `.instructions.md` solto em `~/.copilot/instructions/<slug>.md`; (c) sincronizar **e** agregar em `copilot-instructions.md` (duplicação) | ARCH §6.4 e §5.3 fixam que references chegam ao Copilot **apenas** via aggregation no `copilot-instructions.md` (spec 008). Sincronizar solto duplica conteúdo no contexto do Copilot e cria fonte ambígua; (c) é literalmente conteúdo duplicado. |
| Estender o adapter existente vs. criar segundo | **Estender o `CopilotAdapter` da 014** (mesma classe, novos branches) | (b) Criar `CopilotSkillAdapter` separado, registrar dois adapters Copilot no `AdapterManager` | Port `Adapter` da 004 é por ferramenta, não por type. Múltiplos adapters Copilot quebrariam contract test e gating por `settings.adapters.copilot.enabled` (binário por adapter, não por type). |
| Granularidade do skill no destino do Copilot | **dir-level** (symlink para `<workspace>/skills/<slug>/`) | (b) file-level apontando só para `SKILL.md` | Spec aberta agentskills.io e docs Copilot/VS 2026 fixam "each skill is a folder containing `SKILL.md` plus optional assets". Dir-level preserva assets e bate com o padrão da 005 (Claude). |
| Path do skill no Copilot | **`~/.copilot/skills/<slug>/`** (personal) e **`<repo>/.github/skills/<slug>/`** (project) | (b) usar subpasta dentro de `instructions/`; (c) achatar como `.instructions.md`; (d) devolver `[]` | Copilot escaneia 6 well-known locations para Agent Skills (`~/.copilot/skills/`, `~/.claude/skills/`, `~/.agents/skills/` + 3 análogos no workspace). Discovery automático sem setting; subpasta dentro de `instructions/` não é reconhecida como skill. |
| Path do agent no Copilot | **`~/.copilot/agents/<slug>.agent.md`** (personal) e **`<repo>/.github/agents/<slug>.agent.md`** (project) | (b) devolver `[]`; (c) achatar como instructions | Copilot tem convenção formal "Custom Agents" com extensão obrigatória `.agent.md` e setting `chat.agentFilesLocations`. Frontmatter inclui `target: vscode \| github-copilot`. Devolver `[]` perdia paridade com a 005. |
| Editores Copilot suportados | **Apenas `vscode`** (mesmo recorte da 014) | (b) Auto-detect; (c) Settings configurável | Spike é dogfooding com 1 editor primário; reconfirma decisão da 014. Múltiplos editores fica como débito explícito. |
| Forma do "reference no Copilot" no `SyncResult` | **Adapter devolve `[]`** — `AdapterManager` não emite `SyncResult` com `adapter: "copilot"` para references individuais | (b) Emitir `SyncResult { destination: null, status: "ok", details: { skipped: "type-handled-by-aggregation" } }` simétrico com ADR-29 | Mesmo argumento da 005: ADR-29 é sobre estado configurável (`linkedRepos: []`) — usuário pode resolver. Reference + Copilot individual é decisão arquitetural fixa do produto. Aggregation gera seu próprio `SyncResult` na 008. |

## Acceptance criteria

1. `src/main/infrastructure/adapters/copilot-adapter.ts` continua exportando uma classe que satisfaz a port `Adapter` da 004: `adapterId === "copilot"` e `resolveDestinations({ artifact, linkedRepos })`. O contract test da port (introduzido pela 004 e reaproveitado pela 014) continua verde.
2. Para `artifact.type === "skill"` e `scopes` incluindo `"personal"`, `resolveDestinations` devolve **exatamente um destino personal** com `scope: "personal"` e `destination === path.join(homedir, ".copilot/skills", slug)`. Verificável por unit test asserting o string.
3. Para `artifact.type === "skill"` e `scopes` incluindo `"project"` com `linkedRepos.length === N` (N ≥ 1), `resolveDestinations` devolve **N destinos project**, cada um com `scope: "project"` e `destination === path.join(repo.path, ".github/skills", slug)`.
4. Para `artifact.type === "agent"` e `scopes` incluindo `"personal"`, `resolveDestinations` devolve um destino personal com `destination === path.join(homedir, ".copilot/agents", slug + ".agent.md")` (extensão obrigatória pelo Custom Agents do Copilot).
5. Para `artifact.type === "agent"` e `scopes` incluindo `"project"` com N repos, `resolveDestinations` devolve N destinos project, cada um com `destination === path.join(repo.path, ".github/agents", slug + ".agent.md")`.
6. Para `artifact.type === "reference"` (qualquer scope, qualquer `linkedRepos`), `resolveDestinations` devolve `[]`. Verificável: nenhum `SyncResult` com `adapter: "copilot"` aparece no `SyncResult[]` para artifacts `reference` em testes integração da 007 (a 008 introduz outro caminho).
7. Para `scopes` incluindo `"project"` com `linkedRepos: []`, a porção project de `resolveDestinations` devolve `[]`; a porção personal (se `scopes` também incluir `"personal"`) continua produzindo seu destino. ADR-29 cobre o `SyncResult { skipped: "no-linked-repos" }` no `AdapterManager`.
8. Todos os destinos retornados por `resolveDestinations` para `skill` e `agent` são paths **absolutos** (`path.isAbsolute(d.destination) === true`). Verificável por asserção em todos os testes parametrizados.
9. Comportamento existente da 014 permanece intacto:
   - 9a. `global-instruction` + `slug: "copilot"` continua devolvendo `[{ scope: "personal", destination: path.join(homedir, ".copilot/instructions/global.instructions.md") }]`.
   - 9b. `global-instruction` + `slug: "claude"` continua devolvendo `[]`.
   - Verificável: testes da 014 continuam verdes sem modificação.
10. Em `src/main/index.ts`, `CopilotAdapter` continua registrado na map do `AdapterManager` com chave `"copilot"` (sem mudança da 014). Verificável: ao iniciar o app com `settings.adapters.copilot.enabled === true`, `AdapterManager.syncAll` para um artifact `skill, scopes: ["personal"]` produz um `SyncResult` com `adapter: "copilot"` e `status: "ok"` (assumindo AC#4 não cair em `[]`).
11. Com `settings.adapters.copilot.enabled === false`, nenhum `SyncResult` com `adapter: "copilot"` é produzido por `AdapterManager.syncOne` ou `syncAll` para qualquer artifact. Verificável por teste integração.
12. Save end-to-end de um skill `scopes: ["personal"]` com Copilot habilitado, sobre `InMemoryFilesystem` (fixture da 004), produz no FS fake um symlink no destino definido na AC#2 cujo `readlink` resolvido bate com `<workspace>/skills/<slug>` (dir-level confirmado).
13. Save end-to-end de um skill `scopes: ["project"]` com 2 repos linkados produz **2 symlinks**, um em cada `<repo.path>/.github/...`, ambos resolvendo para o source canônico do workspace.
14. Save end-to-end de um artifact com `scopes: ["personal", "project"]` e ambos adapters (Claude + Copilot) habilitados produz `SyncResult[]` com a união correta de destinos: M (Claude) + N (Copilot), todos com `status: "ok"`. Regressão da 006.
15. Re-save do mesmo artifact (sem mudanças) não recria symlink nem gera entrada em `_backups/` — idempotência delegada ao `SymlinkManager` da 004 (AC#3 da 004), revalidada aqui no caminho com `CopilotAdapter` real.
16. Paths com espaços e acentos em `homedir` (ex.: `/Users/José Silva`) e em `repo.path` (ex.: `/Users/x/My Repo (work)`) produzem destinos válidos sem quebra. Normalização final é responsabilidade do `SymlinkManager` (AC#15 da 004); o adapter só não corrompe os strings.

## Risks & assumptions

- **RESOLVED #1 — Path canônico de skills/agents do Copilot.**
  - **Skill personal:** `~/.copilot/skills/<slug>/` (dir-level com `SKILL.md` + assets opcionais dentro).
  - **Skill project:** `<repo>/.github/skills/<slug>/`.
  - **Agent personal:** `~/.copilot/agents/<slug>.agent.md` (file-level, extensão obrigatória).
  - **Agent project:** `<repo>/.github/agents/<slug>.agent.md`.
  - **Fontes:** [Use custom instructions in VS Code](https://code.visualstudio.com/docs/copilot/customization/custom-instructions); [Custom chat modes (Custom Agents)](https://code.visualstudio.com/docs/copilot/customization/custom-chat-modes); [Agent Skills land in VS 2026 18.5](https://startdebugging.net/2026/04/visual-studio-2026-copilot-agent-skills/); [Customize AI in VS Code overview](https://code.visualstudio.com/docs/copilot/customization/overview).
- **RESOLVED #2 — Granularidade de `skill` no Copilot:** **dir-level** confirmado pela spec aberta agentskills.io ("each skill is a folder containing `SKILL.md`"). Mesmo padrão do Claude (005). Symlink aponta para o diretório, não para o `SKILL.md`.
- **RESOLVED #3 — Convenção Copilot para "agent":** **existe** (Custom Agents). Extensão obrigatória `.agent.md`; setting `chat.agentFilesLocations` análogo ao de instructions; frontmatter inclui `target: vscode | github-copilot`. **Não** devolver `[]`.
- **ASSUMPTION:** Source canônico de `agent` no workspace é file-level (`<workspace>/agents/<slug>.md`), seguindo o que a 005 estabeleceu para Claude (`~/.claude/agents/<slug>.md`). Se a 003/006 introduzir source dir-level para agent, o adapter precisa ajustar o symlink target — flag em revisão da 005/006 antes de Phase 1.
- **ASSUMPTION:** O recorte "apenas vscode" da 014 vale para a 007 — outros editores Copilot ficam como débito pós-spike. Reconfirmado em "Non-goals".
- **ASSUMPTION:** `settings.adapters.copilot.enabled` continua sendo o gating binário por adapter (sem granularidade por type) — coerente com 005 e a port `Adapter` da 004.
- **RISCO médio:** Copilot pode renomear/reestruturar paths entre versões (já aconteceu — confirmado pelo histórico da 014; e Custom Agents migrou de `.chatmode.md` para `.agent.md` recentemente). **Mitigação:** falha de path produz `SyncResult.status: "error"` via `SymlinkManager`, não crash. Smoke test manual (Phase Verification) deve confirmar que symlinks criados são lidos pelo VS Code Copilot em sessão real.
- **RISCO baixo:** Symlink em `<repo>/.github/skills/` ou `<repo>/.github/agents/` pode ser commitado por `git add` no repo do usuário (mesmo aviso da 002 ARCH §6.6). **Mitigação:** modal de aviso da 002 já cobre; nenhuma ação adicional.
- **DEBT consciente:** suporte a outros editores Copilot (intellij, vim, emacs); revisitar em retro pós-spike se aparecer demanda.
- **DEBT (achado smoke 2026-05-03):** com Claude e Copilot habilitados simultaneamente, skills/agents aparecem **duplicados** na paleta do VS Code Copilot. Causa raiz é externa ao app: VS Code Copilot escaneia 6 well-known locations no nível personal (`~/.copilot/skills/`, `~/.claude/skills/`, `~/.agents/skills/`) e 3 no workspace (`.github/skills/`, `.claude/skills/`, `.agents/skills/`) sem dedup ([doc oficial](https://code.visualstudio.com/docs/copilot/customization/agent-skills)). Não há setting que desligue paths individuais — `chat.agentSkillsLocations` só **adiciona** caminhos. Como `~/.claude/skills/` (escrito pelo `ClaudeAdapter`) já é varrido pelo Copilot, o `~/.copilot/skills/` (escrito pelo `CopilotAdapter`) é redundante quando Claude está habilitado. **Decisão (2026-05-03):** manter 007 como está (AC#2-5 cumpridas literalmente, smoke valida AC#12); abrir spec **015** para uma flag `adapters.copilot.exclusiveWithClaude` no `Settings` que faça o `CopilotAdapter` pular `skill`/`agent` quando Claude estiver habilitado. Não bloqueia fechamento da 007.

## References

- [PRD.md §4](../../PRD.md) — must-have "Sync via symlink to Copilot, personal e project".
- [ARCH.md §5.3](../../ARCH.md) — `CopilotAdapter` na tabela de Main services.
- [ARCH.md §7.4](../../ARCH.md) — Symlink destinations layout.
- [ARCH.md §6.4](../../ARCH.md) — Geração de `copilot-instructions.md` (separação de responsabilidades vs. esta spec).
- [ARCH.md §9 ADR-13](../../ARCH.md) — Layering hexagonal leve.
- [ARCH.md §9 ADR-29](../../ARCH.md) — `scope: project + linkedRepos: []` produz `SyncResult { skipped: "no-linked-repos" }` no `AdapterManager`.
- [Spec 004](../004-symlink-sync-core/SPEC.md) — port `Adapter`, `AdapterManager`, `SymlinkManager`.
- [Spec 005](../005-claude-adapter/SPEC.md) — `ClaudeAdapter` (referência de padrão para a 007).
- [Spec 006](../006-multi-scope-artifacts/SPEC.md) — `Artifact.frontmatter.scopes: ArtifactScope[]`.
- [Spec 014](../014-global-instructions/SPEC.md) — stub do `CopilotAdapter` que esta spec estende.
- ROADMAP — `007-copilot-adapter` em "Later → Must-have remaining".
- [VS Code — Use custom instructions](https://code.visualstudio.com/docs/copilot/customization/custom-instructions) — paths e setting `chat.instructionsFilesLocations`.
- [VS Code — Custom chat modes / Custom Agents](https://code.visualstudio.com/docs/copilot/customization/custom-chat-modes) — convenção `.agent.md` e `chat.agentFilesLocations`.
- [VS 2026 — Agent Skills auto-discovery](https://startdebugging.net/2026/04/visual-studio-2026-copilot-agent-skills/) — 6 well-known locations (`~/.copilot/skills/`, `.github/skills/` etc.) e estrutura `<slug>/SKILL.md`.
- [VS Code — Customize AI overview](https://code.visualstudio.com/docs/copilot/customization/overview) — visão geral dos 4 tipos (instructions, prompts, agents, skills).

## Bookkeeping notes

- 3 `[NEEDS CLARIFICATION]` resolvidos em 2026-05-03 via WebFetch contra docs oficiais VS Code/Copilot (ver Risks `RESOLVED #1-3` e References). Spec liberada para `draft` → `active` assim que a 014 atingir `review`.
- Confirmar com 005/003/006 a forma do source canônico de `agent` no workspace (ver ASSUMPTION em Risks) antes de Phase 1. Se for dir-level, ajustar AC#4-5 para apontar para `<workspace>/agents/<slug>/AGENT.md` (ou similar).
- Ao fechar a 007 (Phase Bookkeeping), atualizar:
  - ARCH §5.3: linha `CopilotAdapter` reflete "stub introduzido pela 014, expandido pela 007 para skill/agent".
  - ARCH §7.4: adicionar linhas para destinos Copilot de skill/agent (caminho conforme decisão).
  - ROADMAP linha `007-copilot-adapter` Status `—` → `review` (defasagem de uma fase, conforme CLAUDE.md).
  - Verificar se a description da linha `007-copilot-adapter` no ROADMAP precisa refletir "Depends on 014" (ajuste já previsto pelo bookkeeping da 014).
- Avaliar promoção a ADR formal em ARCH §9:
  - **stub-adapter pattern** (CopilotAdapter introduzido como stub na 014, completado pela 007) caso o padrão se mostre reutilizável;
  - decisão final de path canônico de skills/agents no Copilot, se for estrutural.
- Abrir **spec 015** para a flag `adapters.copilot.exclusiveWithClaude` (ver DEBT acima). Escopo proposto: novo bool em `Settings.adapters.copilot` (default `false` para preservar comportamento atual), wiring no `AdapterManager`/`CopilotAdapter` para devolver `[]` em `skill`/`agent` quando flag ativa **e** Claude estiver habilitado, UI checkbox em Settings, testes de regressão. Abrange **personal e project** (Copilot varre `~/.copilot/`, `~/.claude/`, `~/.agents/` no nível personal e `.github/skills/`, `.claude/skills/`, `.agents/skills/` no workspace). **Caveat agent:** Custom Agents do Copilot exigem extensão `.agent.md`; o `ClaudeAdapter` escreve `.md` puro, então provavelmente Copilot **não** indexa agents do Claude como Custom Agent — flag deve cobrir só `skill`, ou validar via smoke da 015 se Copilot aceita `.md` em paths `agents/` antes de incluir.
