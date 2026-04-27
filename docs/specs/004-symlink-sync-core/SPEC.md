---
id: "004"
title: Symlink sync core (SymlinkManager + AdapterManager)
status: done
priority: next
created_at: 2026-04-26
updated_at: 2026-04-27
depends_on: ["003"]
labels: [must-have, core]
related_prd: "§4"
related_arch: "§5.3, §6.1, §6.2, §7.4, §8.2, §9 (ADR-3, ADR-8, ADR-28, ADR-29)"
branch: "main"
---

# 004 — Symlink sync core (SymlinkManager + AdapterManager)

## What

Núcleo de sincronização por symlink que conecta o save de artifacts (entregue na 003) aos destinos no filesystem. Esta spec entrega dois serviços do Main: `SymlinkManager` (criar, remover, validar symlinks; detectar conflito quando o destino é arquivo real; gerar backup em `<workspace>/_backups/<timestamp>/`; normalizar paths via `path.resolve` para tolerar espaços e caracteres especiais — ARCH §5.3, §6.2) e `AdapterManager` (orquestra adapters ativos consultando `SettingsService`, resolve destinos por scope `personal`/`project`, monta `SyncResult[]` com `{ adapter, destination, status: ok|conflict|error, message }` — ARCH §6.1). Substitui o hook stub que a spec 003 deixou em `artifact.save`, plugando o pipeline real. Os adapters reais (`ClaudeAdapter`, `CopilotAdapter`) **não** são entregues aqui — ficam para 005 e 006; esta spec exercita o `AdapterManager` contra a port `Adapter` via um adapter fake in-memory que vive em test fixtures (ver "Considered alternatives").

## Why

PRD §4 marca "Sync via symlink to Claude Code and Copilot, personal and project scopes" como must-have, e ARCH §6.1 trata os passos 3-5 do save (resolução de destinos, criação/atualização de symlink, montagem de `SyncResult`) como o coração do produto. A spec 003 entregou o CRUD com `syncReport: []` vazio justamente porque a infraestrutura de symlink é desta spec; sem ela, nenhum artifact criado pela 003 chega às ferramentas-alvo. Adicionalmente, 005 (`ClaudeAdapter`) e 006 (`CopilotAdapter`) declaram explicitamente `Depends on 004` no ROADMAP — esta spec é o gargalo que destrava toda a coluna Later. Vem agora porque a 003 está em `review` (Verification verde, conforme regra `depends_on` em CLAUDE.md), `SettingsService` e `linkedRepos` da 002 já estão em disco, e o workspace já tem artifacts reais para sincronizar.

## Non-goals

- **Não entregar `ClaudeAdapter` real** — mapeamento de paths para `~/.claude/` (personal) e `<repo>/.claude/` (project) é responsabilidade exclusiva da spec 005.
- **Não entregar `CopilotAdapter` real** — mapeamento para `~/.copilot/` e `<repo>/.github/` é da spec 006.
- **Não entregar `CopilotInstructionsGen`** — agregação de references flagged em `copilot-instructions.md` + `chmod 444` é da spec 007 (ARCH §6.4). `AdapterManager` expõe o ponto de extensão (callback no fluxo de save de `reference` flagged), mas a implementação fica vazia.
- **Não cobrir o flow de "Disable adapter"** — varredura e remoção de symlinks ao desligar um adapter é da spec 008 (ARCH §6.3). Aqui o `SymlinkManager` ganha apenas a primitiva de `remove`/`scanByTarget`; o flow de UI + confirmação fica fora.
- **Não implementar `artifact.delete` com `removeSymlinks: true`** — a 003 deixou esse parâmetro como no-op; a 004 mantém no-op e a remoção real entra na spec 008 junto do disable flow.
- **Não auto-limpar `_backups/`** — ARCH §6.2 explicita "never auto-cleaned" no spike. Política de retenção é debt pós-spike.
- **Não implementar transação atômica cross-destination** — ARCH §6.2 explicita "no atomic cross-destination transaction"; sucessos parciais são reportados no `SyncResult[]` e seguem em disco.
- **Não tocar em git** — spike é manual git (PRD §3 e ARCH §10). Symlinks criados dentro de repo linkado podem ser commitados pelo dev; a 002 já entregou o aviso no link de repo (ADR-17).

