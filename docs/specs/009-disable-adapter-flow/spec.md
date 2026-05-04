---
id: "009"
title: Disable adapter flow
status: active
priority: later
created_at: 2026-05-03
updated_at: 2026-05-03
depends_on: ["005", "007"]
labels: [must-have, core, adapter, ui]
related_prd: "§4"
related_arch: "§6.3, §5.3"
branch: "009-disable-adapter-flow"
---

# 009 — Disable adapter flow

## What

Implementa o fluxo descrito em ARCH §6.3: quando o usuário desliga um adapter em Settings, o app pergunta se deseja remover os symlinks que aquele adapter criou; se sim, o `SymlinkManager` (entregue pela 004) varre os destinos derivados dos artifacts atuais e remove **apenas** symlinks cujo target aponta para o `<workspace>` — arquivos reais nunca são tocados. A flag `settings.adapters.<id>.enabled` é persistida via `SettingsService` (002) ao final. A 009 cobre `claude` (005) e `copilot` (007), incluindo o symlink do `copilot-instructions.md` agregado (008) quando Copilot é desligado.

## Why

PRD §4 lista "Settings: enable/disable adapter, default scope, management of linked repos" como must-have. ARCH §6.3 fixa o fluxo runtime. Hoje o toggle só persiste a flag via 002 — não há cleanup, então desligar um adapter deixa symlinks órfãos espalhados em `~/.claude/`, `~/.copilot/`, `<repo>/.claude/` e `<repo>/.github/`. Sem 009 o usuário não consegue "limpar" a presença de um adapter, e religar o adapter (sem `syncAll` automático) deixa sync stale. A 009 fecha o ciclo: ligar → sync; desligar → cleanup opcional.

A 009 depende de 005 (`ClaudeAdapter` produz destinos a varrer) e de 007 (idem para Copilot, incluindo branches `skill`/`agent`/`global-instruction`). A 008 não é hard dependency mas o bookkeeping da 009 deve cobrir o symlink do agregado, então a recomendação é fechar a 008 antes da 009 entrar em `review`.

## Non-goals

- **Não remover arquivos reais** — só symlinks cujo `readlink` resolve para dentro de `<workspace>`. Arquivos reais (mesmo no destino esperado) ficam intocados — proteção fixa em ARCH §6.3.
- **Não remover symlinks que apontam para fora do workspace** — pode ser symlink de outro tool ou criado manualmente pelo usuário; nunca tocar.
- **Não fazer "deep cleanup" recursivo em `~/.claude/`, `~/.copilot/`, `.github/`, `.claude/`** — só os destinos que o adapter atualmente resolveria para os artifacts existentes (mesma fonte de verdade do save).
- **Não cobrir caso de desligar o adapter quando `linkedRepos` mudou** — varre destinos atuais; symlinks em repos previamente linkados (e desde então deslinkados) ficam órfãos. Débito separado.
- **Não migrar/converter symlinks pré-existentes para nova convenção** — só remove os que reconhece pelo destino atual.
- **Não cobrir o fluxo de "remover linked repo"** — esse é débito separado (não está no PRD/ARCH explicitamente).
- **Não substituir o IPC de `settings.update` da 002** — adiciona um método novo dedicado ao toggle do adapter, ou estende o existente — ver clarification.

## In scope

- Novo IPC method `adapter.setEnabled` (paramétrico true/false em um único método; simétrico). Params: `{ adapterId: "claude" | "copilot", enabled: boolean, removeSymlinks?: boolean, runSyncAll?: boolean }`. Result discriminado pelo `enabled`:
  - `enabled: false` → invoca `AdapterManager.removeAll(adapterId)` se `removeSymlinks === true` (default `true`); persiste `settings.adapters.<id>.enabled = false` em seguida (mesmo se `errors.length > 0`). Result: `{ removed: number, skipped: number, errors: SymlinkError[] }`.
  - `enabled: true` → persiste `settings.adapters.<id>.enabled = true`; se `runSyncAll === true` (default `true`), chama `AdapterManager.syncAll({ adapterId })` em seguida. Result: `{ syncReport: SyncResult[] }` (array vazio quando `runSyncAll: false`).
  - Rationale: single method reduz superfície IPC (um `call`) e mantém shape previsível; pares dedicados (`adapter.disable`/`adapter.enable`) duplicariam dispatch e lógica espelhada; `settings.adapter.toggle` esconde a operação dentro de settings (que só persiste).
