---
id: "014"
title: Global instructions
status: done
priority: later
created_at: 2026-04-29
updated_at: 2026-05-03
depends_on: ["005"]
labels: [must-have, adapter, core]
related_prd: "§4"
related_arch: "§5.3, §7.4, §8.4, §9 ADR-32"
---

# 014 — Global instructions

## What

Introduz o artifact type `global-instruction` para sincronizar os arquivos pessoais de instruções globais das duas ferramentas: `~/.claude/CLAUDE.md` (Claude) e `~/.copilot/instructions/global.instructions.md` (Copilot — VS Code user-level, lido via convenção `.instructions.md` documentada pela Microsoft).

O type tem **slug fixo** (`claude` | `copilot`) e **scope sempre `personal`** — single-instance enforced via slug enum + collision rejection herdada da 003 (ADR-21). Storage em `<workspace>/global-instructions/<slug>.md`, file-level. Versionado em git como qualquer outro artifact.

A spec **estende** o `ClaudeAdapter` (entregue na 005) para resolver o destino do slug `claude` e **introduz** um stub `CopilotAdapter` que satisfaz a port `Adapter` da 004 cobrindo apenas o slug `copilot`; demais types/slugs devolvem `[]` (a 007 preenche o resto sem mudar o shape do adapter).

Sync usa a pipeline existente: `ArtifactService.save` → `AdapterManager` → adapter resolve destino → `SymlinkManager` cria symlink. Fluxo de conflito em ARCH §6.2 cobre o caso do usuário já ter conteúdo real em `~/.claude/CLAUDE.md` (backup automático em `<workspace>/_backups/<timestamp>/`).

## Why

ADR-32 (ARCH §9) admitiu instruções pessoais globais no escopo do spike. Cobrir essa categoria é coerente com a hipótese do PRD ("centralizar contexto AI vale a pena"): instruções globais são o exemplo mais óbvio de contexto AI fora do workspace — hoje o usuário edita `~/.claude/CLAUDE.md` direto no disco, sem versionamento, sem template e sem sync entre máquinas via git.

ROADMAP define 014 como must-have remanescente. Com a inversão de dependência (007 depende de 014, não o contrário), a 014 é o ponto onde o stub do `CopilotAdapter` aparece — a 007 estende esse stub para skills/agents/references depois.

ROADMAP declara `Depende de 005`, satisfeito (005 em `done`).

## Non-goals

- **Não cobrir editores Copilot além de `vscode`** — `intellij`, `vim`, `emacs` etc. ficam como débito pós-spike (Settings configurável ou auto-detect em iteração futura).
- **Não implementar `CopilotAdapter` completo** — apenas o stub para `global-instruction:copilot`. Sync de skills/agents/references via Copilot é a 007.
- **Não gerar `copilot-instructions.md`** (aggregation de references flagged) — spec 008.
- **Não implementar disable flow** específico para o type — a 009 cobre disable globalmente.
- **Não validar conteúdo Markdown** das instruções — só shape do frontmatter.
- **Não sincronizar para escopos `project`** — instruções globais são por definição pessoais; `scope: project` é rejeitado em validação. Instruções por projeto (`<repo>/.claude/CLAUDE.md`) são conceito diferente, fora desta spec.
- **Não pré-seedar artifacts no primeiro uso** — usuário cria sob demanda, simétrico a skills/agents/references. Template cobre o blank-page.

## In scope

- **Schema do artifact type** — adicionar `"global-instruction"` ao enum `ArtifactType` em `src/main/domain/artifact.ts` (atualmente `skill | reference | agent`). Validação extra em `ArtifactService.save`:
  - `slug` ∈ `{ "claude", "copilot" }` — caso contrário, `DomainError({ kind: "validation", details: { reason: "global-instruction-slug-not-allowed" } })`.
  - `scopes` exatamente `["personal"]` — caso contrário, `DomainError({ kind: "validation", details: { reason: "global-instruction-scope-must-be-personal" } })`.
