---
status: in progress
phase: review
updated: 2026-04-20
depends_on: []
---

# PRD — sde-ai-app

## 1. Contexto e problema

Desenvolvedores que usam IA (Claude Code, Copilot) acabam com instruções, skills e prompts espalhados em notas, pastas soltas e repos ad-hoc. É como ter várias receitas de bolo em guardanapos diferentes: você sabe que existem, mas não acha na hora. O problema é pra **um dev individual** que quer um lugar só pra guardar essas "receitas de IA", versionar no git e mandar cópia pras ferramentas que ele usa.

## 2. Objetivo

Validar em **4 semanas** se faz sentido centralizar contexto de IA numa GUI local, versionado em git, com exportação pro Claude Code e Copilot.

Sucesso = o autor usa o app diariamente por 2+ semanas seguidas sem voltar pro método antigo (notas soltas).

## 3. Usuário e cenário de uso

**Persona única: o próprio autor (dogfooding).**

- Dev sênior, usa Claude Code e Copilot no dia a dia.
- Já tem repo git local como ambiente natural.
- Vai criticar a própria UX com rigor — é juiz e cobaia.
- **Cenário:** percebe atrito usando uma skill no Claude, abre o app, edita, salva, volta pro Claude com a versão nova.

Sem usuários externos. Feedback de terceiros é bônus, não requisito.

## 4. Escopo (o que entra)

### Features must-have

- **CRUD de artefatos** — criar, editar, listar, deletar skills, references e agent profiles em markdown com cabeçalho YAML (frontmatter = metadados no topo do arquivo, tipo ficha técnica).
- **Preview de markdown** — ver como o texto fica renderizado ao lado do editor.
- **Templates** — artefato novo já vem com estrutura básica pronta (pra não encarar página em branco).
- **Adapters com symlink** — cada ferramenta tem seu adapter; ao salvar, o adapter cria symlink da fonte (pasta do app) pro destino correto, escopo pessoal ou projeto. Fonte única, edita num lugar, reflete em todas as ferramentas ligadas — sem cópia, sem "exportei e quebrou".
- **Adapter Claude** — pessoal: `~/.claude/skills/<slug>/`, `~/.claude/agents/<slug>.md`; projeto: `<repo>/.claude/skills/<slug>/`, `<repo>/.claude/agents/<slug>.md`.
- **Adapter Copilot** — pessoal: `~/.copilot/skills/<slug>/`; projeto: `<repo>/.github/skills/<slug>/`. `copilot-instructions.md` (repo-wide, formato agregado) é arquivo gerado dentro do app e symlinkado pro destino — edita references no app, regenera, symlink reflete.
- **Config de adapters** — tela Settings com switch por adapter, escopo default (pessoal/projeto) e gestão de repos vinculados para escopo de projeto (adicionar, listar, remover).

### Should-have (se sobrar tempo)

- **Validação de schema completa** — além da validação mínima já no must-have, checar o cabeçalho YAML contra schema por tipo (campos esperados, enums, formatos) antes de salvar.
- **Busca textual** — achar artefato por nome ou conteúdo.
- **Consumo de tokens por artefato** — Claude via leitura passiva dos JSONL em `~/.claude/projects/*/` (input/output por skill/projeto). Copilot via GitHub Usage API (`/user/copilot/*` ou `/orgs/{org}/copilot/usage`), granularidade agregada apenas — sem quebra por skill. Fecha o loop "edito a skill → uso na IA → vejo se ficou mais cara ou mais barata". Custo em dólar fica fora — só contagem bruta.

### Roadmap (como dividir as 4 semanas)

| Semana | Foco |
|--------|------|
| 1 | Stack rodando (Electron + React + Go conversando), CRUD de skills, adapter Claude (symlink pessoal). **Checkpoint:** se a stack não fechar, repensar. |
| 2 | CRUD completo (references, agents), templates, gestão de repos vinculados em Settings, adapter Claude project-scoped. Primeiro teste real com Claude. |
| 3 | Adapter Copilot (symlink pessoal e projeto), preview, início do dogfooding diário. Log de fricções. |
| 4 | Validação de schema, busca e consumo de tokens (se houver folga). Relatório final e decisão sobre o próximo passo (Specfy). |

