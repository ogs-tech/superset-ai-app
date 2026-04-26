# 002 — Onboarding & settings — tasks

> Convenção: `[Tnnn] [P?] descrição → AC#N`
> `[P]` = pode rodar em paralelo com tasks vizinhas marcadas `[P]` (arquivos distintos, sem dependência).

## Mapa de cobertura

| AC | Tasks |
|----|-------|
| AC#1 | T035, T040 |
| AC#2 | T009, T040 |
| AC#3 | T017, T018, T026, T040 |
| AC#4 | T010, T011, T024 |
| AC#5 | T012, T013 |
| AC#6 | T015 |
| AC#7 | T015 |
| AC#8 | T041 |
| AC#9 | T005, T037, T041 |
| AC#10 | T037, T038 |
| AC#11 | T037, T041 |
| AC#12 | T035, T040 |
| AC#13 | T037, T038 |
| AC#14 | T036, T040 |
| AC#15 | T034 |
| AC#16 | T008, T034, T040 |
| AC#17 | T023, T024 |
| AC#18 | T026, T027, T039, T040 |
| AC#19 | T015, T016 |

## Phase 1 — Setup

- [x] T001 [P] Garantir que `src/main/application/services/`, `src/main/application/ports/`, `src/main/infrastructure/`, `src/renderer/screens/` e `tests/` existem (criar com `.gitkeep` quando ausentes). Path-only — sem comportamento.
- [x] T002 [P] Criar diretório de fixtures `tests/fixtures/git-head/` contendo arquivos `head-ref.txt` (`ref: refs/heads/main\n`), `head-detached.txt` (`abc123def4567890abc123def4567890abc12345\n`), `head-packed-refs.txt` (`ref: refs/heads/feature\n` mais arquivo irmão `packed-refs` válido na fixture) e `head-garbage.txt` (`not-a-valid-head-line\n`) para uso pelos testes de `RepoService`.

## Phase 2 — Foundational

- [x] T003 RED `tests/shared/settings.test.ts`: novo teste de tipos verificando que `LinkedRepo` aceita `{ id, name, path }` e **não** exige `branch`. Deve falhar enquanto `branch` for obrigatório em `src/shared/settings.ts`. → AC#9
- [x] T004 [P] RED `tests/shared/settings.test.ts`: caso testando que `Settings` exporta `getDefaults()` (ou helper equivalente) retornando `{ workspacePath: '', adapters: { claude: { enabled: true, defaultScope: 'personal' }, copilot: { enabled: false, defaultScope: 'personal' } }, linkedRepos: [], ui: { theme: 'system' } }`. → AC#16
- [x] T005 GREEN `src/shared/settings.ts`: remover campo `branch` de `LinkedRepo`; ajustar consumidores se necessário. → AC#9
- [x] T006 GREEN `src/shared/settings.ts`: adicionar `LinkedRepoView` (ou tipo equivalente) com `{ id, name, path, branch: string | null }` para uso em IPC results e Renderer. → AC#9
- [x] T007 GREEN `src/shared/settings.ts`: adicionar tipo `WorkspacePaths` listando os subdiretórios obrigatórios (`['skills','references','agents','_generated','_backups','.sde/templates']`) como constante exportada. → AC#3
- [x] T008 GREEN `src/shared/settings.ts`: implementar e exportar `getDefaults(): Settings` com o shape definido em T004. → AC#16
- [x] T009 GREEN `src/main/application/ports/settings-repository.ts`: ampliar interface — `load(): Promise<Settings | null>`, `save(settings: Settings): Promise<void>`. Atualizar `InMemorySettingsRepository` para honrar a nova assinatura. → AC#2, AC#4

## Phase 3 — Application services

