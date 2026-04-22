---
status: in progress
phase: discovery
updated: 2026-04-20
depends_on: [PRD.md]
---

# ARCH — sde-ai-app

## 0. Objetivo do sistema (1 frase)

GUI local para um dev solo criar/editar artefatos de IA (skills, references, agent profiles) em Markdown+YAML, versionados em git manual, e sincronizá-los via **symlink** para Claude Code e Copilot nos escopos pessoal e projeto — validando em 4 semanas se vale a pena centralizar esse contexto.

### Restrições não-negociáveis herdadas do PRD

- Stack: **Electron + React + Go** via IPC. Sem backend, API, banco, auth, telemetria.
- Plataforma-alvo: **macOS apenas** (Linux/Windows fora de escopo).
- Sync: **symlink** (fonte única), sem cópia. Save é a única ação.
- Git: **somente leitura** (detectar repo, branch). Commit manual.
- Ferramentas-alvo: **Claude Code e Copilot apenas**. Outras ficam de fora.
- Prazo: 4 semanas, 1 dev.

---

## 1. Visão geral

### Fronteiras de processo

```
┌──────────────────────────────────────────────────────────────────┐
│                         Processo Electron                         │
│                                                                   │
│  ┌─────────────────┐   contextBridge   ┌──────────────────────┐   │
│  │   Renderer      │◄─────IPC─────────►│  Main (Node.js)      │   │
│  │   (React)       │                   │                      │   │
│  │                 │                   │  - janelas/menus     │   │
│  │  - Editor       │                   │  - keytar (segredos) │   │
│  │  - Preview      │                   │  - spawn Go Core     │   │
│  │  - Settings     │                   │  - ponte JSON-RPC    │   │
│  └─────────────────┘                   └──────────┬───────────┘   │
│                                                   │               │
└───────────────────────────────────────────────────┼───────────────┘
                                                    │ stdin/stdout
                                                    │ JSON-RPC 2.0
                                                    ▼
                                ┌──────────────────────────────────┐
                                │   Go Core (subprocess)           │
                                │                                  │
                                │  - ArtifactService (CRUD)        │
                                │  - AdapterManager                │
                                │    ├─ ClaudeAdapter              │
                                │    └─ CopilotAdapter             │
                                │  - SymlinkManager                │
                                │  - TemplateService               │
                                │  - RepoService (git read-only)   │
                                │  - SettingsService               │
                                │  - ClaudeTokenParser (JSONL)     │
                                │  - CopilotUsageClient (HTTP)     │
                                │  - CopilotInstructionsGen        │
                                └──────────────┬───────────────────┘
                                               │ filesystem + HTTPS
                                               ▼
              ┌────────────────┬────────────────────┬──────────────┐
              │  Workspace     │  ~/.claude/        │  GitHub API  │
              │  (artefatos)   │  ~/.copilot/       │  (usage)     │
              │  <repo>/.claude│  <repo>/.github    │              │
              └────────────────┴────────────────────┴──────────────┘
```

### Stack confirmada