## In scope

- `src/main/services/SymlinkManager.ts` (ou camada hexagonal equivalente — ADR-13) com primitivas: `create({ source, destination })`, `remove({ destination })`, `validate({ destination })` (retorna `none | symlink-to-source | symlink-to-other | real-file`), `scanByTarget({ rootPath, workspacePath })` para suportar futura limpeza (spec 008).
- `src/main/services/AdapterManager.ts` — orquestra adapters ativos (lidos via `SettingsService.get()`), expõe `syncOne({ artifact })` consumido por `artifact.save` e `syncAll({ adapterId? })` consumido por `adapter.syncAll` (IPC em ARCH §8.1).
- Substituição do hook stub da 003 em `artifact.save` para retornar `syncReport: SyncResult[]` real, mantendo o shape `{ adapter, destination, status, message }` (ARCH §6.1, §8.1).
- Geração de backup em `<workspace>/_backups/<timestamp>/<original-relative-path>` quando o destino é arquivo real (não-symlink), antes de sobrescrever (ARCH §6.2, ADR-8).
- Conflito symlink-to-other: sobrescreve o symlink e emite `SyncResult.status: ok` com `details.replacedTarget`; arquivo real: sobrescreve e emite `SyncResult.status: conflict` com `details.backupPath` e `action: overwritten`.
- Idempotência: re-`save` de artifact inalterado **não** cria backup nem recria symlink já válido apontando para o source correto (ARCH §10 — Sync idempotency).
- Resolução de destinos por scope: `personal` → caminho fixo do adapter; `project` → um destino por repo em `linkedRepos` (ARCH §7.4).
- Symlink em granularidade correta por tipo (ARCH §7.4): `skill` aponta para o **diretório** `<workspace>/skills/<slug>/`; `reference` e `agent` apontam para os **arquivos** `<workspace>/<type>/<slug>.md`.
- Erros propagados como envelope `{ kind, message, details }` (ARCH §8.2): `kind: symlink_conflict` para conflito reportável; `kind: io` para falha de filesystem; `kind: validation` para input inválido. Exceções inesperadas são capturadas no dispatch (ARCH §8.1) e viram `kind: internal`.
- IPC `adapter.syncAll` registrado no dispatcher central (ADR-14), shape `{ adapterId? } → SyncResult[]` conforme ARCH §8.1.
- Renderer: modal pós-save listando `SyncResult[]` quando há `status !== ok` (ARCH §6.2 — "post-save modal listing each conflict"). Apresentação de path do backup para restauração manual.
- Adapter port (`domain/ports/Adapter.ts`) consumida pelo `AdapterManager`; adapter fake in-memory (test fixture) que satisfaz a port para exercitar `AdapterManager` end-to-end durante esta spec, sem entregar `ClaudeAdapter`/`CopilotAdapter` reais.
- Revisão da port `Adapter` contra os requisitos de ARCH §5.3 para `ClaudeAdapter` (mapeamento `~/.claude/`, `<repo>/.claude/`) e `CopilotAdapter` (`~/.copilot/`, `<repo>/.github/`) antes do fechamento da spec; mantendo a port agnóstica entre os dois. Divergência identificada vira ADR em ARCH §9 — pré-requisito para evitar retrabalho em 005/006.
- Normalização de paths via `path.resolve` em todas as primitivas (`create`, `remove`, `validate`, `scanByTarget`) para tolerar espaços, acentos e caracteres especiais em workspace, repos linkados e diretórios home.
- Pré-checagem de escrita em `<workspace>/_backups/<timestamp>/` antes de tocar o destino: falha aqui aborta o save com `kind: io` e **não** cria nem sobrescreve o symlink (consistência: ou backup-e-overwrite, ou nenhuma mudança).

## Out of scope (deferred to later specs)

