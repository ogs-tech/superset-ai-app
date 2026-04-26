---
id: "002"
title: Onboarding & settings
status: review
priority: next
created_at: 2026-04-26
updated_at: 2026-04-26
depends_on: ["001"]
labels: [must-have, core]
related_prd: "§4"
related_arch: "§6.6, §9 (ADR-15..19)"
branch: ""
---

# 002 — Onboarding & settings

## What

Fluxo de primeira execução e tela de configurações persistentes do Skillforge. Na ausência de `settings.json`, a app abre um onboarding mínimo que coleta o caminho do workspace via `dialog.showOpenDialog` (com `defaultPath: '~/sde-ai-app'`), cria a estrutura de diretórios (`skills/`, `references/`, `agents/`, `_generated/`, `_backups/`, `.sde/templates/`), grava o `settings.json` inicial em `app.getPath('userData')` (`claude.enabled: true`, `copilot.enabled: false`, ambos `defaultScope: personal`, `linkedRepos: []`) e leva o usuário direto à tela principal. Toggles de adapter, mudança de `defaultScope` e linking de repositórios ficam exclusivamente na tela de Settings. Entrega o `SettingsService` (carrega/persiste/merge com defaults) e o `RepoService` (detecta `.git/`, lê branch atual, lista repos linkados) descritos em ARCH §5.3, expostos ao Renderer via `contextBridge`.

## Why

Sem onboarding e settings, nenhuma das specs subsequentes (003 artifact-crud, 004 symlink-sync-core, 005/006 adapters) tem onde escrever artifacts nem para onde sincronizar. PRD §4 lista "Settings: enable/disable adapter, default scope, management of linked repos" como must-have, e ARCH §6.6 detalha o fluxo de primeiro uso como pré-requisito do save flow (§6.1). Esta spec destrava o caminho crítico do spike: a partir dela, o usuário tem um workspace válido em disco e configuração persistida que `AdapterManager` e `SymlinkManager` poderão consumir.

## Non-goals

- **Não versionar `settings.json` neste spike.** ARCH §8.5 explicitamente difere `version` + migração para post-spike; aceitamos como DEBT consciente.
- **Não validar schema do `settings.json` em runtime.** Validação completa de frontmatter/config é responsabilidade do should-have `009-schema-validator`.
- **Não persistir PAT do Copilot.** PAT vive apenas no Keychain (ARCH §8.6); fora do escopo desta spec.
- **Não implementar git operations** além de detecção de `.git/` e leitura da branch atual (RepoService responsibility cap em ARCH §5.3).
- **Não criar UX polida.** PRD §5 lista "visual polish, accessibility, i18n" como out of scope do produto inteiro.

## In scope

- `SettingsService` em [src/main/services/settings/](src/main/services/settings/) ou path equivalente:
  - `load()`: lê `settings.json`, retorna `null` quando ausente.
  - `save(settings)`: serializa e persiste via escrita atômica — grava em arquivo temporário no mesmo diretório e usa `rename` para substituir o destino, garantindo que kill/crash no meio da operação preserve a versão anterior íntegra.
  - `merge(partial)`: deep-merge com defaults e persiste (reutiliza a escrita atômica de `save`).
  - `getDefaults()`: retorna o objeto padrão (ver ARCH §8.5 como referência de shape).
- `RepoService`:
  - `detectGit(path)`: verifica presença de `.git/` no path informado.
  - `getCurrentBranch(path)`: lê branch atual via parse de `.git/HEAD`. Retorna `null` quando HEAD está detached (aponta para sha), em formato `packed-refs`, ou em qualquer formato não reconhecido — nunca lança.
  - `listLinked()`: retorna `linkedRepos` do settings com metadata atualizado quando possível.
- IPC handlers (Main) e bridge expostos no preload (Renderer) cobrindo as operações acima — alinhado a ARCH §8.1.
- Tela de Onboarding (Renderer):
  - Exibida quando `SettingsService.load()` retorna `null`.
  - Coleta `workspacePath` via `dialog.showOpenDialog` com `defaultPath: '~/sde-ai-app'`.
  - Cria estrutura de diretórios via service do Main, grava `settings.json` inicial (`claude.enabled: true`, `copilot.enabled: false`, ambos `defaultScope: personal`, `linkedRepos: []`).
  - Conclui levando o usuário à tela principal — **não** expõe UI de repo linking nem toggles de adapter.