- **Storage layout** — `<workspace>/global-instructions/<slug>.md` (file-level). Atualizar `FsArtifactRepository` para mapear o type ao subdiretório `global-instructions/`.
- **Templates** — `src/main/templates/global-instruction-claude.md` e `src/main/templates/global-instruction-copilot.md` com cabeçalho explicativo + 2-3 bullets de exemplo. `TemplateService.list({ type: "global-instruction" })` devolve esses dois.
- **Extensão de `ClaudeAdapter`** (`src/main/infrastructure/adapters/claude-adapter.ts`) — branch `type === "global-instruction"`:
  - `slug === "claude"`: devolve `[{ scope: "personal", destination: path.join(this.homedir, ".claude/CLAUDE.md") }]`.
  - Caso contrário (slug `copilot` chegando no Claude adapter): `[]`.
- **Novo `CopilotAdapter`** stub (`src/main/infrastructure/adapters/copilot-adapter.ts`) implementando port `Adapter`:
  - `adapterId === "copilot"`.
  - `resolveDestinations({ artifact, linkedRepos })`:
    - `type === "global-instruction" && slug === "copilot"`: devolve `[{ scope: "personal", destination: path.join(this.homedir, ".copilot/instructions/global.instructions.md") }]`.
    - Demais combinações (incluindo `type: "global-instruction" + slug: "claude"`, `type: "skill"`, `type: "agent"`, `type: "reference"`): `[]`.
  - Construtor recebe `{ homedir: string }` e valida não-vazio (mesmo padrão da 005 — lança `DomainError({ kind: "internal", details: { reason: "missing-homedir" } })`).
- **Wiring** em `src/main/index.ts` — registrar `["copilot", new CopilotAdapter({ homedir: os.homedir() })]` na map do `AdapterManager`. `ClaudeAdapter` já está registrado pela 005.
- **UI** — nova seção "Global Instructions" no sidebar de artifacts. Botão "+ New" abre modal com seleção de slug (`claude` | `copilot`) e aplica template correspondente.
- **Conflito no destino** — primeiro save de `global-instruction:claude` (com `~/.claude/CLAUDE.md` real preexistente) cai no fluxo ARCH §6.2 — `SyncResult.status = "conflict"` + backup em `<workspace>/_backups/<timestamp>/`. Sem mudança no fluxo: revalidar via teste integração com fixture preexistente.
- **Testes** —
  - Unit: `ArtifactService` rejeita slug fora do enum para `global-instruction`.
  - Unit: `ArtifactService` rejeita `scopes` ≠ `["personal"]` para `global-instruction`.
  - Unit: `TemplateService.list({ type: "global-instruction" })` devolve 2 templates com slugs corretos.
  - Unit: contract test de `Adapter` (da 004) executado contra `CopilotAdapter`.
  - Unit: `ClaudeAdapter` resolve destino esperado para `global-instruction:claude` e `[]` para `global-instruction:copilot`.
  - Unit: `CopilotAdapter` resolve destino esperado para `global-instruction:copilot` e `[]` para `global-instruction:claude`, `skill`, `agent`, `reference`.
  - Unit: paths com espaços/acentos em `homedir` simulado produzem destinos absolutos.
  - Unit: construtor de `CopilotAdapter` lança quando `homedir` é vazio/null/undefined.
  - Integração: e2e save de `global-instruction:claude` produz symlink em `<homedir>/.claude/CLAUDE.md` apontando para `<workspace>/global-instructions/claude.md` (sobre `InMemoryFilesystem`).
  - Integração: e2e save de `global-instruction:copilot` produz symlink em `<homedir>/.copilot/instructions/global.instructions.md` apontando para `<workspace>/global-instructions/copilot.md`.
  - Integração: e2e save com `~/.claude/CLAUDE.md` real preexistente produz `SyncResult.status: "conflict"` + backup em `_backups/<timestamp>/.claude/CLAUDE.md`.

## Out of scope

- Suporte a `~/.config/github-copilot/intellij/`, `vim/`, `emacs/` e outros editores → débito pós-spike.
- `CopilotAdapter` completo para skills/agents/references → spec 007.
- `CopilotInstructionsGen` (aggregation de references flagged) → spec 008.
- Disable flow + cleanup de symlinks → spec 009.
- Migração assistida de `~/.claude/CLAUDE.md` preexistente para o workspace (importação manual via copy-paste fora do app).
- Versionamento manual em git de `<workspace>/global-instructions/` → fluxo padrão do workspace; nada novo aqui.

## Considered alternatives