- [x] T010 RED `tests/main/application/services/settings-service.test.ts`: cenário "load returns null quando repository.load resolve null" usando `InMemorySettingsRepository` ou stub. → AC#4
- [x] T011 [P] RED `tests/main/application/services/settings-service.test.ts`: cenário "load returns deep-equal do objeto persistido" via stub que devolve um `Settings` pronto. → AC#4
- [x] T012 [P] RED `tests/main/application/services/settings-service.test.ts`: cenário "merge aplica deep-merge" — partial `{ adapters: { claude: { enabled: false } }, ui: { theme: 'dark' } }` sobre estado base; resultado deve manter `adapters.copilot` intacto e atualizar `adapters.claude.enabled` e `ui.theme`. → AC#5
- [x] T013 [P] RED `tests/main/application/services/settings-service.test.ts`: cenário "merge persiste via repository.save com objeto consolidado". → AC#5
- [x] T014 GREEN `src/main/application/services/settings-service.ts`: implementar `load()`, `save(settings)`, `merge(partial)`, `getDefaults()` delegando deep-merge a util própria (sem libs externas). Todos os testes da fase verdes. → AC#4, AC#5
- [x] T015 RED `tests/main/application/services/repo-service.test.ts`: cenários cobrindo `detectGit(path)` true (subdir `.git/`) e false (sem `.git/`); `getCurrentBranch(path)` retornando `'main'` para fixture `tests/fixtures/git-head/head-ref.txt` copiada como `.git/HEAD` em tmpdir. → AC#6, AC#7
- [x] T016 [P] RED `tests/main/application/services/repo-service.test.ts`: cenários `getCurrentBranch` retornando `null` para fixtures `head-detached.txt`, `head-packed-refs.txt` e `head-garbage.txt`; nenhum cenário deve lançar. → AC#19
- [x] T017 [P] RED `tests/main/application/services/workspace-bootstrap.test.ts`: cenário "cria todos os subdiretórios listados em `WorkspacePaths` dentro do `workspacePath`". → AC#3
- [x] T018 [P] RED `tests/main/application/services/workspace-bootstrap.test.ts`: cenário "rerun é idempotente — não falha quando subdiretórios já existem". → AC#3
- [x] T019 GREEN `src/main/application/services/repo-service.ts`: implementar `RepoService` consumindo um port `RepoReader` (com `exists(path)`, `readFile(path)`); parser de `.git/HEAD` aceita apenas linhas `ref: refs/heads/<branch>`. → AC#6, AC#7, AC#19
- [x] T020 GREEN `src/main/application/services/workspace-bootstrap.ts`: implementar `WorkspaceBootstrapService.create(workspacePath)` consumindo port `FileSystemMutator` (com `mkdirRecursive`); itera `WorkspacePaths` e chama `mkdir -p` equivalente. → AC#3
- [x] T021 GREEN `src/main/application/ports/repo-reader.ts` e `src/main/application/ports/file-system-mutator.ts`: declarar interfaces consumidas em T019/T020.

## Phase 4 — Infrastructure

- [x] T022 RED `tests/main/infrastructure/fs-settings-repository.test.ts`: cenário "load retorna null quando arquivo não existe (ENOENT)" e "load retorna objeto parseado quando arquivo existe" usando tmpdir real. → AC#4
- [x] T023 [P] RED `tests/main/infrastructure/fs-settings-repository.test.ts`: cenário "save é atômico — escreve em tempfile no mesmo diretório e renomeia para destino"; verificar via spy/mock em `fs.promises.rename` que tempfile fica no mesmo diretório do destino. → AC#17
- [x] T024 [P] RED `tests/main/infrastructure/fs-settings-repository.test.ts`: cenário "save preserva versão anterior se rename lança" — escrever um `settings.json` v1, mockar `rename` para falhar; após o erro o conteúdo no destino deve ser bit-a-bit o v1 e o tempfile deve ser limpo (ou ficar fora do destino final). → AC#17
- [x] T025 GREEN `src/main/infrastructure/settings/fs-settings-repository.ts`: implementar `FsSettingsRepository` com `load()` (catch `ENOENT` → null) e `save()` (escreve `<dir>/.settings.json.<rand>.tmp`, `fs.rename` para destino, em catch remove tempfile). Substituir `InMemorySettingsRepository` no wiring de `src/main/index.ts`. → AC#2, AC#4, AC#17
- [x] T026 [P] RED `tests/main/infrastructure/fs-workspace-bootstrap.test.ts`: cenário "EACCES/ENOSPC durante mkdir resulta em rejeição com `DomainError` kind `io`" via `fs.promises.mkdir` mockado. → AC#3, AC#18
- [x] T027 GREEN `src/main/infrastructure/workspace/fs-workspace-bootstrap.ts`: implementar `FsWorkspaceBootstrap` que satisfaz o port `FileSystemMutator`, mapeando erros nativos (`EACCES`, `ENOSPC`, `EROFS`) para `DomainError({ kind: 'io', ... })`. → AC#3, AC#18
- [x] T028 GREEN `src/main/infrastructure/repo/fs-repo-reader.ts`: implementar `FsRepoReader` consumido por `RepoService`; nenhuma lógica de parsing aqui (só leitura crua). → AC#6, AC#7