| Camada    | Tecnologia                         | Observação                                           |
| --------- | ---------------------------------- | ---------------------------------------------------- |
| Shell     | Electron (última LTS no início)    | `contextIsolation: true`, `nodeIntegration: false`.  |
| UI        | React + TypeScript                 | Sem SSR. Bundler à escolha do dev (Vite recomendado).|
| Core      | Go (stdlib + `yaml.v3`)            | Binário embutido em `resources/`.                    |
| IPC       | JSON-RPC 2.0 sobre stdin/stdout    | Ver [ADR-2](#6-decisões-arquiteturais-adr-lite).     |
| Segredos  | Keychain via `keytar`              | Cross-platform por baixo custo — ver ADR-4.          |
| Markdown  | Biblioteca React (ex.: react-markdown) | Só renderização, não edição WYSIWYG.             |
| Git       | Leitura direta de `.git/HEAD` em Go | Sem libgit2, sem `go-git` — evita dependência pesada.|

---

## 2. Componentes

### 2.1 Renderer (React)

- **Responsabilidade:** UI (listagem, editor markdown, preview, Settings, dashboard de tokens).
- **Não faz:** filesystem, spawn de processo, chamadas HTTP externas. Tudo via IPC.
- **Dependências:** Main (via `window.api` exposto pelo preload).

### 2.2 Main (Electron, Node.js)

- **Responsabilidade:** ciclo de vida da app; cria janela; expõe IPC no preload; **spawna o Go Core**; proxia chamadas Renderer↔Go; resolve segredos via `keytar` (PAT Copilot); trata restart/crash do Go.
- **Não faz:** lógica de domínio (sem parse de YAML, sem symlink, sem git). É "ponte burra" com responsabilidade de segurança.
- **Dependências:** Go Core (subprocess), sistema de Keychain.

### 2.3 Go Core (subprocess)

Módulo monolítico em binário único com serviços internos:

| Serviço                         | Responsabilidade                                                              | Não faz                                       |
| ------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------- |
| `ArtifactService`               | CRUD de `.md` com frontmatter YAML; lê/escreve no workspace.                  | Sync, symlink, UI.                            |
| `AdapterManager`                | Orquestra adapters ativos; pede sync ao(s) correto(s) após Save.              | Lógica de cada ferramenta.                    |
| `ClaudeAdapter`                 | Mapeia artefato → caminhos Claude (pessoal e projeto); delega ao SymlinkManager. | HTTP, API, tokens.                         |
| `CopilotAdapter`                | Mapeia artefato → caminhos Copilot; aciona gerador de `copilot-instructions`. | Tokens.                                       |
| `SymlinkManager`                | Cria, remove e valida symlinks; detecta conflitos (arquivo real no destino).  | Cópia de conteúdo, git.                       |
| `TemplateService`               | Fornece templates por tipo (skill/reference/agent).                           | Renderização.                                 |
| `RepoService`                   | Detecta `.git/`, lê branch atual; lista repos vinculados.                     | Escrita em git, commit, push.                 |
| `SettingsService`               | Carrega/persiste `settings.json`; merge de defaults.                          | Segredos (PAT fica no Keychain).              |
| `SchemaValidator` (should-have) | Valida frontmatter contra schema por tipo.                                    | Sanitização automática.                       |
| `SearchService` (should-have)   | Busca textual em-memory (nome + conteúdo).                                    | Indexação persistente.                        |
| `ClaudeTokenParser` (should-have)   | Lê JSONL de `~/.claude/projects/*/`, agrega tokens por skill e projeto.   | Custo em dólar, UI.                           |
| `CopilotUsageClient` (should-have)  | HTTP GET contra GitHub Usage API com PAT (recebido via IPC na chamada).   | Armazenar PAT, UI.                            |
| `CopilotInstructionsGen`        | Agrega references marcadas (flag no frontmatter) em `copilot-instructions.md` gerado; aplica `chmod 444`. | Editar arquivo; symlink (delega). |

---

## 3. Contratos entre componentes

### 3.1 Renderer ↔ Main

- Transporte: `contextBridge.exposeInMainWorld('api', …)` no preload.
- Método: `await window.api.call(method: string, params: object) → result | error`.
- Um único método `call` que multiplexa — Main roteia: segredos ficam no Main; o resto encaminha ao Go.

### 3.2 Main ↔ Go Core

- Transporte: **stdin/stdout** do subprocess.
- Protocolo: **JSON-RPC 2.0**, uma mensagem por linha (delimitador `\n`).
- Timeout por request: 10s (configurável); crash do Go → Main respawna e notifica Renderer.
- Stderr do Go → arquivo de log em `<userData>/logs/core.log`.

**Métodos (resumo — ver `docs/IPC.md` se detalhado depois):**

| Método                          | Params                                   | Resultado                           |
| ------------------------------- | ---------------------------------------- | ----------------------------------- |
| `artifact.list`                 | `{ type? }`                              | `Artifact[]`                        |
| `artifact.get`                  | `{ id }`                                 | `Artifact`                          |
| `artifact.save`                 | `{ artifact, adapters[] }`               | `{ syncReport: SyncResult[] }`      |
| `artifact.delete`               | `{ id, removeSymlinks: bool }`           | `{ ok }`                            |
| `template.list`                 | `{ type }`                               | `Template[]`                        |
| `repo.link`                     | `{ path }`                               | `{ repoName, branch }`              |
| `repo.list` / `repo.unlink`     | —                                        | —                                   |
| `settings.get` / `settings.set` | —                                        | `Settings`                          |
| `adapter.syncAll`               | `{ adapterId? }`                         | `SyncResult[]`                      |
| `tokens.claude.stats`           | `{ from, to, groupBy }`                  | `TokenStats[]`                      |
| `tokens.copilot.stats`          | `{ from, to, pat }` (PAT injetado Main)  | `CopilotUsage`                      |

### 3.3 Erros

Todo erro segue forma JSON-RPC:

```json
{ "code": <int>, "message": "<humano>", "data": { "kind": "<slug>", "details": {...} } }
```

`kind` enumerado: `validation`, `io`, `symlink_conflict`, `not_found`, `external_api`, `unauthorized`, `internal`.

### 3.4 Filesystem (contrato Go ↔ disco)

- **Fonte:** `<workspace>/skills/<slug>/SKILL.md` (skills são diretório, por espelhar Claude), `<workspace>/references/<slug>.md`, `<workspace>/agents/<slug>.md`.
- **Alvos (destinos de symlink):** ver seção 5.1 do PRD.
- **Geração:** `<workspace>/_generated/copilot-instructions.md` é fonte do symlink Copilot; `chmod 444` após cada geração.

### 3.5 HTTP externo (Copilot)

- Endpoint: `GET https://api.github.com/user/copilot/usage` (fallback `/orgs/{org}/copilot/usage` se PAT organizacional).
- Auth: `Authorization: Bearer <PAT>`.
- Erros tratados: 401 → `unauthorized`; 404 → `not_found` (plano sem Copilot); ≥500 → `external_api` com retry exponencial (máx 3).

---

## 4. Modelo de dados

### 4.1 Frontmatter YAML (proposta de padronização — **ASSUNÇÃO**)

Mesmo schema para os 3 tipos, com campos específicos opcionais:

```yaml
---
slug: code-review-checklist          # obrigatório, [a-z0-9-], único por tipo
name: Code Review Checklist          # obrigatório, humano
type: skill                          # obrigatório: skill | reference | agent
description: Checklist rápido para PRs. # obrigatório, ≤200 chars
scope: personal                      # obrigatório: personal | project
version: 0.1.0                       # obrigatório, semver
tags: [review, quality]              # opcional
createdAt: 2026-04-20T10:00:00Z      # gerado pelo app
updatedAt: 2026-04-20T10:00:00Z      # gerado pelo app
# Específico por tipo:
includeInCopilotInstructions: true   # reference apenas — agrega em copilot-instructions.md
---
```

Artefatos com `scope: project` são replicados (via symlink) em **todos** os repos vinculados em Settings — não há seleção por artefato. Refinamento pós-spike é esperado (ver Perguntas em aberto).

### 4.2 `settings.json`

**Localização:** `app.getPath('userData')/settings.json` (cross-platform — macOS: `~/Library/Application Support/sde-ai-app/`). Separa a config do app do workspace de artefatos (ver ADR-5).

```json
{
  "workspacePath": "~/sde-ai-app",
  "adapters": {
    "claude": { "enabled": true, "defaultScope": "personal" },
    "copilot": { "enabled": false, "defaultScope": "personal" }
  },
  "linkedRepos": [
    { "id": "uuid", "name": "ogs-tech", "path": "/Users/x/Projects/ogs-tech", "branch": "main" }
  ],
  "ui": { "theme": "system" }
}
```

PAT do Copilot **não** fica aqui — armazenado em Keychain via `keytar` com `service="sde-ai-app"`, `account="copilot-pat"`.

### 4.3 Workspace (layout no disco)

```
<workspace>/
├─ skills/
│  └─ <slug>/
│     ├─ SKILL.md         # fonte
│     └─ <assets opcionais>
├─ references/
│  └─ <slug>.md
├─ agents/
│  └─ <slug>.md
├─ _generated/
│  └─ copilot-instructions.md   # gerado, 444
└─ .sde/
   └─ templates/          # templates customizados (opcional)
```

---

## 5. Fluxos críticos

### 5.1 Salvar artefato (happy path)

1. Renderer envia `artifact.save` com payload + lista de adapters ativos.
2. Go valida frontmatter → escreve arquivo fonte no workspace → atualiza `updatedAt`.
3. `AdapterManager` consulta adapters ativos:
   - `ClaudeAdapter`: resolve destinos (`~/.claude/...` e, se `scope=project`, cada repo vinculado em Settings).
   - `CopilotAdapter`: idem; se artefato é `reference` com `includeInCopilotInstructions`, aciona `CopilotInstructionsGen`.
4. `SymlinkManager` cria/atualiza symlink para cada destino.
5. Retorna `SyncResult[]` com `{ adapter, destination, status: ok|conflict|error, message }`.
6. Renderer atualiza preview + toast.

### 5.2 Salvar — falha por conflito no destino

- Destino existe e **é symlink** apontando para outro local: **sobrescreve** e registra warning no `SyncResult` (user pediu este comportamento).
- Destino existe e **não é symlink** (arquivo real): **sobrescreve** o arquivo, mas gera `SyncResult.status = conflict` com `action: overwritten` e o caminho do backup salvo em `<workspace>/_backups/<timestamp>/`.
- Renderer exibe modal pós-save listando cada conflito; user pode restaurar do backup manualmente.

> **Rollback:** o save da fonte já terminou. Se a sincronização falhar em alguns destinos, os que funcionaram ficam. Não há transação atômica cross-destino — é listado no relatório.

### 5.3 Desligar adapter

1. User muda switch em Settings.
2. Renderer pergunta "remover symlinks criados por este adapter?".
3. Se sim: Go varre destinos registrados (derivados dos artefatos), remove apenas symlinks cujo target aponta para o workspace. Nunca remove arquivos reais.
4. Persiste setting; adapter fica off.

### 5.4 Regenerar `copilot-instructions.md`

1. Disparado por: save de reference com flag; toggle da flag; "Sync todos"; botão manual em Settings.
2. `CopilotInstructionsGen` lista references com `includeInCopilotInstructions: true`, concatena em ordem alfabética por `name`, escreve em `_generated/copilot-instructions.md` com header `<!-- GENERATED — edit references no app -->`, aplica `chmod 444`.
3. `CopilotAdapter` garante symlinks para destinos ativos (pessoal e cada repo vinculado com flag).

### 5.5 Leitura passiva de tokens (Claude)

1. User abre dashboard; Renderer envia `tokens.claude.stats` com janela de tempo.
2. `ClaudeTokenParser` lista JSONLs em `~/.claude/projects/*/`, faz streaming line-by-line (sem carregar tudo em RAM), extrai eventos `tool_use` onde `name == "Skill"` e `input.skill` bate com um slug conhecido — **padrão de matching:** comparar `input.skill` (ou `skillName`, se existir) contra slugs do workspace; fallback: regex em `file_path` contendo `/skills/<slug>/`.
3. Agrega `input_tokens`/`output_tokens` por skill e por projeto (pasta pai do JSONL).
4. Retorna série agregada. Sem cache persistente no spike — relê a cada request.

> **ASSUNÇÃO:** formato do JSONL segue o que Claude Code expõe hoje em `~/.claude/projects/`. Quebras de formato são risco aceito (PRD §8).

### 5.6 Primeiro uso

1. App detecta ausência de `settings.json` → abre onboarding.
2. User escolhe pasta do workspace (default `~/sde-ai-app`).
3. Settings cria workspace (`mkdir -p` + subpastas), escreve `settings.json` inicial.
4. User liga adapters, opcionalmente vincula repos, cria primeiro artefato via template.

---

## 6. Decisões arquiteturais (ADR-lite)

| # | Decisão | Alternativas descartadas | Por que escolhida | Reversibilidade |
|---|---------|--------------------------|-------------------|-----------------|
| 1 | Go como subprocess único (não biblioteca nativa) | `c-shared` lib via cgo + Node addon; porta tudo pra Node | Simples de empacotar, debug independente, crash isolado | Alta — é só trocar transporte |
| 2 | IPC via JSON-RPC 2.0 sobre stdin/stdout | HTTP localhost (porta exposta, CORS); Unix socket (cross-plat ruim); gRPC (complexidade+tooling) | Zero setup de rede, sem auth local necessária, linha-por-linha é fácil de debugar | Alta — camada de transporte isolada |
| 3 | Symlink como mecanismo de sync | Cópia com file-watcher; hardlink (falha em diretório); bind mount (root) | PRD exige "fonte única, sem cópia"; macOS lida bem com symlinks cross-tool | **Travada pelo PRD** |
| 4 | PAT do Copilot no Keychain (keytar) | Plaintext em `settings.json`; variável de ambiente | Evita vazamento em backup/git/logs; keytar funciona cross-plat barato | Alta |
| 5 | Settings em `app.getPath('userData')` | `~/sde-ai-app/settings.json` (junto do workspace) | Multiplataforma; mantém workspace separado de config do app | Alta — só migração de caminho |
| 6 | Frontmatter com schema único e campos por tipo | Schema distinto por tipo; JSON em vez de YAML | Menos código, editor único; YAML é convenção no ecossistema (Claude/Copilot) | Alta |
| 7 | `includeInCopilotInstructions` no frontmatter da reference | Lista curada em Settings; todas references agregadas | Mantém decisão junto do artefato (versionável em git), menos UI | Média — migração simples se mudar |
| 8 | Conflito de destino: sempre sobrescrever, alertar depois | Abort; backup sempre; pedir confirmação modal por arquivo | Fluxo de Save não bloqueia; usuário cirurgicamente decide depois | Alta |
| 9 | Git read-only via leitura direta de `.git/HEAD` e `.git/config` | `go-git`, `libgit2`, shell out para `git` | Zero dependência pesada; cobre 100% do que o PRD pede (detectar repo + branch) | Alta |
| 10 | Sem índice persistente de busca | SQLite FTS; BoltDB; Bleve | PRD é spike, N de artefatos baixo, varredura em-memory serve | Alta |

---

## 7. Riscos técnicos e mitigações

| Risco técnico | Impacto | Mitigação |
|---------------|---------|-----------|
| IPC stdin/stdout trava/deadlock com payload grande | Alto | Framing por linha + limite de payload (1 MB); stress test na semana 1 |
| Crash do Go Core em produção trava a UI | Médio | Main respawna automaticamente; Renderer mostra banner "core reiniciado" |
| Electron + keytar exige rebuild de módulo nativo no pipeline de build | Médio | Fixar versão Electron; `electron-rebuild` no `postinstall`; smoke test em CI mínimo |
| `chmod 444` não impede edição via editor "force save" | Baixo | Header no arquivo; não é segurança, é fricção; aceito |
| Path com espaço ou caractere especial quebra symlink | Médio | Normalizar via `filepath.Abs`; test fixture com espaço no semana 1 |
| JSONL do Claude muda de formato e quebra parser | Baixo | Feature should-have; parser isolado; falha silenciosa com log |
| API Copilot usage exige plano Business / muda schema | Baixo | Fallback: estimativa por tokenizer local do conteúdo da skill (PRD §8) |
| Symlink dentro de repo vinculado é commitado como link | Baixo | Aviso explícito na UI ao vincular repo (PRD §6); dev decide |
| Subir binário Go assinado no macOS (Gatekeeper) | Médio | Spike roda unsigned via `xattr -d com.apple.quarantine`; signing fica pós-spike |

---

## 8. Fora do escopo arquitetural

Este doc **não cobre**:

- Design visual, componentes de UI, tokens de design — PRD marca polimento como fora de escopo.
- Estratégia de teste e pipeline de CI/CD — spike, validação é o próprio dogfooding.
- Empacotamento para Linux/Windows — PRD limita a macOS.
- Assinatura/notarização do app para distribuição — spike é uso local pelo autor.
- Observabilidade (métricas, traces) — PRD descarta telemetria.
- Estratégia de atualização/autoupdate — descartável.
- Internacionalização — fora de escopo no PRD.
- Controle de acesso, multi-user, auth — spike é single-user.
- Custo em dólar dos tokens — PRD explicitamente fora (§5).
- Quebra de tokens do Copilot por skill — PRD explicitamente fora (§5).

---

## 9. Perguntas em aberto

Assunções e lacunas herdadas do PRD que merecem refino antes de hardening pós-spike:

1. **Frontmatter definitivo:** schema da seção 4.1 é proposta inicial; refinar após criar os primeiros 5+ artefatos reais (dogfooding).
2. **Identificação de skill nos JSONL do Claude:** estratégia proposta na §5.5 pode falhar se Claude Code trocar nome do tool ou estrutura do input. Validar na semana 4 com dados reais.
3. **Multiplataforma vs macOS:** PRD trava em macOS; user pediu settings multiplataforma. Código escrito de forma portável onde barato (paths, keytar), mas teste e entrega só em macOS. Fica como débito se amanhã quiser Linux/Windows.
4. **Agregações de tokens por período/sessão:** dashboard proposto com filtros simples por data e agrupamento por skill/projeto. Refinar no design da UI.
5. **Backup de arquivos sobrescritos em conflito:** política de retenção (tempo, tamanho máximo) não definida — spike usa "nunca limpa automaticamente". Revisar se volume incomodar.
6. **Templates customizados:** PRD pede `≥1 template por tipo`; layout em `.sde/templates/` deixa porta aberta para o user adicionar os próprios — não é must-have, mas é barato.
7. **Migração de config entre versões do app:** não endereçada — spike assume schema estável. Pós-spike precisa de versão no `settings.json`.