- Novo método em `AdapterManager`: `removeAll(adapterId: string): Promise<{ removed, skipped, errors }>`. Algoritmo:
  1. Busca o `Adapter` por id; se não registrado, devolve `{ removed: 0, skipped: 0, errors: [] }` (no-op).
  2. Lista todos os artifacts via `ArtifactRepository.list()`.
  3. Para cada artifact, chama `adapter.resolveDestinations({ artifact, linkedRepos })` (mesmas linkedRepos atuais — fonte de verdade do save).
  4. Para cada destino resolvido, delega ao `SymlinkManager.removeIfPointsToWorkspace(destination, workspacePath)`.
  5. Acumula contadores: `removed` (symlink removido), `skipped` (não existe, não é symlink, ou aponta fora do workspace), `errors` (erro inesperado de FS).
- Novo método em `SymlinkManager`: `removeIfPointsToWorkspace(destination: string, workspacePath: string): Promise<"removed" | "skipped-not-found" | "skipped-real-file" | "skipped-out-of-workspace">`. Implementação:
  1. `lstat(destination)` — se `ENOENT`, devolve `"skipped-not-found"`.
  2. Se não é symlink (`isSymbolicLink() === false`), devolve `"skipped-real-file"`. **Nunca** chama `unlink` em arquivo real.
  3. `readlink(destination)` → resolve absoluto via `path.resolve(path.dirname(destination), target)`.
  4. Verifica se o target absoluto começa com `path.resolve(workspacePath) + path.sep` — se não, devolve `"skipped-out-of-workspace"`.
  5. `unlink(destination)` → devolve `"removed"`.
- Cobertura para `copilot-instructions.md` agregado (008):
  - `CopilotAdapter.resolveDestinations` para `type === "reference"` flagged já devolve os destinos do agregado (após 008). `removeAll("copilot")` reaproveita esse caminho — symlinks do agregado em `~/.copilot/...` e `<repo>/.github/copilot-instructions.md` são removidos pela mesma varredura.
  - **Deletar `<workspace>/_generated/copilot-instructions.md` em si:** sim. Após remover os symlinks do agregado (passo da varredura padrão), `removeAll("copilot")` faz `chmod 0o644` + `unlink` no arquivo gerado se ele existir. Rationale: limpeza honesta — desligar adapter remove tudo o que ele produziu; o arquivo é puramente derivado (header + bodies de references) e regenerar tem custo trivial ao religar; mantém consistência com a regra "0 refs flagged → remove file" da 008.
- UI:
  - Toggle off do adapter em Settings dispara modal com **pré-cálculo de N symlinks que seriam removidos**. Botões: `"Sim, remover N symlinks"` / `"Não, só desligar"` / `"Cancelar"`. Pré-cálculo via novo método `AdapterManager.countDestinations(adapterId): Promise<number>` (mesma iteração de `removeAll` mas sem `unlink`). Rationale: confirmação explícita em ação destrutiva (alinhado com modal de aviso de link de repo — ARCH §6.6); booleano simples sem contagem é opaco; sem modal é hostil.
  - Após confirmação, dispara `adapter.setEnabled` com `removeSymlinks: <true|false>` conforme botão; mostra toast com `{ removed, skipped }` em sucesso ou modal listando `errors` se `errors.length > 0`.
  - Toggle on do adapter dispara `adapter.setEnabled` com `runSyncAll: true` (default) → produz `SyncResult[]` re-renderizado no toast/modal pós-save (pattern da 006). Rationale: paridade com fluxo natural do save (intenção de "ligar adapter" é "ter os symlinks lá"); sem auto-sync o adapter fica em estado stale (artifact existe mas não tem symlink). Override programático via `runSyncAll: false` para casos de teste/script.