## 5. Fora de escopo (o que NÃO entra)

- Colaboração entre devs, repos compartilhados de empresa, sync de time.
- Múltiplos usuários ou personas.
- Git write automático (commit fica manual).
- Exportar pro Codex ou outras ferramentas além de Claude e Copilot.
- Histórico git na UI (log, blame).
- Polimento visual, acessibilidade, i18n.
- Linux e Windows — só macOS no spike.
- Backend, API, conta, auth, telemetria.
- Produto comercializável.
- Custo em dólar dos tokens consumidos (só contagem bruta, se a feature entrar).
- Quebra de tokens do Copilot por skill/arquivo (API de usage só expõe dados agregados).

## 6. Requisitos funcionais

### Fluxo de uso

1. **Primeiro uso:** dev escolhe pasta local pra guardar os artefatos (default `~/sde-ai-app/`), abre Settings, liga Claude Code e/ou Copilot, cria o primeiro artefato a partir de um template. A configuração do app (`settings.json`) fica na pasta padrão de dados de aplicação do sistema (userData do Electron — multiplataforma), separada do workspace de artefatos.
2. **Criar/editar:** clica "Nova skill", escolhe template, edita, clica **Salvar**. O Save faz tudo: persiste a fonte, aplica **validação mínima** (YAML parseável + campos obrigatórios do frontmatter) e sincroniza pros destinos ligados. Validação completa contra schema por tipo é should-have (ver §4). Não tem botão "Export" separado.
3. **Ajustar destinos:** abre Settings, muda switch ou caminho, salva. Próximo Save já reflete. Tem "Sync todos" pra re-enviar em lote.
4. **Evoluir um artefato:** usa no Claude/Copilot, nota atrito, volta no app, edita, salva. Commit manual no repo.

### Regras por feature

- **CRUD:** 3 tipos (skill, reference, agent profile), arquivos `.md` com YAML no topo. Delete pede confirmação e remove os symlinks dos destinos ativos. O botão **Salvar** é a única ação — não existe "Export" avulso. **Conflito no destino:** se o caminho de destino já existe e é symlink, o Save sobrescreve direto; se é arquivo real (não symlink), sobrescreve, preserva o conteúdo original em `<workspace>/_backups/<timestamp>/` e lista o caso no relatório pós-Save pro dev decidir se restaura.
- **Preview:** atualiza ao salvar (não precisa ser tempo real). Suporta markdown padrão: títulos, código, listas, links.
- **Templates:** cada tipo tem ≥1 template com YAML pré-preenchido e seções obrigatórias (ex.: skill tem "Quando usar" e "Exemplos").
- **Config de adapters:** switch por adapter (Claude, Copilot), escopo default (pessoal/projeto) e gestão de repos vinculados (adicionar via seletor de pasta, detecta `.git/`, mostra nome e branch, remove sem reiniciar). Config salva em `settings.json` na pasta userData do sistema (multiplataforma). Ao desligar um adapter, pergunta se remove os symlinks criados ou mantém. Aviso ao vincular repo: symlinks dentro do repo são commitados como links pelo git, não como conteúdo — cabe ao dev decidir.
- **Adapter Claude:** cria symlink da fonte para `~/.claude/skills/<slug>/` e `~/.claude/agents/<slug>.md` (pessoal) e/ou `<repo>/.claude/skills/<slug>/` e `<repo>/.claude/agents/<slug>.md` (projeto, artefatos marcados `scope: project`). Editar no app reflete imediatamente — é o mesmo arquivo.
- **Adapter Copilot:** cria symlink em `~/.copilot/skills/<slug>/` (pessoal) e/ou `<repo>/.github/skills/<slug>/` (projeto). `copilot-instructions.md` repo-wide é gerado dentro do app agregando references marcadas com a flag `includeInCopilotInstructions: true` no próprio frontmatter, e symlinkado pro destino; arquivo gerado fica read-only (chmod 444) e com header `<!-- GENERATED — edit references no app -->` pra evitar edição direta que seria sobrescrita na próxima regeneração.
- **Consumo de tokens:** dois parsers isolados. Claude: lê JSONL de `~/.claude/projects/*/` e agrega input/output por skill (cruzando nome do arquivo invocado) e por projeto. Copilot: cliente HTTP consulta GitHub Usage API usando PAT pessoal armazenado no Keychain do sistema (via keytar), agrega apenas totais (sem quebra por skill). Exibição com filtros simples por período e agrupamento por skill/projeto.