- Tela de Settings (Renderer):
  - Toggle de cada adapter + escolha de `defaultScope` (`personal` | `project`).
  - Listagem, adição e remoção de repos linkados; adição via `dialog.showOpenDialog` no modo de seleção de pasta.
  - Validação no link: `RepoService.detectGit(path)` precisa retornar `true`; caso contrário, rejeita o link com mensagem ao usuário e não persiste.
  - Modal de confirmação obrigatório no momento do link, com texto explícito sobre symlinks possivelmente commitados (ARCH §6.6 nota / PRD §6); confirmar prossegue, cancelar aborta sem persistir.
- Tratamento de `workspacePath` inexistente/movido na reabertura:
  - Se `settings.json` existe mas `workspacePath` não aponta para um diretório válido, a app exibe tela de erro com botões "Re-selecionar pasta" e "Cancelar"; nunca recria silenciosamente nem dispara re-onboarding (preserva `adapters` e `linkedRepos`).
- Tratamento de falha de I/O (permissão negada, disco cheio, FS read-only) durante o onboarding ou em qualquer `save` posterior:
  - Operações de escrita (`mkdir` da estrutura do workspace, `SettingsService.save`) capturam o erro do FS e exibem tela de erro dedicada com botões "Tentar novamente" e "Cancelar".
  - Estado anterior em disco permanece inalterado (garantido pela escrita atômica de `save` e por `mkdir -p` no workspace).
- `linkedRepos[].branch` **não** é persistido em `settings.json`; é recomputado a cada uso via `RepoService.getCurrentBranch(path)`.
- Estrutura de diretórios criada no workspace: `skills/`, `references/`, `agents/`, `_generated/`, `_backups/`, `.sde/templates/` (ARCH §7.2).
- Testes unitários para `SettingsService` (load/save/merge/defaults) e `RepoService` (detectGit, getCurrentBranch).

## Out of scope (deferred to later specs)

- CRUD de artifacts e templates → spec 003.
- `SymlinkManager`, `AdapterManager` e save flow → spec 004.
- Adapters concretos (Claude/Copilot) → specs 005/006.
- Geração de `copilot-instructions.md` → spec 007.
- Validação de schema do `settings.json` → eventual spec post should-have.
- Migração de schema versionado de `settings.json` → post-spike.

## Considered alternatives