- Persistência:
  - Após o cleanup (ou skip do cleanup), `SettingsService.save` persiste `settings.adapters.<id>.enabled = false`. Ordem: cleanup → persist (se cleanup falhar parcial, settings ainda são atualizadas — `errors` no result avisa).
- Testes:
  - Unit: `removeIfPointsToWorkspace` em todos os 4 branches (not-found, real-file, out-of-workspace, removed).
  - Unit: `removeAll` em `AdapterManager` com adapter desconhecido devolve no-op.
  - Unit: `removeAll` com adapter conhecido + 0 artifacts devolve `{ removed: 0, skipped: 0, errors: [] }`.
  - Integração: e2e via `InMemoryFilesystem` da 004 — pré-popula 3 symlinks Claude (1 skill personal, 1 skill project, 1 agent personal) + 1 arquivo real no destino esperado de outro skill → `removeAll("claude")` remove os 3 symlinks, deixa o arquivo real intacto (`{ removed: 3, skipped: 1 }`).
  - Integração: pré-popula symlink Claude apontando para fora do workspace (ex.: `/tmp/some-other-file`) → `removeAll("claude")` devolve `skipped-out-of-workspace`, symlink fica.
  - Integração: religar adapter via IPC com `runSyncAll: true` → produz `SyncResult[]` cobrindo todos os artifacts (regressão da 005/007).
  - Integração: desligar Copilot com 1 reference flagged → remove o symlink do agregado em `~/.copilot/...` e em todos os `<repo>/.github/copilot-instructions.md` (regressão 008).
  - Integração: desligar Copilot com `linkedRepos: []` em scope project → não crasha, devolve só destinos personal removidos.
  - Integração: settings persistidas refletem `enabled: false` mesmo se `errors.length > 0`.

## Out of scope (deferred to later specs)

- Cleanup de symlinks órfãos por mudança em `linkedRepos` (repos deslinkados) → débito futuro.
- Cleanup recursivo / "scan filesystem inteiro por symlinks que apontam para o workspace" → débito futuro; arquitetura atual deriva destinos do estado atual de artifacts + linkedRepos.
- UI para listar symlinks que **seriam** removidos antes de confirmar (preview detalhado) → revisitar pós-spike se aparecer fricção.
- Cleanup transacional (rollback se algum unlink falhar) → ARCH §6.2 já estabelece "no atomic cross-destination transaction"; mantém o padrão.
- Apagar `_generated/copilot-instructions.md` em si ao desligar Copilot (vs só symlinks) → resolver clarification e decidir antes de Phase 1.

## Considered alternatives

