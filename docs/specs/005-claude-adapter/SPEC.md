---
id: "005"
title: Claude adapter
status: done
priority: later
created_at: 2026-04-27
updated_at: 2026-04-29
depends_on: ["004"]
labels: [must-have, adapter, core]
related_prd: "§4"
related_arch: "§5.3, §7.4"
---

# 005 — Claude adapter

## What

Primeiro adapter de produção do `AdapterManager`: `ClaudeAdapter` é um módulo TypeScript no Main process (camada `infrastructure/adapters/`, ADR-13) que satisfaz a port `Adapter` entregue na 004 (`adapterId` + `resolveDestinations`). Mapeia artifacts do workspace para os caminhos que o Claude Code lê em runtime — `~/.claude/skills/<slug>/` e `~/.claude/agents/<slug>.md` no scope `personal`; `<repo>/.claude/skills/<slug>/` e `<repo>/.claude/agents/<slug>.md` no scope `project`, um destino por repo em `linkedRepos`. A 004 instanciou o `AdapterManager` com `adapters: new Map()` vazio; esta spec injeta `ClaudeAdapter` quando `settings.adapters.claude.enabled === true` ([src/main/index.ts:62](../../../src/main/index.ts#L62)). Não envolve rede, API, plugin/marketplace nem build — apenas resolução de paths e delegação ao `SymlinkManager` da 004.

## Why

PRD §4 marca "Sync via symlink to Claude Code, personal e project" como must-have, e ARCH §5.3 fixa o contrato do `ClaudeAdapter` (mapeia artifact → Claude paths; delega ao `SymlinkManager`; não toca em HTTP/API/tokens). A 004 está em `review` com `AdapterManager` orquestrando uma `Map<string, Adapter>` e port `Adapter` agnóstica entre Claude/Copilot — falta plugar o primeiro adapter real. Sem 005, nenhum artifact criado pela 003+004 chega de fato ao Claude Code; e 008 (disable adapter flow) precisa de pelo menos um adapter real para fazer sentido. ROADMAP declara `Depends on 004`, satisfeito com a 004 em `review` (Verification verde).

Ponto verificado contra a doc oficial do Claude Code (https://code.claude.com/docs/en/skills.md e .../sub-agents.md, consultado 2026-04-27): skills em `~/.claude/skills/<slug>/SKILL.md` e agents em `~/.claude/agents/<slug>.md` são descobertos automaticamente — não há requisito de wrapper de plugin/marketplace para uso pessoal.

## Non-goals

- **Não entregar `CopilotAdapter`** — spec 006.
- **Não entregar `CopilotInstructionsGen`** — spec 007 (agregação de references flagged).
- **Não cobrir disable flow** — varredura/limpeza ao desligar o adapter é spec 008.
- **Não fazer HTTP nem tocar na API do Claude** — não existe API de runtime; sync é puramente filesystem.
- **Não embrulhar em plugin do Claude Code** (`~/.claude/plugins/...`) — ARCH §7.4 fixa layout direto em `~/.claude/skills/` e `~/.claude/agents/`. Plugin/marketplace é mecanismo de distribuição alternativo, não pré-requisito de carregamento (verificado contra docs oficiais).
- **Não validar schema de frontmatter** além do que a 003 já valida — completo fica para 009 (`SchemaValidator`).
- **Não ler tokens (`ClaudeTokenParser`)** — nice-to-have da spec 011.
- **Não sincronizar `reference` para o Claude** — Claude Code não tem convenção nativa para "references"; references seguem para o Copilot via `copilot-instructions.md` na 007. Decisão registrada em "Considered alternatives".

## In scope

- `src/main/infrastructure/adapters/claude-adapter.ts` implementando a port `Adapter` (`adapterId: "claude"`, `resolveDestinations({ artifact, linkedRepos })`).
- Resolução de destinos por `(type, scope)`:
  - `skill` + `personal` → 1 destino: `<homedir>/.claude/skills/<slug>/` (target = diretório no workspace).
  - `skill` + `project` → 1 destino por repo em `linkedRepos`: `<repo.path>/.claude/skills/<slug>/`.
  - `agent` + `personal` → 1 destino: `<homedir>/.claude/agents/<slug>.md` (target = arquivo no workspace).
  - `agent` + `project` → 1 destino por repo em `linkedRepos`: `<repo.path>/.claude/agents/<slug>.md`.
  - `reference` → array vazio (no-op silencioso; ver "Considered alternatives").
- Expansão de `~` via `os.homedir()` dentro do adapter antes de devolver os destinos. `path.resolve` do Node **não** expande `~`; manter expansão na fronteira do adapter mantém os strings devolvidos absolutos e prontos para o `SymlinkManager`.
- Validação do `homedir` no construtor de `ClaudeAdapter`: se `homedir` for `undefined`, `null` ou string vazia (ambiente degradado sem `HOME`), lançar `DomainError({ kind: "internal", details: { reason: "missing-homedir" } })` na construção. Falha construtiva — adapter nunca é registrado no `AdapterManager` se o ambiente não suporta resolução de path personal.
- Wiring em [src/main/index.ts:62](../../../src/main/index.ts#L62): substituir `adapters: new Map()` por uma factory que injeta `new ClaudeAdapter({ homedir: os.homedir() })` na map. Gating por `settings.adapters.claude.enabled` continua sendo responsabilidade do `AdapterManager` (já implementado na 004 — [src/main/application/services/adapter-manager.ts:95-97](../../../src/main/application/services/adapter-manager.ts#L95-L97)).
- Testes:
  - Unit: contract test de `Adapter` (já existe na 004) executado contra `ClaudeAdapter`.
  - Unit: cada combinação `(type, scope)` resolvendo o destino esperado, incluindo `linkedRepos: []` em `project` (devolve array vazio; o "skipped: no-linked-repos" é responsabilidade do `AdapterManager` por ADR-29).
  - Unit: `reference` de qualquer scope devolve array vazio.
  - Unit: paths com espaços/acentos em `homedir` simulado e em `repo.path` continuam absolutos e bem formados (delegação para `path.join` + `os.homedir()`; normalização final fica no `SymlinkManager`).
  - Integração: end-to-end via `AdapterManager.syncOne` com `ClaudeAdapter` registrado e `SymlinkManager` real sobre `InMemoryFilesystem` (fixture da 004) — verifica que `SyncResult[]` saem `status: "ok"` com `destination` apontando para os paths esperados.
  - Integração: `settings.adapters.claude.enabled === false` produz zero `SyncResult` com `adapter: "claude"`.

## Out of scope

- Sincronização de `reference` para o Claude → reabrir após dogfooding se aparecer demanda (debt registrada).
- Layout `~/.claude/plugins/...` → não previsto no PRD/ARCH; descartado em "Considered alternatives".
- `CopilotAdapter` real → spec 006.
- Disable flow + cleanup massivo → spec 008.
- Validação de `description ≤ 1024` (limite de skill do Claude) → 009 (`SchemaValidator`); a 003 já valida `≤ 200` para o frontmatter geral.

## Considered alternatives

| Decisão | Escolhida | Alternativas descartadas | Motivo |
|---|---|---|---|
| Destino para `reference` no Claude | **Não sincronizar** (`resolveDestinations` devolve array vazio para `type === "reference"`) | (b) tratar como skill em `~/.claude/skills/<slug>/SKILL.md` — semântica errada (reference é texto referencial, não procedural); (c) inventar `~/.claude/references/<slug>.md` — Claude ignora, vira lixo no disco do usuário | Claude Code não tem convenção nativa para references (verificado em https://code.claude.com/docs/en/skills.md e .../sub-agents.md, 2026-04-27). References já têm destino claro no Copilot via `copilot-instructions.md` (spec 007). Forçar destino no Claude inventa convenção sem consumidor. |
| Layout no destino do Claude | **Direto** em `~/.claude/skills/` e `~/.claude/agents/` | Embrulhar em pseudo-plugin `~/.claude/plugins/skillforge/skills/...` para casar com a estrutura de marketplace | ARCH §7.4 fixa o layout direto. Doc oficial do Claude Code confirma descoberta automática em `~/.claude/skills/` e `~/.claude/agents/` sem necessidade de plugin (consultado 2026-04-27). Plugin é mecanismo de distribuição alternativo, não pré-requisito de carregamento. |
| Local da expansão de `~` | **No `ClaudeAdapter` via `os.homedir()`** antes de devolver o destino | (b) deixar `~` literal e expandir no `SymlinkManager`; (c) expandir no `SettingsService` ao carregar | Node `path.resolve` não expande `~`. Expansão pertence ao adapter que conhece a semântica do path do Claude (`~/.claude/...`). Settings deve ficar fiel ao input do usuário; SymlinkManager opera só com paths absolutos. |
| Granularidade do skill no destino | **Diretório** `<base>/.claude/skills/<slug>/` (symlink aponta para `<workspace>/skills/<slug>/`) | Apenas o arquivo `SKILL.md` (symlink file-level) | ARCH §7.4 e ADR-20: skill é dir-level no workspace para carregar assets opcionais junto. Consistência personal/project; reaproveita primitiva de symlink dir do `SymlinkManager` (AC#9 da 004). |
| Forma do "reference no Claude" no `SyncResult` | **Adapter devolve array vazio**; AdapterManager não emite nenhum `SyncResult` com `adapter: "claude"` para references | (b) emitir um `SyncResult { destination: null, status: "ok", details: { skipped: "type-not-supported" } }` simétrico com ADR-29 | ADR-29 é sobre estado configurável (`linkedRepos: []`) — usuário pode resolver linkando um repo. Reference + Claude é decisão arquitetural fixa do produto, não estado configurável. Emitir skipped seria ruído no relatório, não auditoria útil. |

## Acceptance criteria

1. `src/main/infrastructure/adapters/claude-adapter.ts` exporta uma classe/factory cujo objeto satisfaz a port `Adapter` da 004: tem `adapterId === "claude"` e o método `resolveDestinations({ artifact, linkedRepos })` (verificável pelo contract test da 004 reaproveitado contra `ClaudeAdapter`).
2. Para `artifact.type === "skill"` e `scope === "personal"`, `resolveDestinations` devolve **exatamente um destino** com `scope: "personal"` e `destination` igual a `path.join(homedir, ".claude/skills", artifact.slug) + path.sep` ou equivalente diretório (verificável por unit test asserting o string).
3. Para `artifact.type === "skill"` e `scope === "project"` com `linkedRepos.length === N` (N ≥ 1), `resolveDestinations` devolve **N destinos**, cada um com `scope: "project"` e `destination` igual a `path.join(repo.path, ".claude/skills", artifact.slug)` (mesmo formato diretório).
4. Para `artifact.type === "agent"` e `scope === "personal"`, `resolveDestinations` devolve **exatamente um destino** com `scope: "personal"` e `destination` igual a `path.join(homedir, ".claude/agents", artifact.slug + ".md")`.
5. Para `artifact.type === "agent"` e `scope === "project"` com `linkedRepos.length === N` (N ≥ 1), `resolveDestinations` devolve **N destinos**, cada um com `scope: "project"` e `destination` igual a `path.join(repo.path, ".claude/agents", artifact.slug + ".md")`.
6. Para `artifact.type === "reference"` (qualquer scope, qualquer `linkedRepos`), `resolveDestinations` devolve `[]` (array vazio). Verificável: nenhum `SyncResult` com `adapter: "claude"` aparece no `SyncResult[]` para artifacts de tipo `reference` em testes integração.
7. Para `scope === "project"` com `linkedRepos: []`, `ClaudeAdapter.resolveDestinations` devolve `[]` (array vazio). O `SyncResult` `{ destination: null, status: "ok", details: { skipped: "no-linked-repos" } }` é emitido pelo `AdapterManager` por ADR-29, não pelo adapter — verificável: passar `scope: project, linkedRepos: []` ao adapter e asserir `.length === 0`.
8. Todos os destinos retornados por `resolveDestinations` são paths **absolutos** (sem `~`, sem `.` ou `..` no início). Verificável por `path.isAbsolute(d.destination) === true` em todos os casos de teste.
9. Em [src/main/index.ts:62](../../../src/main/index.ts#L62) (ou onde a `Map<string, Adapter>` for instanciada para o `AdapterManager` em produção), `ClaudeAdapter` é registrado com chave `"claude"`. Verificável: ao iniciar o app com `settings.adapters.claude.enabled === true`, `AdapterManager.syncAll` para um artifact `type: skill, scope: personal` produz um `SyncResult` com `adapter: "claude"` e `status: "ok"`.
10. Com `settings.adapters.claude.enabled === false`, nenhum `SyncResult` com `adapter: "claude"` é produzido por `AdapterManager.syncOne` ou `syncAll` para qualquer artifact (verificável por teste integração).
11. Save end-to-end de um skill `scope: personal` com Claude habilitado, sobre `InMemoryFilesystem` (fixture da 004), produz no FS fake um symlink em `<homedir>/.claude/skills/<slug>` cujo `readlink` resolvido bate com `<workspace>/skills/<slug>` (verificável por teste integração).
12. Save end-to-end de um agent `scope: project` com 2 repos linkados produz **2 symlinks**, um em cada `<repo.path>/.claude/agents/<slug>.md`, ambos resolvendo para `<workspace>/agents/<slug>.md` (verificável por teste integração).
13. Re-save do mesmo artifact (sem mudanças) não recria o symlink nem gera entrada em `_backups/` — idempotência delegada ao `SymlinkManager` da 004 (AC#3 da 004), revalidada aqui no caminho com `ClaudeAdapter` real.
14. Paths com espaços e acentos em `homedir` simulado (ex.: `/Users/José Silva`) e em `repo.path` (ex.: `/Users/x/My Repo (work)`) produzem destinos válidos sem quebra (verificável por teste com fixtures contendo esses caracteres). Normalização final é responsabilidade do `SymlinkManager` (AC#15 da 004); o adapter só precisa não corromper os strings.
15. Construtor de `ClaudeAdapter` lança `DomainError({ kind: "internal", details: { reason: "missing-homedir" } })` quando `homedir` é `undefined`, `null` ou string vazia. Verificável por unit test invocando `new ClaudeAdapter({ homedir: undefined })`, `{ homedir: "" }` e `{ homedir: null as unknown as string }` e asserindo o erro com o `kind` e `reason` esperados.

## References

- [PRD.md §4](../../PRD.md) — must-have "Sync via symlink to Claude Code".
- [ARCH.md §5.3](../../ARCH.md) — `ClaudeAdapter` na tabela de Main services.
- [ARCH.md §7.4](../../ARCH.md) — Symlink destinations layout.
- [ARCH.md §9 ADR-13](../../ARCH.md) — Layering hexagonal leve.
- [Spec 004](../004-symlink-sync-core/SPEC.md) — port `Adapter`, `AdapterManager`, `SymlinkManager`, ADR-29 (`scope: project + linkedRepos: []`).
- [Spec 003](../003-artifact-crud/SPEC.md) — `Artifact` shape (`type`, `slug`, `scope`).
- Claude Code docs (consultado 2026-04-27): https://code.claude.com/docs/en/skills.md , https://code.claude.com/docs/en/sub-agents.md .

## Bookkeeping notes

- Ao fechar a 005, atualizar ROADMAP linha `005-claude-adapter` de `—` para `review` (regra de defasagem em CLAUDE.md — ROADMAP fica uma fase atrás da SPEC).
- Avaliar promoção de "reference não sincroniza para o Claude" a ADR formal em ARCH §9 caso a decisão se mostre estrutural após dogfooding.
- Caso surja necessidade de `~/.claude/plugins/...` no futuro (ex.: distribuir skillforge como plugin público), abrir nova spec — não é mudança incremental sobre 005.