| Decisão | Escolhida | Alternativas descartadas | Motivo |
|---|---|---|---|
| Local de `settings.json` | `app.getPath('userData')` | Dentro do próprio workspace | ARCH ADR-5 separa config da workspace para evitar acoplamento e permitir trocar workspace sem perder config. |
| Leitura de branch git | Parser leve de `.git/HEAD` | Spawn de `git` CLI; libgit2 binding | RepoService só precisa de detecção e branch; CLI adiciona dependência externa e binding adiciona complexidade desproporcional ao spike. |
| Seleção de `workspacePath` no onboarding | `dialog.showOpenDialog` com `defaultPath: '~/sde-ai-app'` | Input de texto editável; ambos | Dialog nativo evita paths digitados errados (não-existentes, sem permissão); input editável aumenta superfície de erro num spike single-user. |
| Estado inicial dos adapters após onboarding | `claude.enabled: true`, `copilot.enabled: false`, ambos `defaultScope: personal` | Tudo off | Claude é caminho feliz do dogfooding; Copilot exige PAT extra. Alinha com exemplo de `settings.json` em ARCH §8.5 como fonte única de verdade. |
| Repo linking durante o onboarding | Diferido inteiramente para a tela de Settings | Obrigatório no onboarding; opcional com botão "Skip" | Reduz fricção de primeiro uso; primeiro artifact pode nascer `scope: personal`. Concentra UX de linking (com modal de aviso) na tela onde ela vive permanentemente. |
| Validação de path de repo no link | Exigir `.git/` presente; rejeitar caso contrário | Aceitar e marcar como inválido; aceitar sem checagem | `RepoService.detectGit()` já existe e cobre o caso; aceitar inválido suja `linkedRepos[]` e quebra `SymlinkManager` no save. |
| Aviso de symlinks-em-repo no link | Modal de confirmação obrigatório | Banner persistente em Settings; tooltip/inline help | PRD §6 e ARCH §6.6 tratam como aviso explícito; tooltip é ignorado, banner vira ruído. Modal força reconhecimento uma vez por repo. |
| Reabertura com `workspacePath` inexistente/movido | Tela de erro com "Re-selecionar pasta" / "Cancelar" | Disparar re-onboarding; recriar estrutura silenciosamente | Re-onboarding apaga `adapters`/`linkedRepos` já configurados; recriar silenciosamente mascara disco montado errado ou pasta renomeada. Tela de erro deixa decisão com o usuário. |
| Persistência de `linkedRepos[].branch` | Não persiste; recomputa via `RepoService.getCurrentBranch()` em cada uso | Snapshot ao linkar, congelar até re-link | Snapshot mente assim que o usuário troca de branch; custo de ler `.git/HEAD` é negligível. Implica remover `branch` do shape de `settings.json` em ARCH §8.5. |
| Idempotência da criação do workspace | `mkdir -p` (cria o que faltar, ignora existente) | Falhar se diretório já existe; perguntar overwrite | Onboarding tem que ser tolerante a re-execução parcial após crash; nunca destrutivo. |
| Estratégia de escrita do `settings.json` | Tempfile no mesmo diretório + `rename` atômico | Write direto no destino; file locking (flock/proper-lockfile) | `rename` em mesmo FS é atômico em POSIX e NTFS; resolve corrupção parcial sem dependência externa. Write direto deixa janela de arquivo truncado; locking adiciona complexidade desproporcional para um escritor único (Main process). |
| Comportamento de `getCurrentBranch` em HEAD não-padrão | Retornar `null` sem lançar | String sentinela (`"unknown"`, `"detached"`); lançar exceção | `null` força null-check no caller (TS) e não colide com nome de branch válido; string sentinela vira "branch fantasma" se vazada para UI; lançar obriga try/catch em todo consumidor para um caso esperado. |

## Acceptance criteria

