---
id: "015"
title: Copilot exclusive skills (dedup com Claude)
status: draft
priority: later
created_at: 2026-05-03
updated_at: 2026-05-03
depends_on: ["007"]
labels: [should-have, adapter, ui]
related_prd: "§4"
related_arch: "§5.3, §7.4"
branch: ""
---

# 015 — Copilot exclusive skills (dedup com Claude)

## What

Introduz uma flag de usuário `adapters.copilot.exclusiveSkillsWithClaude` (default `false`) que, quando ativa **e** `adapters.claude.enabled === true`, faz o `CopilotAdapter` devolver `[]` para `artifact.type === "skill"` (e potencialmente `agent` — ver Risks). O objetivo é evitar a duplicação observada no VS Code Copilot quando os symlinks da skill aparecem em paths varridos por **ambos** os adapters (`~/.copilot/skills/` + `~/.claude/skills/` no nível personal; `<repo>/.github/skills/` + `<repo>/.claude/skills/` no nível project). Não altera comportamento do `ClaudeAdapter`, nem dos branches `global-instruction` e `reference` do `CopilotAdapter`.

## Why

Smoke da 007 (2026-05-03) confirmou que o VS Code Copilot escaneia 6 well-known locations de skills sem dedup (3 personal + 3 project, conforme [doc oficial](https://code.visualstudio.com/docs/copilot/customization/agent-skills)). Como `~/.claude/skills/` e `<repo>/.claude/skills/` estão no scan list do Copilot e o `ClaudeAdapter` (005) já escreve neles, escrever **também** em `~/.copilot/skills/` e `<repo>/.github/skills/` é redundante quando Claude está habilitado — Copilot lista a mesma skill duas vezes na paleta. A 007 entrega AC#2-5 corretamente; o problema é cross-adapter, não bug interno. Esta spec endereça a UX sem reescrever 007.

## Non-goals

- Não alterar o comportamento do `ClaudeAdapter`.
- Não alterar `global-instruction` nem `reference` no `CopilotAdapter` — eles seguem sem flag.
- Não desligar adapters por type globalmente — flag é específica para skill (e talvez agent), e só ativa quando Claude está habilitado.
- Não implementar setting do VS Code via API do Copilot — flag vive **só** no app, controla o que escrevemos no FS.
- Não cobrir editores Copilot além de `vscode` (mesma fronteira da 007/014).
- Não migrar usuários existentes automaticamente (manter default `false` evita regressão).

## In scope

- Adicionar `exclusiveSkillsWithClaude: boolean` (ou nome final TBD) em `Settings.adapters.copilot` com default `false`.
- Wiring: `CopilotAdapter` recebe acesso ao settings (via construtor ou via parâmetro de `resolveDestinations`) para checar a flag e o estado do Claude. Decisão de wiring entre construtor vs. parâmetro: ver Considered alternatives.
- Quando flag `true` **e** `claude.enabled === true` **e** `type === "skill"` → `resolveDestinations` retorna `[]` (em ambos scopes: personal e project).
- UI: checkbox em Settings sob a seção do Copilot, com tooltip explicando o motivo (evitar duplicação no VS Code Copilot quando Claude também está habilitado).
- Migração: settings antigas (sem o campo) carregam como `false` — backward-compatible.
- Cleanup: ao **ligar** a flag, symlinks já criados em `~/.copilot/skills/` e `<repo>/.github/skills/` ficam órfãos; spec 015 trata via `AdapterManager.removeAll`/`removeOne` quando flag muda — ver Risks & assumptions.
- Testes:
  - Unit: `CopilotAdapter` com flag `true` + Claude on → `[]` para skill personal/project.
  - Unit: flag `true` + Claude `off` → comportamento atual (sem dedup; AC#2-5 da 007 valem).
  - Unit: flag `false` (default) → comportamento atual (007 inalterado).
  - Integração: e2e via `AdapterManager.syncOne` com flag toggling — confirmar que destinos Copilot somem do `SyncResult[]`.
  - Regressão: smoke manual VS Code Copilot — uma skill com flag ON aparece **uma vez** na paleta.

## Out of scope (deferred)

- Mesma flag para `agent` — se Copilot **não** indexa `.md` puro do Claude como Custom Agent (Custom Agents exigem `.agent.md`), agent **não** sofre dedup; flag pode ficar irrelevante. **[NEEDS CLARIFICATION]**: validar via smoke antes de incluir agent no escopo desta spec ou abrir 016.
- Setting análogo invertido (`adapters.claude.exclusiveWithCopilot`) — usuário que prefere Copilot como source-of-truth. Não há demanda registrada; deferir.
- Setting per-artifact ("essa skill é exclusiva do Copilot") — granularidade excessiva para o spike.
- Cleanup automático ao **desligar** a flag (recriar symlinks em `~/.copilot/skills/`) — coberto por `AdapterManager.syncAll` chamado após mudança de settings; sem trabalho extra desde que o handler de settings dispare resync.

## Considered alternatives

| Decisão | Escolhida | Alternativas descartadas | Motivo |
|---|---|---|---|
| Local da flag | **`Settings.adapters.copilot.exclusiveSkillsWithClaude`** | (b) Setting global `adapters.dedupSkills`; (c) Per-adapter pair (`copilot.exclusiveWith: ["claude"]`) | (b) confunde escopo: a flag é cross-adapter mas a leitura natural é "do lado do Copilot". (c) over-engineered para um pair único hoje. |
| Forma de ler claude.enabled no CopilotAdapter | **[NEEDS CLARIFICATION]** — via construtor (`CopilotAdapter` ganha `settingsService` injetado) **ou** via parâmetro novo de `resolveDestinations({ artifact, linkedRepos, peerAdapters })` | (b) `AdapterManager` filtra o `SyncResult[]` posterior — feio, ignora a port; (c) ambos adapters compartilham bus de eventos | Decisão de wiring impacta a port `Adapter`. Resolver antes de Phase 1. |
| Default da flag | **`false`** (preserva 007) | (b) `true` por default | Mudar default vira breaking change para usuários que esperam ambos paths. `false` é seguro. |
| Cobertura `agent` | **[NEEDS CLARIFICATION]** — depende da smoke confirmar se Copilot lê `.md` em paths `agents/` do Claude | (b) Incluir agent na flag desde já; (c) Excluir explicitamente | Custom Agents exigem `.agent.md`; Claude usa `.md` puro. Provavelmente Copilot ignora; precisa verificar. |

## Acceptance criteria

1. `Settings.adapters.copilot` ganha campo `exclusiveSkillsWithClaude: boolean` com default `false`. `SettingsService.load()` retorna o default quando o campo está ausente nas settings persistidas (backward-compat).
2. `CopilotAdapter.resolveDestinations` retorna `[]` para `type === "skill"` quando a flag é `true` **e** `adapters.claude.enabled === true`. Verificável por unit test em ambos scopes (personal e project).
3. `CopilotAdapter.resolveDestinations` retorna o comportamento da 007 (AC#2/AC#3) quando a flag é `false` **ou** `claude.enabled === false`. Verificável por unit test.
4. `global-instruction:copilot` e `reference` continuam inalterados em qualquer combinação de flag + claude.enabled. Regressão da 014/007.
5. UI: Settings tem checkbox "Skip Copilot skills when Claude is enabled (avoids duplicates in VS Code Copilot)" sob a seção Copilot. Marcar/desmarcar persiste em settings e dispara `AdapterManager.syncAll` para reconciliar o FS.
6. e2e: flag toggling em runtime com 1 skill personal salva produz, no `InMemoryFilesystem`, criação/remoção do symlink em `~/.copilot/skills/<slug>` conforme estado da flag, sem afetar `~/.claude/skills/<slug>`.
7. Smoke manual: com Claude e Copilot habilitados, flag ON, 1 skill com `scopes: ["personal"]` salva — paleta do VS Code Copilot lista a skill **exatamente uma vez**.

## Risks & assumptions

- **ASSUMPTION:** flag controla apenas o que escrevemos no FS; não tenta editar `chat.agentSkillsLocations` do VS Code (que é setting do usuário, fora do escopo).
- **ASSUMPTION:** ao desligar a flag (ON → OFF), `AdapterManager.syncAll` é disparado pelo handler de settings e recria os symlinks sumidos em `~/.copilot/skills/`. Sem isso, o FS fica em estado intermediário até o próximo save.
- **ASSUMPTION:** ao ligar a flag (OFF → ON), os symlinks órfãos em `~/.copilot/skills/` e `<repo>/.github/skills/` precisam ser **removidos** ativamente. Caminhos:
  - (a) `AdapterManager.removeAll({ adapterId: 'copilot', types: ['skill'] })` chamado pelo handler de settings — exige extender a port se ainda não suportar filtragem por type.
  - (b) Aguardar o usuário deletar/re-saltar a skill — UX ruim, documentar.
  - **[NEEDS CLARIFICATION]:** decidir antes de Phase 1.
- **RISCO médio:** Copilot pode mudar a lista de scan paths em versões futuras (`~/.claude/skills/` poderia sair). **Mitigação:** flag é opt-in; usuário pode desligar. Smoke periódica confirma comportamento.
- **RISCO baixo:** usuário com Claude habilitado **mas** sem usar Claude na prática espera que skills apareçam no Copilot via `~/.copilot/skills/` (paths Copilot-only). Flag ON faz a skill sumir do scan path Copilot-only — mas Copilot ainda lê de `~/.claude/skills/`. **Mitigação:** tooltip da checkbox explicita "Claude paths cover Copilot too".
- **DEBT consciente:** sem dedup automático para `agent` até validar comportamento real do Copilot com `.md` puro do Claude (ver Out of scope).

## References

- [Spec 007](../007-copilot-adapter/SPEC.md) — `CopilotAdapter` para skill/agent; achado smoke 2026-05-03 que motivou esta spec.
- [Spec 005](../005-claude-adapter/SPEC.md) — `ClaudeAdapter` (paths `~/.claude/skills/`, `<repo>/.claude/skills/`).
- [Spec 014](../014-global-instructions/SPEC.md) — stub `CopilotAdapter` + global-instruction (intocado por esta spec).
- [Spec 002](../002-onboarding-settings/SPEC.md) — Settings model + UI (lugar onde a checkbox vai).
- [VS Code — Use Agent Skills](https://code.visualstudio.com/docs/copilot/customization/agent-skills) — paths varridos pelo Copilot, sem dedup.
- [ARCH.md §5.3](../../ARCH.md) — port `Adapter`; impacta a discussão "como CopilotAdapter lê estado de Claude".
- [PRD.md §4](../../PRD.md) — Sync Copilot/Claude.

## Bookkeeping notes

- Resolver `[NEEDS CLARIFICATION]` em "Out of scope" e em "Considered alternatives" antes de transicionar `draft` → `active`:
  1. Smoke: Copilot indexa `.md` puro de `~/.claude/agents/` como Custom Agent? Se não, agent fica fora da flag.
  2. Wiring: `CopilotAdapter` recebe `settingsService` injetado, ou `resolveDestinations` ganha parâmetro novo? Se ganhar parâmetro, port `Adapter` muda — exige spec/ADR cruzado.
  3. Cleanup ON-flip: `AdapterManager.removeAll` filtrável por type ou aceitar débito UX.
- Bookkeeping ao fechar:
  - PRD §4: registrar a flag como should-have entregue.
  - ARCH §5.3: nota sobre cross-adapter coupling controlado (CopilotAdapter ↔ Settings.adapters.claude.enabled).
  - ROADMAP linha `015-copilot-exclusive-skills`: adicionar (Status `—` → `review` ao fechar Phase Verification).