## Phase 5 — IPC

- [x] T029 RED `tests/main/ipc/registry.test.ts`: para cada novo método (`settings.save`, `settings.merge`, `repo.detectGit`, `repo.getCurrentBranch`, `repo.link`, `repo.unlink`, `repo.list`, `workspace.bootstrap`, `dialog.selectFolder`), verificar que dispatcher despacha para o serviço correto e propaga payload/result. Cada método em uma asserção isolada. → AC#2, AC#3, AC#6, AC#8, AC#9, AC#13, AC#14
- [x] T030 GREEN `src/main/ipc/registry.ts`: ampliar `IpcDeps` para incluir `repoService`, `workspaceBootstrap` e um `dialogPort` (port a ser definido); registrar todos os handlers listados em T029. `repo.link` deve: validar via `repoService.detectGit(path)`, rejeitar com `DomainError({ kind: 'validation' })` se falso; deduplicar entrada com mesmo `path` antes de persistir; chamar `settingsService.merge` para gravar a nova lista. → AC#9, AC#11, AC#13
- [x] T031 GREEN `src/main/ipc/registry.ts`: handler `repo.list` retorna `LinkedRepoView[]` recomputando `branch` via `repoService.getCurrentBranch(path)` para cada repo. → AC#9
- [x] T032 GREEN `src/main/index.ts`: instanciar `FsSettingsRepository`, `FsRepoReader`, `FsWorkspaceBootstrap`, `RepoService`, `SettingsService`, `WorkspaceBootstrapService`, `DialogPort` (Electron `dialog.showOpenDialog`); injetar em `buildHandlers`. → AC#2, AC#3
- [x] T033 GREEN `src/preload/index.ts`: garantir que `window.api.call` cobre todos os novos métodos (revisar typings em `src/shared/ipc-contract.ts` se necessário); adicionar tipagem de método→params/result se o contrato exigir. → AC#1, AC#8

## Phase 6 — Renderer

- [x] T034 RED `tests/renderer/screens/onboarding.test.tsx`: render da tela Onboarding deve (a) exibir botão de seleção de pasta com label referenciando default `~/sde-ai-app`, (b) **não** conter elementos de toggle de adapter, (c) **não** conter UI de listagem/adição de repos. → AC#15, AC#16
- [x] T035 [P] RED `tests/renderer/bootstrap-router.test.tsx`: três cenários: `settings.get` resolve `null` → renderiza `<Onboarding>`; resolve `Settings` com `workspacePath` válido → renderiza `<Main>`; resolve `Settings` com `workspacePath` inválido → renderiza `<WorkspaceMissing>` (mock de `window.api.call('workspace.exists', …)` ou similar). → AC#1, AC#12
- [x] T036 [P] RED `tests/renderer/screens/workspace-missing.test.tsx`: tela exibe botões "Re-selecionar pasta" e "Cancelar"; click em "Re-selecionar" dispara `dialog.selectFolder` + `settings.merge({ workspacePath })`; estado de `adapters` e `linkedRepos` no payload de merge permanece **omitido** (deep-merge preservará). → AC#14
- [x] T037 [P] RED `tests/renderer/screens/settings.test.tsx`: cenários: (a) toggle de `adapters.claude.enabled` chama `settings.merge` com payload mínimo; (b) adicionar repo cujo path **não tem `.git/`** mostra mensagem de erro e não chama `repo.link`; (c) adicionar repo válido abre modal de confirmação; confirmar chama `repo.link`, cancelar **não** chama; (d) adicionar mesmo path duas vezes resulta em uma única entrada na lista (verificar via `repo.list` mockado). → AC#8, AC#9, AC#10, AC#11, AC#13
- [x] T038 [P] RED `tests/renderer/screens/settings.test.tsx`: cenário extra: o modal de confirmação contém texto explícito mencionando "symlink" e "commit" (snapshot ou `getByText` regex). → AC#10, AC#13
- [x] T039 [P] RED `tests/renderer/screens/io-error.test.tsx`: tela exibe botões "Tentar novamente" e "Cancelar"; "Tentar novamente" reexecuta a operação que falhou (callback injetado via prop). → AC#18
- [x] T040 GREEN implementar `src/renderer/App.tsx` (bootstrap router) + `src/renderer/screens/Onboarding.tsx`, `src/renderer/screens/WorkspaceMissing.tsx`, `src/renderer/screens/IoError.tsx` e shell `src/renderer/screens/Main.tsx`. Onboarding: dialog → `workspace.bootstrap` → `settings.merge({ workspacePath, adapters: defaults, linkedRepos: [], ui: defaults })` derivado de `getDefaults()`; em qualquer falha de I/O renderiza `<IoError onRetry={…} />`. → AC#1, AC#2, AC#3, AC#12, AC#14, AC#16, AC#18
- [x] T041 GREEN `src/renderer/screens/Settings.tsx`: lista linkedRepos via `repo.list` (com branch dinâmico), toggles de adapter via `settings.merge`, botão "Add repo" abre dialog → valida via `repo.detectGit` → modal de confirmação → `repo.link`; remove via `repo.unlink`. Dedupe por `path` antes de chamar `repo.link`. → AC#8, AC#9, AC#10, AC#11, AC#13
- [x] T042 REFACTOR consolidar utilitário de chamada `window.api.call<T>(method, params)` em `src/renderer/lib/ipc.ts` se necessário; `npm test` continua verde.