| Decisão | Escolhida | Alternativas descartadas | Motivo |
|---|---|---|---|
| Fonte de verdade dos destinos a remover | **`adapter.resolveDestinations` aplicado a todos os artifacts atuais** | (b) Index persistente de symlinks criados (`<workspace>/.sde/symlinks.json`); (c) Scan recursivo de FS em paths conhecidos | Index persistente vira fonte de drift (precisa atualizar em todo save/delete); scan recursivo é caro e ambíguo (pode pegar symlinks alheios). Reaproveitar `resolveDestinations` mantém uma única fonte de verdade — o mesmo cálculo do save. |
| Proteção contra remover arquivo real | **`lstat` + check `isSymbolicLink()` antes de `unlink`** | (b) `try { fs.readlink } catch { skip }` (deduzindo via erro); (c) Confiar no usuário e sempre `unlink` | ARCH §6.3 fixa "Never removes real files". `lstat` + check é a verificação canônica em Node; `readlink` em arquivo real lança erro `EINVAL` mas depender de exception control é frágil. Confiar é hostil. |
| Proteção contra remover symlink que aponta fora do workspace | **`readlink` + verifica prefix `workspacePath`** | (b) Não verificar (remover qualquer symlink no destino); (c) Whitelist de targets específicos | Symlink no destino esperado pode ter sido criado por outro tool (e.g., `oh-my-zsh`, dotfiles manager). Verificação de target garante que só removemos o que **nós** criamos. Whitelist é equivalente a verificar prefix mas mais rígido — workspace path já é o whitelist natural. |
| Religar adapter | **Automático via `syncAll` (default `runSyncAll: true`)** | (b) Manual via clique em "Sync all" separado | Paridade com fluxo natural do save: a intenção de "habilitar" é "ter os symlinks lá". Manual exige clique extra que o usuário sempre vai fazer; sem ele o adapter fica stale (artifacts sem symlinks). Param `runSyncAll: false` permite override programático. |
| IPC shape | **Método único `adapter.setEnabled` (paramétrico true/false)** | (b) Pares dedicados `adapter.disable` + `adapter.enable`; (c) Extensão de `settings.update` | Single method reduz superfície IPC e mantém shape previsível; pares duplicariam dispatch e lógica espelhada; `settings.update` esconde a operação dentro de settings (que só persiste, não orquestra `removeAll`/`syncAll`). |
| Cleanup do `_generated/copilot-instructions.md` em si | **Apagar (chmod 644 + unlink)** após remover os symlinks do agregado | (b) Manter o arquivo (re-religar reusa) | Limpeza honesta: desligar adapter remove tudo que ele produziu. Arquivo é puramente derivado; regenerar custa trivial ao religar. Manter `0o444` no workspace pode confundir o usuário ("por que esse arquivo está aqui?"). Consistente com "0 refs flagged → remove file" da 008. |
| Modal de confirmação | **Modal com pré-cálculo de N symlinks (3 botões)** | (b) Booleano simples "Remover symlinks?"; (c) Sem modal — sempre remove | Confirmação explícita alinhada com pattern do modal de link de repo (ARCH §6.6). Pré-cálculo informa o impacto antes do destrutivo; novo método `AdapterManager.countDestinations` (dry-run) é trivial (mesma iteração sem `unlink`). Booleano opaco sem contagem aumenta ansiedade; sem modal é hostil para ação destrutiva. |
| Erro parcial → settings persistidas mesmo assim | **Persistir `enabled: false` mesmo se `errors.length > 0`** | (b) Reverter settings se cleanup falhar; (c) Persistir só se zero erros | Manter "settings = intenção do usuário"; cleanup é best-effort. Erros aparecem no toast — usuário pode re-tentar. Reverter cria estado inconsistente: usuário desligou no UI, mas adapter continua "ligado" internamente. |

## Acceptance criteria