- `ClaudeAdapter` real → spec 005.
- `CopilotAdapter` real → spec 006.
- `CopilotInstructionsGen` (agregação + `chmod 444`) → spec 007.
- Disable adapter flow + cleanup massivo de symlinks + `artifact.delete` com `removeSymlinks: true` → spec 008.
- Validação completa de schema de frontmatter no save → spec 009.
- Limpeza periódica de `_backups/` → debt pós-spike (ARCH §6.2).

## Considered alternatives

| Decisão | Escolhida | Alternativas descartadas | Motivo |
|---|---|---|---|
| Estratégia para exercitar `AdapterManager` sem `ClaudeAdapter`/`CopilotAdapter` reais | Adapter fake in-memory satisfazendo a port `Adapter`, vivendo em test fixtures (`src/main/services/__fixtures__/` ou helper de teste). Nenhum adapter de produção é entregue na 004. | (b) `ClaudeAdapter` mínimo só com `personal` aqui — antecipa escopo da 005 e cria débito de refactor; (c) só testes contra a port com mocks inline — não valida o contrato em runtime, abre risco de retrabalho em 005/006 | Mantém o escopo da 004 alinhado com "Out of scope" (Claude/Copilot ficam para 005/006), valida o contrato da port em runtime, dá harness reusável para testes futuros e serve de exemplo vivo do contrato. |
| Conflito symlink → real file: comportamento padrão | Backup em `_backups/<timestamp>/` + sobrescrever + `status: conflict` no `SyncResult` | Abortar save; pedir confirmação modal por destino; backup desligado por default | ARCH ADR-8 lock: "Save flow doesn't block; user surgically decides later". |
| Conflito symlink → outro symlink | Sobrescrever silenciosamente e marcar `status: ok` com `details.replacedTarget` | Tratar como conflict (modal); preservar e abortar | ARCH §6.2: "is a symlink pointing to another location: overwrite and log a warning". Não requer ação do usuário. |
| Granularidade do timestamp do backup | ISO segundos `YYYYMMDDTHHmmss` com sufixo `-N` (`YYYYMMDDTHHmmss-1`, `-2`, ...) em colisão entre saves. **Um único `<timestamp>` compartilhado por save**: todos os destinos conflitantes do mesmo save vão para o mesmo diretório, preservando o caminho relativo do destino dentro (`_backups/<timestamp>/<destination-relative-path>`). | ISO ms `YYYYMMDDTHHmmss.sss` — duas operações no mesmo tick podem colidir, ainda precisa de fallback; `Date.now()` numérico — sem garantia de monotonia, ilegível para restauração manual | Único formato que cumpre a constraint de zero colisão de forma determinística (retry no sufixo é explícito e testável) e é legível para o usuário restaurando manualmente — caso de uso real previsto em ARCH §6.2 ("user surgically decides later"). Compartilhar o timestamp por save elimina colisão intra-save e simplifica restauração ("o que foi tocado nesse save está aqui"). |
| `scope: project` quando `linkedRepos` está vazio | Um `SyncResult` por adapter habilitado com `status: "ok"` + `details.skipped: "no-linked-repos"`. Save em si retorna sucesso. Renderer pode optar por exibir um toast discreto; modal pós-save (AC#13) só dispara para `status !== "ok"`, então o estado fica registrado mas não-intrusivo por padrão. | (a) no-op silencioso `SyncResult[] vazio` — usuário cria skill `project`, vê "Saved", e nunca entende por que nada chegou nas ferramentas; (c) `status: "error"` `kind: "validation"` — punitivo, ausência de repo linkado é estado configurável, não erro do usuário | Save é válido (artifact gravado no workspace). Registrar estruturadamente o "skipped" deixa rastro auditável/telemetrável e abre porta para UX futura sem mudar o contrato. |
| Idempotência | Skip de criação se symlink já aponta para source correto; nenhum backup gerado | Sempre recriar; sempre gerar backup defensivo | ARCH §10 marca "Sync idempotency" como atributo de qualidade ("re-save without changes does not create backups or duplicate symlinks"). |
| Camada de injeção de filesystem nos testes | Port `FilesystemPort` em `domain/ports/`, adapter `NodeFsAdapter` em `infrastructure/`, fake in-memory para testes da 004 | Mockar `fs/promises` direto; `memfs`; tmpdir real em testes (`os.tmpdir()`) | Hexagonal já adotado (ADR-13); fake in-memory mantém testes determinísticos sem depender de FS real. tmpdir fica disponível para tests de integração final. |

## Acceptance criteria

1. `SymlinkManager.create({ source, destination })` cria symlink simbólico cujo target absoluto resolve para `source` (verificável por `fs.readlink` + `path.resolve` em teste).
2. `SymlinkManager.create` em destino com **arquivo real** copia o original para `<workspace>/_backups/<timestamp>/<destination-relative>` antes de sobrescrever (verificável: arquivo existe no backup path com conteúdo idêntico ao original).
3. `SymlinkManager.create` em destino que **já é symlink apontando para o source correto** não regrava nem cria backup (verificável por mtime do symlink antes/depois — sync idempotente — ARCH §10).
4. `SymlinkManager.create` em destino que **é symlink apontando para outro target** sobrescreve silenciosamente e o `SyncResult` retornado pelo `AdapterManager` traz `status: "ok"` + `details.replacedTarget: <antigo>`.
5. `SymlinkManager.validate({ destination })` retorna um dos quatro estados: `"none"`, `"symlink-to-source"`, `"symlink-to-other"`, `"real-file"` (verificável por testes de cada estado).
6. `SymlinkManager.remove({ destination })` remove apenas symlinks; tentar remover arquivo real rejeita com envelope `{ kind: "io", message, details: { reason: "not-a-symlink" } }` (verificável por `fs.lstat` antes da chamada).
7. `AdapterManager.syncOne({ artifact })` consulta `SettingsService` para listar adapters habilitados, delega para cada um e retorna `SyncResult[]` com forma `{ adapter, destination, status: "ok"|"conflict"|"error", message, details? }` (verificável por leitura da assinatura + teste end-to-end).
8. Para `artifact.scope === "project"`, `AdapterManager` produz **um `SyncResult` por par (adapter, repo linkado)**; para `"personal"`, **um `SyncResult` por adapter** (verificável por count em testes com 2 adapters habilitados e 3 repos linkados).
9. Para `artifact.type === "skill"`, o symlink resultante aponta para o **diretório** `<workspace>/skills/<slug>/`; para `reference`/`agent`, aponta para o **arquivo** `<workspace>/<type>/<slug>.md` (verificável por `fs.lstat` + checagem de `isDirectory()` no target resolvido).
10. `artifact.save` retorna `{ artifact, syncReport: SyncResult[] }` populado pelo `AdapterManager` — substituindo o stub vazio da spec 003 (verificável por `grep -n "syncReport: \[\]" src/main` retornando zero ocorrências em código de produção).
11. IPC `adapter.syncAll` (`{ adapterId? }`) está registrado no dispatcher central e retorna `SyncResult[]` agregado de todos os artifacts × adapters habilitados (verificável por listagem do dispatcher + teste de invocação).
12. Falha de filesystem (`EACCES`, `ENOSPC`, etc.) durante `create`/`remove` é capturada e devolvida como envelope `{ kind: "io", message, details }`; conflito reportável vira `{ kind: "symlink_conflict", message, details: { backupPath } }` (verificável por testes injetando falhas no `FilesystemPort` fake).
13. Renderer exibe modal pós-save listando cada `SyncResult` com `status !== "ok"`, mostrando adapter, destination e (quando aplicável) `details.backupPath` (verificável por teste do componente).
14. Re-`save` de um artifact sem alterações chama o pipeline e retorna `SyncResult[]` com `status: "ok"` para todos os destinos sem gerar arquivos novos em `_backups/` (verificável por contagem de entradas em `_backups/` antes/depois — ARCH §10).
15. `SymlinkManager.create` e `validate` operam corretamente em paths com espaços, acentos e caracteres especiais (ex.: `<workspace>/skills/skill com acento/`, repo linkado em `~/Projects/My Repo (work)/.claude/`) — verificável por testes com fixtures contendo esses caracteres em workspace, source e destination.
16. Falha de escrita em `<workspace>/_backups/<timestamp>/` durante backup de arquivo real (ex.: `EACCES`, `ENOSPC`) aborta o save com envelope `{ kind: "io", message, details: { reason: "backup-failed" } }` e **não** cria nem sobrescreve o symlink no destino (verificável por teste injetando falha no `FilesystemPort` fake na operação de backup + asserção de que o destino permanece inalterado).
17. Port `Adapter` em `domain/ports/Adapter.ts` permanece agnóstica entre Claude e Copilot e expõe somente as primitivas exigidas por ARCH §5.3: identificação (`adapterId`), resolução de destino por scope (`personal`/`project`) e entrega de payload (`source` path) — verificável por inspeção da port (ausência de campos/métodos específicos de uma das ferramentas) e pela existência de adapter de teste que satisfaz o contrato sem extensões.
18. Para `artifact.scope === "project"` com `linkedRepos: []`, `AdapterManager.syncOne` retorna **um `SyncResult` por adapter habilitado** com forma `{ adapter, destination: null, status: "ok", details: { skipped: "no-linked-repos" } }` — save segue válido, nenhum symlink é criado e o modal pós-save (AC#13) **não** dispara por este caso (verificável por teste com 2 adapters habilitados, `linkedRepos: []`, asserção de `length === 2`, todos `status === "ok"` e `details.skipped === "no-linked-repos"`).

## Bookkeeping notes

- **PRD §4 (T046):** must-have "Sync via symlink to Claude Code and Copilot, personal and project scopes" permanece sem alteração — a 004 entrega o item exatamente como descrito; nenhum ajuste de redação ou de bucket (must/should/nice) foi necessário. Decisão registrada aqui em vez de no PRD para evitar churn cosmético.
- **ARCH §9 (T045):** ADR-28 (formato de timestamp do backup) e ADR-29 (`details.skipped: "no-linked-repos"`) adicionados para registrar decisões da 004 que estavam apenas em "Considered alternatives" desta SPEC.
- **T044 (smoke manual) deferida para 005:** o roteiro original ("fake adapter habilitado") é incoerente com a decisão de não entregar adapter de produção nesta spec — `index.ts` instancia `AdapterManager` com `adapters: new Map()` e `FakeAdapter` mora em `__fixtures__/` (apenas testes). AC#2 e AC#13 ficam cobertos pelos testes automatizados (T015, T024, T038–T040); smoke end-to-end retorna na 005, quando `ClaudeAdapter` for o primeiro adapter rodável em prod.

## References

- ARCH §5.3 — `SymlinkManager` e `AdapterManager` na tabela de Main services.
- ARCH §6.1 — Save artifact (happy path), passos 3-5.
- ARCH §6.2 — Save com conflito de destino (sobrescrita + backup + modal).
- ARCH §7.4 — Symlink destinations (granularidade por tipo, scope `personal`/`project`).
- ARCH §8.1 — Contrato IPC, métodos `artifact.save` e `adapter.syncAll`.
- ARCH §8.2 — Error envelope `{ kind, message, details }`.
- ARCH §9 ADR-3 — Symlink como mecanismo de sync (locked by PRD).
- ARCH §9 ADR-8 — Conflito de destino: sempre overwrite, alertar depois.
- ARCH §9 ADR-13/14 — Hexagonal layering + dispatcher IPC central (consumidos por esta spec).
- ARCH §10 — Sync idempotency, Non-invasive at destination, Service robustness.
- PRD §4 — Must-have: "Sync via symlink to Claude Code and Copilot, personal and project scopes".
- PRD §6 — Métricas de sucesso (zero broken symlinks > 1 dia útil após detecção).
- ROADMAP — `004-symlink-sync-core` na fila Next; destrava 005, 006, 007, 008.
- Spec 003 (`docs/specs/003-artifact-crud/SPEC.md`, ADR-22) — hook stub `syncReport: []` que esta spec substitui.