## Phase 7 — Verification

- [x] T043 [P] `npm run lint` passa sem warnings novos. → AC#1–AC#19
- [x] T044 [P] `npm run typecheck` passa em `tsconfig.node.json` e `tsconfig.web.json`. → AC#1–AC#19
- [x] T045 `npm test` passa com cobertura ≥ 80% nas pastas `src/main/application/services/`, `src/main/infrastructure/settings/`, `src/main/infrastructure/workspace/`, `src/main/infrastructure/repo/` e `src/renderer/screens/`. → AC#4, AC#5, AC#6, AC#7, AC#17, AC#19
- [x] T046 Smoke manual: `npm run dev` em diretório com `userData` limpo (`rm -rf "$HOME/Library/Application Support/sde-ai-app"`); confirmar (a) onboarding aparece, (b) seleção cria estrutura em disco (`ls <workspace>` mostra todos os 6 subdiretórios), (c) `settings.json` em `~/Library/Application Support/sde-ai-app/settings.json` contém o shape esperado de AC#2/AC#16, (d) reabertura abre tela principal. Documentar passo a passo no PR description. → AC#1, AC#2, AC#3, AC#12, AC#16 *(pendente — requer ação manual do autor)*

## Phase 8 — Bookkeeping (sync de docs antes de `status: done`)

> ROADMAP **não** é atualizado nesta phase — entra apenas no retro quinzenal (PRD §6 / CLAUDE.md).

- [x] T047 Reconciliar `docs/ARCH.md §9`: garantir ADRs (criar/atualizar) cobrindo as decisões registradas em "Considered alternatives" desta spec — destaque para (i) escrita atômica de `settings.json` via tempfile + rename, (ii) não-persistência de `linkedRepos[].branch`, (iii) modal obrigatório de aviso ao linkar repo, (iv) tela de erro em vez de re-onboarding quando `workspacePath` é inválido, (v) `getCurrentBranch` retornando `null` em HEAD não-padrão. Referenciar spec `002`.
- [x] T048 Avaliar se `docs/PRD.md §4` (must-have / should-have / nice-to-have) precisa ajuste após a implementação — em particular se a redação de "Settings: enable/disable adapter, default scope, management of linked repos" reflete o comportamento entregue (modal, dedupe, validação de `.git/`). Registrar a decisão (PR description ou nota no spec) mesmo se for N/A.
- [x] T049 Frontmatter de `docs/specs/002-onboarding-settings/SPEC.md`: marcar `status: active` ao iniciar Phase 1, `status: review` após Verification verde, `status: done` após retro; atualizar `updated_at` em cada transição; preencher `branch` quando criar a branch de implementação.