## 7. Critérios de sucesso / métricas

O spike é validado se, nas 4 semanas:

- **Uso diário:** autor abre e edita ao menos 1 artefato em ≥ 10 dias úteis.
- **Uso contínuo:** ≥ 2 semanas consecutivas sem voltar pro método antigo (notas soltas, pastas ad-hoc).
- **Valor percebido:** ≥ 5 artefatos criados e efetivamente usados em projetos reais no Claude Code ou Copilot.
- **Sync sem dor:** zero caso de "exportei e quebrou o Claude/Copilot" que não tenha sido resolvido em ≤ 1 dia.
- **Aprendizado transferível:** relatório final com decisões arquiteturais e de UX prontas pra alimentar o PRD do Specfy (versão pra times).

Falha = abandono antes de 2 semanas contínuas, ou volta ao método antigo sem dor aparente no caminho.

## 8. Dependências e riscos

### Stack

- **Electron** — shell desktop (é como o "navegador empacotado" que roda o app).
- **React** — a tela em si.
- **Go** — o motor que mexe com arquivo, lê git e valida. Conversa com React via IPC (mensageria entre processos).
- **Git local** — só leitura (ver se é repo e qual branch). Sem escrita automatizada.

Sem backend, sem API, sem banco. Tudo em arquivos no disco do usuário.

### Premissas

- Autor tem ≥ 4h/dia disponíveis nas 4 semanas.
- Formato dos arquivos que Claude Code e Copilot leem continua estável.
- Repos git locais do autor são suficientes pra testar sync em projeto real.
- Electron + Go + IPC é viável pra 1 dev solo.
- Markdown + YAML é formato suficiente (sem formato proprietário).
- Formato dos JSONL de sessão do Claude Code em `~/.claude/projects/*/` continua estável o bastante pra leitura passiva de tokens.
- Endpoint de usage do GitHub Copilot continua estável e acessível com PAT pessoal.
- Electron + keytar (Keychain) + subprocess Go é empacotável em macOS dentro das 4 semanas (inclui `electron-rebuild` de módulo nativo).

### Riscos

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Dogfooding abandona cedo | Alto | É o propósito do spike — descobrir barato e rápido. |
| Stack Electron+Go pesa demais pra 1 dev em 4 semanas | Alto | Checkpoint na semana 1: se IPC ou build não fecham, repensar stack. |
| Escopo infla | Alto | Must-have fechado; surpresa vai pro pós-spike. |
| Export quebra o que Claude/Copilot esperam ler | Médio | Testar em projeto real na semana 2, não no final. |
| Formato dos JSONL do Claude Code muda e quebra leitura de tokens | Baixo | Feature é should-have e descartável; parser isolado num adapter. |
| API de usage do Copilot muda, exige plano Business ou requer scopes inacessíveis | Baixo | Feature é should-have; fallback pra estimativa por tokenizer local do conteúdo da skill. |
| Pouco uso real de IA nas 4 semanas | Médio | Pré-selecionar 2–3 projetos onde as skills serão aplicadas. |
| Aprendizado não transfere pro Specfy | Baixo | Documentar decisões mesmo sabendo que o código pode ser jogado fora. |