1. Ao iniciar a app sem `settings.json`, a janela apresenta a tela de Onboarding e não a tela principal — verificável por leitura do bootstrap do Renderer + teste E2E ou unit do roteamento.
2. Ao concluir o onboarding com um `workspacePath` válido, existe `settings.json` em `app.getPath('userData')` cujo JSON parseado tem ao menos as chaves `workspacePath`, `adapters`, `linkedRepos`, `ui` — verificável por inspeção do arquivo após rodar o fluxo.
3. Ao concluir o onboarding, existem em disco os diretórios `skills/`, `references/`, `agents/`, `_generated/`, `_backups/` e `.sde/templates/` dentro do `workspacePath` — verificável por `ls` no diretório.
4. `SettingsService.load()` retorna `null` quando o arquivo não existe, e o objeto persistido (deep-equal) quando existe — verificável por testes unitários cobrindo ambos os cenários.
5. `SettingsService.merge(partial)` aplica deep-merge: campos não citados em `partial` permanecem; campos citados sobrescrevem — verificável por teste unitário com fixture cobrindo `adapters.claude.enabled` e `ui.theme`.
6. `RepoService.detectGit(path)` retorna `true` para path com subdiretório `.git/` e `false` caso contrário — verificável por teste unitário com tmpdir.
7. `RepoService.getCurrentBranch(path)` retorna a branch apontada por `.git/HEAD` (ex.: `main`) — verificável por teste unitário com fixture de `.git/HEAD` apontando para `refs/heads/<branch>`.
8. Toggle de adapter na tela de Settings persiste em `settings.json` (após reload, valor permanece) — verificável por teste de integração ou inspeção manual + leitura do arquivo.
9. Adicionar um repo linkado via tela de Settings persiste uma entrada em `linkedRepos[]` com `id` único, `name` e `path` — verificável por inspeção do `settings.json`. `branch` **não** é persistida; é recomputada dinamicamente via `RepoService.getCurrentBranch()` quando exibida ou consumida.
10. A tela de Settings, ao adicionar um repo linkado, exibe modal de confirmação obrigatório com texto explícito sobre symlinks possivelmente commitados (ARCH §6.6 nota / PRD §6); confirmar prossegue com a adição, cancelar aborta sem persistir — verificável por teste de integração ou snapshot de UI cobrindo ambos os cenários.
11. Adicionar o mesmo `path` de repo duas vezes não cria entrada duplicada em `linkedRepos[]` — verificável por teste de integração.
12. Reabrir a app após onboarding concluído carrega o `workspacePath` salvo e abre a tela principal (não o onboarding) — verificável por inspeção do bootstrap.
13. Tentar linkar um repo cujo path não contém `.git/` (ou seja, `RepoService.detectGit(path)` retorna `false`) rejeita a operação com mensagem ao usuário e não cria entrada em `linkedRepos[]` — verificável por teste de integração apontando para um diretório sem `.git/`.
14. Reabrir a app com `settings.json` existente porém `workspacePath` apontando para diretório inexistente exibe tela de erro com opções "Re-selecionar pasta" e "Cancelar"; `adapters` e `linkedRepos` permanecem inalterados em `settings.json` — verificável por teste de integração com fixture de `settings.json` apontando para path inválido.
15. A tela de Onboarding não expõe UI de repo linking nem toggles de adapter — verificável por leitura do JSX/markup.
16. O `settings.json` gerado ao final do onboarding tem `adapters.claude.enabled: true`, `adapters.copilot.enabled: false`, ambos com `defaultScope: 'personal'`, e `linkedRepos: []` — verificável por inspeção do arquivo após rodar o fluxo.
17. `SettingsService.save` é atômico: interromper o processo no meio da escrita preserva a versão anterior íntegra do `settings.json` (nunca um arquivo truncado/parcial) — verificável por teste unitário com `fs` mockado simulando falha após `writeFile` do tempfile e antes do `rename`, ou injetando exceção no passo de rename.
18. Falha de I/O (permissão negada, disco cheio) ao criar a estrutura do workspace ou gravar `settings.json` exibe tela de erro dedicada com botões "Tentar novamente" e "Cancelar"; o `settings.json` anterior (se existia) permanece inalterado — verificável por teste de integração com `fs` mockado retornando `EACCES`/`ENOSPC`.
19. `RepoService.getCurrentBranch(path)` retorna `null` (não lança) quando `.git/HEAD` está em formato detached (`<sha>` puro), apontando para `packed-refs`, ou em formato não reconhecido — verificável por testes unitários com fixtures cobrindo cada caso.

## Bookkeeping notes

- **T048 — PRD §4 evaluation:** a redação atual ("Settings: enable/disable adapter, default scope, management of linked repos") cobre o entregue. Modal de confirmação, dedupe por path e validação de `.git/` são detalhes de implementação cobertos por AC#10, AC#11 e AC#13 desta spec; promovê-los à PRD must-have geraria ruído sem ganho de alinhamento. **Decisão:** manter PRD §4 inalterada.
- **T029 deviation:** o handler `workspace.exists` foi adicionado fora da lista enumerada em T029 para satisfazer AC#14 (router decide entre `<Main>` e `<WorkspaceMissing>` lendo o estado do disco). Implementado como port `PathProber` reutilizando `FsRepoReader` no wiring.
- **T046 — manual smoke:** a verificação interativa (`npm run dev` em `userData` limpo) fica pendente para o autor antes do retro de promoção `review` → `done`.

## References

- ARCH §6.6 — First use (fluxo principal desta spec).
- ARCH §5.3 — `SettingsService` e `RepoService` (responsabilidades).
- ARCH §8.5 — schema-exemplo do `settings.json` e nota sobre versionamento.
- ARCH §7.2 — workspace layout (estrutura de diretórios criada no onboarding).
- ARCH §7.3 — locations (`settings.json` em `userData`).
- ARCH §8.1 — contrato Renderer ↔ Main (IPC para SettingsService/RepoService).
- ARCH §8.6 — Security (PAT do Copilot fora deste spec).
- PRD §4 — Must-have (Settings: enable/disable adapter, default scope, linked repos).
- PRD §6 — aviso sobre symlinks possivelmente commitados.
- ROADMAP — `002-onboarding-settings` na fila Next.