| Decisão | Escolhida | Alternativas descartadas | Motivo |
|---|---|---|---|
| Modelo de dados | **Novo artifact type `global-instruction`** com slug fixo e single-instance via collision rejection (ADR-21) | (b) `GlobalInstructionsService` dedicado paralelo a `ArtifactService`; (c) extensão da port `Adapter` com método `resolveGlobalInstructionsDestinations` | Reusa CRUD/save/sync/symlink/git; nenhum caminho paralelo; "single-instance via slug enum" cabe em ~3 linhas de validação. Service paralelo dobra superfície (UI, IPC, persistence). Capability extra na port quebra simetria com a 004 sem ganho. |
| Slug | **Fixo (`claude`, `copilot`) validado em `ArtifactService.save`** | (b) Slug livre + flag `singleInstance: true`; (c) UUID gerado | Slug = adapterId fica auto-documentado e roteia direto entre adapters (ClaudeAdapter ignora slug `copilot` e vice-versa). UUID quebra path canônico (ADR-20). Flag separada cria estado redundante. |
| Scope permitido | **Apenas `personal`** | (b) `personal` + `project` via slug por repo (ex.: `claude-<repo>`); (c) também aceitar `project` mas sincar para `<repo>/.claude/CLAUDE.md` em cada linkedRepo | Instruções globais são por definição pessoais; `<repo>/.claude/CLAUDE.md` é instrução **de projeto**, conceito diferente. Misturar produz ambiguidade semântica. Forçar enum no save evita configuração inválida. |
| Editor Copilot | **Apenas `vscode` no spike** | (b) Auto-detect dos editores presentes em `~/.config/github-copilot/`; (c) Settings configurável com lista de editores | Spike é dogfooding com 1 editor primário; auto-detect adiciona varredura de FS no resolve sem demanda comprovada; Settings configurável arrasta UI e migration. Múltiplos editores fica como débito explícito. |
| Forma do `CopilotAdapter` na 014 | **Stub completo da port `Adapter`** com demais types devolvendo `[]` | (b) Adicionar capability "global-only" na port; (c) Esperar a 007 e mover a lógica pra lá | Stub mantém o shape estável (port não muda); 007 estende sem rebuild. Capability nova quebra a port pra atender 1 caso. Esperar a 007 atrasa entrega da 014 sem ganho técnico. |
| Pré-seeding | **Não pré-seedar — criação sob demanda** | (b) Criar os 2 artifacts no onboarding (002); (c) Criar lazy no primeiro acesso à seção UI | Pré-seed força usuário a lidar com 2 arquivos vazios antes de querer; criação on-demand alinha com skills/agents/references. Template cobre blank-page (PRD §4). |
| Conflito com `~/.claude/CLAUDE.md` preexistente | **Reusar fluxo §6.2** — backup automático, `SyncResult.status: "conflict"`, modal pós-save | (b) Ler conteúdo do FS e popular o artifact no save; (c) Forçar usuário a renomear/mover manualmente antes do primeiro save | Fluxo §6.2 é o padrão da app — não inventa caminho especial. (b) inverte sentido do source-of-truth (PRD: workspace é fonte única). (c) é UX hostil. |

## Acceptance criteria