1. `SymlinkManager.removeIfPointsToWorkspace(destination, workspacePath)` existe e devolve um dos 4 valores: `"removed" | "skipped-not-found" | "skipped-real-file" | "skipped-out-of-workspace"`. Verificável por unit test parametrizado.
2. `removeIfPointsToWorkspace` **nunca** chama `fs.unlink` em path cujo `lstat.isSymbolicLink() === false`. Verificável por spy/mock no `fs.unlink` em unit test que pré-popula um arquivo real no destino.
3. `removeIfPointsToWorkspace` **nunca** chama `fs.unlink` em symlink cujo target absoluto não começa com `path.resolve(workspacePath) + path.sep`. Verificável por unit test com symlink apontando para `/tmp/external-target`.
4. `AdapterManager.removeAll(adapterId)` existe; com adapter desconhecido devolve `{ removed: 0, skipped: 0, errors: [] }`. Com adapter conhecido, itera todos os artifacts via `ArtifactRepository.list()`, chama `resolveDestinations` por artifact, e delega ao `removeIfPointsToWorkspace` por destino.
5. Resultado de `removeAll` é `{ removed: number, skipped: number, errors: Array<{ destination: string, kind: string, message: string }> }`. Verificável por shape assertion em integração.
6. IPC method `adapter.setEnabled` com params `{ adapterId, enabled: false, removeSymlinks: true }` invoca `AdapterManager.removeAll` e depois `SettingsService.save({ adapters: { [adapterId]: { enabled: false } } })`. Result expõe `{ removed, skipped, errors }`.
7. `adapter.setEnabled` com params `{ adapterId, enabled: false, removeSymlinks: false }` **não** chama `removeAll`; só persiste settings. Result devolve `{ removed: 0, skipped: 0, errors: [] }`.
8. `adapter.setEnabled` com params `{ adapterId, enabled: true }` (default `runSyncAll: true`) chama `AdapterManager.syncAll({ adapterId })` para o adapter e devolve `{ syncReport: SyncResult[] }`. Default de `runSyncAll` é `true`; passar `runSyncAll: false` pula `syncAll` e devolve `{ syncReport: [] }`.
9. Settings são persistidas com `enabled: false` **mesmo quando** `errors.length > 0`. Verificável por integração que injeta erro de FS durante `unlink` e verifica `SettingsService.load()` após.
10. Ao desligar Claude com 3 symlinks Claude pré-existentes (1 skill personal + 1 skill project + 1 agent personal) + 1 arquivo real no destino de outro artifact: `removeAll("claude")` devolve `{ removed: 3, skipped: 1, errors: [] }`. Arquivo real continua existindo (verificável por `lstat` após).
11. Ao desligar Copilot com 1 reference flagged: símbolo do agregado em destino personal **e** em cada `<repo>/.github/copilot-instructions.md` é removido (verificável por `lstat` ENOENT após). O símbolo do skill/agent Copilot, se houver, também é removido.
12. Ao desligar Copilot com `scopes: ["project"]` em alguma reference flagged + `linkedRepos: []`: não crasha; devolve `{ removed: <só personal>, skipped: 0 }`.
13. Symlink Claude existente apontando para `/tmp/external` (fora do workspace) **não** é removido por `removeAll("claude")`. Verificável por `lstat` após.
14. UI: toggle off em Settings dispara modal com 3 botões `"Sim, remover N symlinks"` / `"Não, só desligar"` / `"Cancelar"`, onde `N` é pré-calculado via `AdapterManager.countDestinations(adapterId)`. Após confirmação, dispara `adapter.setEnabled`; em sucesso mostra toast `"<removed> removidos, <skipped> ignorados"`; se `errors.length > 0`, abre modal listando os erros. Verificável por teste de UI (reuso de pattern da 002 modal de aviso de repo).
15. UI: toggle on em Settings dispara `adapter.setEnabled` com `enabled: true` (sem confirmação); como `runSyncAll` default é `true`, o `syncReport` retornado é re-renderizado no modal/toast de sync (pattern da 006). Verificável por teste de UI: ligar Claude com 3 artifacts existentes → 1 chamada IPC → 3 `SyncResult` (ou contagem equivalente) refletidos na UI.
16. Comportamento existente da 002 (`SettingsService.save` atômico via tempfile + rename — ADR-15) permanece; persistência de `enabled: false` reusa o mesmo caminho.
17. Novo método `AdapterManager.countDestinations(adapterId): Promise<number>` faz a mesma iteração de `removeAll` (lista artifacts × `resolveDestinations`) sem chamar `unlink`; conta destinos onde `lstat.isSymbolicLink() === true` E target aponta para dentro do workspace. Verificável por unit test.
18. Ao desligar Copilot com `_generated/copilot-instructions.md` existente: além de remover os symlinks do agregado, `removeAll("copilot")` faz `chmod 0o644` + `unlink` em `<workspace>/_generated/copilot-instructions.md`. Verificável por integração: pré-popular o arquivo + `chmod 0o444`, chamar `removeAll("copilot")`, checar `lstat` ENOENT no path.

