# sde-ai-app

> **Spike descartável de validação** — GUI local para centralizar artefatos de IA (skills, references, agent profiles) em Markdown+YAML, versionados em git manual, sincronizados via **symlink** para Claude Code e Copilot.
>
> **Status:** Discovery — sem código ainda. Toda a documentação vive em [docs/](docs/).

## Objetivo

Validar em **4 semanas** (1 dev solo, macOS) se faz sentido centralizar contexto de IA em um app local com sync via symlink — fonte única no workspace, cópias vivas em `~/.claude/`, `~/.copilot/`, `<repo>/.claude/` e `<repo>/.github/`.

Sucesso = o autor usa o app diariamente por ≥ 2 semanas consecutivas sem voltar ao método antigo (notas soltas, pastas ad-hoc).

## Stack

| Camada | Tecnologia |
|---|---|
| Shell | Electron (última LTS) |
| UI | React + TypeScript |
| Core | Go (subprocess via JSON-RPC 2.0 sobre stdin/stdout) |
| Segredos | Keychain via `keytar` |
| Git | Leitura direta de `.git/HEAD` (sem libgit2) |

Sem backend, API, banco, auth ou telemetria.

## Escopo

### Entra (must-have)
- CRUD de skills, references e agent profiles em `.md` com frontmatter YAML.
- Preview de Markdown ao lado do editor.
- Templates por tipo.
- Adapters com symlink para Claude Code e Copilot (pessoal e projeto).
- Config de adapters + gestão de repos vinculados em Settings.

### Pode entrar (should-have)
- Validação de schema completa.
- Busca textual.
- Consumo de tokens (Claude via JSONL; Copilot via GitHub Usage API).

### Não entra
- Colaboração, múltiplos usuários, git write automático.
- Linux/Windows, i18n, acessibilidade, polimento visual.
- Outras ferramentas além de Claude e Copilot.
- Custo em dólar dos tokens.

## Documentação

- [docs/PRD.md](docs/PRD.md) — requisitos de produto, escopo e critérios de sucesso.
- [docs/ARCH.md](docs/ARCH.md) — decisões arquiteturais, contratos entre componentes e ADRs.

## Como rodar

_Ainda não há código._ Próximo passo do spike: stack rodando (Electron + React + Go via IPC) na semana 1 — ver roadmap em [docs/PRD.md](docs/PRD.md).