1. Enum `ArtifactType` em `src/main/domain/artifact.ts` (ou path canônico equivalente) inclui `"global-instruction"`. Verificável por unit test importando o enum e asserindo a presença do valor.
2. `ArtifactService.save` rejeita artifact com `type: "global-instruction"` e `slug` ∉ `{ "claude", "copilot" }` lançando `DomainError({ kind: "validation", details: { reason: "global-instruction-slug-not-allowed" } })`. Verificável por unit test cobrindo `slug: "foo"`, `slug: "Claude"` (case-sensitive), `slug: ""`.
3. `ArtifactService.save` rejeita artifact com `type: "global-instruction"` e `scopes` ≠ `["personal"]` lançando `DomainError({ kind: "validation", details: { reason: "global-instruction-scope-must-be-personal" } })`. Verificável por unit test cobrindo `scopes: ["project"]`, `scopes: ["personal", "project"]`, `scopes: []`.
4. `ArtifactService.save` aceita `{ type: "global-instruction", slug: "claude", scopes: ["personal"] }` e persiste em `<workspace>/global-instructions/claude.md`. Equivalente para `slug: "copilot"` em `<workspace>/global-instructions/copilot.md`. Verificável por integração com `FsArtifactRepository`.
5. `TemplateService.list({ type: "global-instruction" })` devolve exatamente 2 templates com IDs/slugs `claude` e `copilot`, cada um com conteúdo não-vazio (`content.length > 0`). Verificável por unit test.
6. `ClaudeAdapter.resolveDestinations({ artifact: { type: "global-instruction", slug: "claude", scopes: ["personal"] }, linkedRepos: [] })` devolve **exatamente um destino** com `scope: "personal"` e `destination` igual a `path.join(homedir, ".claude/CLAUDE.md")`. Verificável por unit test.
7. `ClaudeAdapter.resolveDestinations({ artifact: { type: "global-instruction", slug: "copilot", ... }, ... })` devolve `[]`. Verificável por unit test.
8. `CopilotAdapter` exporta uma classe que satisfaz a port `Adapter` da 004 com `adapterId === "copilot"` e `resolveDestinations({ artifact, linkedRepos })` (verificável pelo contract test da port reaproveitado).
9. `CopilotAdapter.resolveDestinations({ artifact: { type: "global-instruction", slug: "copilot", scopes: ["personal"] }, linkedRepos: [] })` devolve **exatamente um destino** com `scope: "personal"` e `destination` igual a `path.join(homedir, ".copilot/instructions/global.instructions.md")`. Verificável por unit test.
10. `CopilotAdapter.resolveDestinations` devolve `[]` para qualquer combinação fora de (`type: "global-instruction", slug: "copilot"`): testar com `type: "skill"`, `type: "agent"`, `type: "reference"`, e `type: "global-instruction" + slug: "claude"`. Verificável por unit tests parametrizados.
11. Construtor de `CopilotAdapter` lança `DomainError({ kind: "internal", details: { reason: "missing-homedir" } })` quando `homedir` é `undefined`, `null` ou string vazia. Verificável por unit test invocando os 3 casos.
12. Em `src/main/index.ts`, `CopilotAdapter` é registrado na map do `AdapterManager` com chave `"copilot"`. Verificável: ao iniciar o app com `settings.adapters.copilot.enabled === true`, `AdapterManager.syncAll` para um artifact `global-instruction:copilot` produz um `SyncResult` com `adapter: "copilot"` e `status: "ok"`.
13. Save end-to-end de `global-instruction:claude` com Claude habilitado, sobre `InMemoryFilesystem` (fixture da 004), produz no FS fake um symlink em `<homedir>/.claude/CLAUDE.md` cujo `readlink` resolve para `<workspace>/global-instructions/claude.md`. Verificável por teste integração.
14. Save end-to-end de `global-instruction:copilot` com Copilot habilitado, sobre `InMemoryFilesystem`, produz no FS fake um symlink em `<homedir>/.copilot/instructions/global.instructions.md` cujo `readlink` resolve para `<workspace>/global-instructions/copilot.md`. Verificável por teste integração.
15. Save end-to-end de `global-instruction:claude` com `<homedir>/.claude/CLAUDE.md` preexistente como **arquivo real** (não symlink) sobre `InMemoryFilesystem` produz `SyncResult.status: "conflict"` com `details.action: "overwritten"` e backup em `<workspace>/_backups/<timestamp>/.claude/CLAUDE.md` contendo o conteúdo original. Verificável por teste integração reusando garantia do `SymlinkManager` (AC# da 004).
16. Todos os destinos retornados por `ClaudeAdapter` e `CopilotAdapter` para `global-instruction` são absolutos (`path.isAbsolute(d.destination) === true`). Verificável por asserção em todos os testes acima.

## Risks & assumptions

- `RESOLVED` (T001, 2026-04-29) — path canônico do Copilot user-level no VS Code é `~/.copilot/instructions/<filename>.instructions.md` (diretório lido recursivamente, arquivos com extensão `.instructions.md`). Path antigo da spec (`~/.config/github-copilot/vscode/global-copilot-instructions.md`) era um híbrido inválido — `~/.config/github-copilot/global-copilot-instructions.md` (sem `vscode/`) é convenção do plugin JetBrains do Copilot, não reconhecida pelo VS Code mesmo via `chat.instructionsFilesLocations`. AC#9 e AC#14 atualizados para `~/.copilot/instructions/global.instructions.md`. Fontes: [VS Code docs — custom instructions](https://code.visualstudio.com/docs/copilot/customization/custom-instructions); [GitHub community #180523](https://github.com/orgs/community/discussions/180523).
- `RISCO` — usuário já tem `~/.claude/CLAUDE.md` com conteúdo substantivo. Primeiro save vai disparar fluxo §6.2 (backup + conflict). **Mitigação:** smoke test manual (T031) deve confirmar que o conteúdo original foi preservado em `_backups/` antes do overwrite; comparar hashes.
- `RISCO` — Copilot pode mudar o nome ou path do arquivo de instruções globais entre versões; estabilidade aceita como débito do spike (PRD §7). Falha de path produz `SyncResult.status: "error"`, não crash.
- `DEBT` — suporte a múltiplos editores Copilot (jetbrains, vim, emacs) fica explicitamente fora; revisitar em retro pós-spike se aparecer demanda.
- `ASSUMPTION` — `scopes: ["personal"]` é a única forma multi-scope válida para o type; se no futuro aparecer demanda para `project` (ex.: `<repo>/.claude/CLAUDE.md` como instrução de projeto), abrir nova spec — não reabrir a 014.

## References

- [PRD.md §4](../../PRD.md) — must-have "Sync via symlink to Claude Code and Copilot, personal e project". Atualizar para incluir global instructions explicitamente (T033).
- [ARCH.md §5.3](../../ARCH.md) — `ClaudeAdapter` e (futuro) `CopilotAdapter` na tabela de Main services.
- [ARCH.md §7.2, §7.4](../../ARCH.md) — Workspace layout e Symlink destinations. Esta spec adiciona linha para `global-instructions/`.
- [ARCH.md §8.4](../../ARCH.md) — frontmatter schema. `type: global-instruction` adiciona ao enum.
- [ARCH.md §9 ADR-32](../../ARCH.md) — Decisão de incluir global instructions no spike; abordagem técnica detalhada nesta spec.
- [Spec 003](../003-artifact-crud/spec.md) — Artifact shape (`type`, `slug`, `scopes`), validação no save, collision rejection (ADR-21).
- [Spec 004](../004-symlink-sync-core/spec.md) — port `Adapter`, `AdapterManager`, `SymlinkManager`, fluxo §6.2 (backup), ADR-29.
- [Spec 005](../005-claude-adapter/spec.md) — `ClaudeAdapter` extension target.
- [Spec 006](../006-multi-scope-artifacts/spec.md) — `scopes: ArtifactScope[]` (esta spec usa `scopes: ["personal"]`).
- Claude Code custom instructions (a verificar via Context7/WebFetch antes de implementar): canonical path `~/.claude/CLAUDE.md`.
- [VS Code Copilot custom instructions](https://code.visualstudio.com/docs/copilot/customization/custom-instructions) — confirmação T001: user-level reside em `~/.copilot/instructions/` (directory lido recursivamente, arquivos `.instructions.md`).

## Bookkeeping notes

- Ao fechar a 014 (Phase Bookkeeping), atualizar:
  - PRD §4 must-have: explicitar "global instructions (Claude `CLAUDE.md` e Copilot `global.instructions.md` em `~/.copilot/instructions/`)".
  - ARCH §7.2: adicionar `global-instructions/<slug>.md` ao layout.
  - ARCH §7.4: adicionar linhas para `<workspace>/global-instructions/<slug>.md` → destinos no Claude e Copilot.
  - ARCH §8.4: incluir `global-instruction` no enum de `type`; documentar restrições (slug fixo, scope `personal` only).
  - ARCH §5.3: linha `CopilotAdapter` reflete "stub introduzido pela 014, expandido pela 007".
  - ROADMAP linha `014-global-instructions` Status `—` → `review` (defasagem de uma fase, conforme CLAUDE.md).
  - ROADMAP linha `007-copilot-adapter` description: refletir que `CopilotAdapter` já existe como stub e a 007 estende; ajustar dependência (`Depends on 014`).
- Avaliar promoção a ADR formal em ARCH §9 do **stub-adapter pattern** (CopilotAdapter introduzido como stub na 014, completado pela 007) caso o padrão se mostre reutilizável.
- Avaliar promoção a ADR formal de **single-instance type via slug enum** (regra é genérica e pode aplicar a futuros types — ex.: `dotfile`).