## Risks & assumptions

- **ASSUMPTION:** `ArtifactRepository.list()` (003) lista todos os artifacts independente de `type`/`scope`. Se houver filtro implícito, a varredura subestima destinos. Validar antes de Phase 1.
- **ASSUMPTION:** `linkedRepos` no momento do `removeAll` é o **mesmo** snapshot usado pelos saves anteriores. Se o usuário deslinkou um repo entre o save original e o disable, symlinks naquele repo ficam órfãos — DEBT documentada (Out of scope).
- **ASSUMPTION:** `path.resolve(workspacePath) + path.sep` cobre 100% dos casos macOS (case-insensitive FS) — usar `===` direto em prefix sem normalização extra. Se aparecer caso real de mismatch (e.g., `/Users/x` vs `/users/x`), trocar por `fs.realpath` antes do compare.
- **RISCO baixo:** TOCTOU entre `lstat` e `unlink` — outro processo pode trocar o symlink por arquivo real entre as duas chamadas. **Mitigação:** janela é μs; em macOS single-user é negligível. Se aparecer relevante, encapsular em retry com re-`lstat`.
- **RISCO médio:** Religar adapter sem `syncAll` deixa estado stale (artifact existe no workspace mas não tem symlink no destino). **Mitigação:** clarification sobre auto-syncAll resolve. Se ficar manual, UI deve sinalizar (badge "Sync needed").
- **RISCO baixo:** `_generated/copilot-instructions.md` em `0o444` pode confundir o usuário se o arquivo persistir após desligar Copilot. **Mitigação:** clarification sobre apagar ou manter resolve. Se mantiver, header "GENERATED" + chmod 444 já são "friction only" (ARCH §6.4).
- **DEBT consciente:** Sem dry-run UI antes da confirmação — modal mostra contagem (após cálculo) mas não os paths individuais. Revisitar pós-spike se usuário relatar surpresa.
- **DEBT consciente:** `removeAll` re-deriva destinos via `resolveDestinations` (sem cache). Volume baixo no spike (< 50 artifacts × < 5 repos linkados); performance OK.

## References

- [PRD.md §4](../../PRD.md) — must-have "Settings: enable/disable adapter".
- [ARCH.md §5.3](../../ARCH.md) — `AdapterManager`, `SymlinkManager`, `SettingsService`.
- [ARCH.md §6.3](../../ARCH.md) — Disable adapter (fluxo runtime).
- [ARCH.md §6.6](../../ARCH.md) — First use; modal de aviso ao linkar repo (referência de pattern de modal).
- [ARCH.md §9 ADR-15](../../ARCH.md) — Escrita atômica de settings via tempfile + rename.
- [ARCH.md §9 ADR-29](../../ARCH.md) — `linkedRepos: []` produz `SyncResult { skipped }`; comportamento simétrico no disable: scope project sem repos = no-op.
- [Spec 002](../002-onboarding-settings/spec.md) — `SettingsService.save`, modal de aviso.
- [Spec 004](../004-symlink-sync-core/spec.md) — `SymlinkManager`, `AdapterManager`, port `Adapter`.
- [Spec 005](../005-claude-adapter/spec.md) — `ClaudeAdapter` produz destinos para varredura.
- [Spec 007](../007-copilot-adapter/SPEC.md) — `CopilotAdapter` produz destinos para varredura.
- [Spec 008](../008-copilot-instructions-gen/spec.md) — symlink do agregado coberto pelo cleanup do Copilot.
- ROADMAP — `009-disable-adapter-flow` em "Later → Must-have remaining".
