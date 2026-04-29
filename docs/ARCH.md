---
title: "ARCH — Skillforge (sde-ai-app)"
internal_name: sde-ai-app
codename: forge
public_name: Skillforge
status: Draft
created_at: 2026-04-19
updated_at: 2026-04-25
---

> [!NOTE]
> Problem, scope and metrics in [PRD.md](./PRD.md).
> When implementing a feature or fixing a bug, keep PRD and ARCH in sync.

## 1. Introduction and goals

### 1.1 System goal (1 sentence)

Local GUI for a solo dev to create/edit AI artifacts (skills, references, agent profiles) in Markdown+YAML, versioned in manual git, and sync them via **symlink** to Claude Code and Copilot in personal and project scopes — validating whether centralizing this context is worthwhile (spike with no hard deadline; stop rule in PRD §6).

### 1.2 Stakeholders

| Role | Expectation |
|---|---|
| Solo dev (author) | Validate whether centralizing context is worthwhile (no hard deadline; stop rule in PRD §6); personal use on macOS. |

### 1.3 Essential goals

- Centralize AI artifacts in a single versionable workspace.
- Sync to Claude Code and Copilot without copying (symlink).
- Maintain manual git flow (commit/push by the dev).
- Serve as a spike: time > polish.

---

## 2. Architectural constraints

Non-negotiable constraints inherited from the PRD:

- Stack: **Electron + React + TypeScript** (single Node runtime in the Main process). No backend, API, database, auth, telemetry.
- Target platform: **macOS only** (Linux/Windows out of scope).
- Sync: **symlink** (single source), no copy. Save is the only action.
- Git: **read-only** (detect repo, branch). Manual commit.
- Target tools: **Claude Code and Copilot only**. Others are out.
- Time-box: 1 dev, no hard deadline; stop rule in PRD §6 (8-week soft cap).

---

## 3. System scope and context

### 3.1 Technical context — process boundaries

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Electron Process                            │
│                                                                      │
│  ┌─────────────────┐   contextBridge   ┌────────────────────────┐    │
│  │   Renderer      │◄─────IPC─────────►│  Main (Node.js + TS)   │    │
│  │   (React + TS)  │                   │                        │    │
│  │                 │                   │  - windows/menus       │    │
│  │  - Editor       │                   │  - keytar (secrets)    │    │
│  │  - Preview      │                   │  - Main services:      │    │
│  │  - Settings     │                   │    ArtifactService     │    │
│  └─────────────────┘                   │    AdapterManager      │    │
│                                        │      ├─ ClaudeAdapter  │    │
│                                        │      └─ CopilotAdapter │    │
│                                        │    SymlinkManager      │    │
│                                        │    TemplateService     │    │
│                                        │    RepoService         │    │
│                                        │    SettingsService     │    │
│                                        │    ClaudeTokenParser   │    │
│                                        │    CopilotUsageClient  │    │
│                                        │ CopilotInstructionsGen │    │
│                                        └────────────┬───────────┘    │
│                                                     │                │
└─────────────────────────────────────────────────────┼────────────────┘
                                                      │ filesystem + HTTPS
                                                      ▼
              ┌────────────────┬────────────────────┬────────────────┐
              │  Workspace     │  ~/.claude/        │  GitHub API    │
              │  (artifacts)   │  ~/.copilot/       │  (usage)       │
              │  <repo>/.claude│  <repo>/.github    │                │
              └────────────────┴────────────────────┴────────────────┘
```

### 3.2 External systems

| System | Interaction type |
|---|---|
| User filesystem (`~/.claude/`, `~/.copilot/`, repos) | Symlinks (write) and reads. |
| GitHub API (`/user/copilot/usage`) | HTTP GET with the user's PAT. |
| Keychain (macOS) | Secret storage (PAT) via `keytar`. |
| Linked local git repos | Read of `.git/HEAD` and `.git/config`. |

### 3.3 Out of architectural scope

This doc **does not cover**:

- Visual design, UI components, design tokens — PRD marks polish as out of scope.
- Test strategy and CI/CD pipeline — spike, validation is dogfooding itself.
- Packaging for Linux/Windows — PRD limits to macOS.
- App signing/notarization for distribution — spike is local use by the author.
- Observability (metrics, traces) — PRD discards telemetry.
- Update/autoupdate strategy — throwaway.
- Internationalization — out of scope in the PRD.
- Access control, multi-user, auth — spike is single-user.
- Token cost in dollars — PRD explicitly out (§5).
- Copilot token breakdown per skill — PRD explicitly out (§5).

---

## 4. Solution strategy

### 4.1 Confirmed stack

| Layer     | Technology                         | Note                                                 |
| --------- | ---------------------------------- | ---------------------------------------------------- |
| Shell     | Electron (latest LTS at the start) | `contextIsolation: true`, `nodeIntegration: false`. Version pinned; `electron-rebuild` runs in `postinstall` to rebuild keytar's native module. |
| UI        | React + TypeScript                 | No SSR. Bundler at the dev's choice (Vite recommended).|
| Main services | TypeScript + Node stdlib (`fs`, `path`, `readline`, `fetch`) + `yaml`/`js-yaml` | Domain logic lives in the Main process. No subprocess, no separate runtime. See ADR-11. |
| IPC       | Electron `contextBridge` + `ipcRenderer.invoke` | Renderer ↔ Main only. See ADR-11.                  |
| Secrets   | Keychain via `keytar`              | Cross-platform at low cost — see ADR-4.              |
| Markdown  | React library (e.g. react-markdown) | Rendering only, no WYSIWYG editing.                 |
| Git       | Direct read of `.git/HEAD` in TS   | No `simple-git`, no `nodegit` — avoids heavy dependency. |

### 4.2 Structural decisions (summary — details in §9)

- **TypeScript-only inside the Electron Main process** → no subprocess, no protocol design, single stack to debug. See ADR-11.
- **`contextBridge` as the IPC surface** → direct Renderer ↔ Main calls, no network, no local auth.
- **Symlink as the sync mechanism** (locked by the PRD) → single source, no copy.
- **Monolith per component, no persistence beyond files** → consistent with spike timeline.

---

## 5. Building blocks view

Static view of the system components.

### 5.1 Renderer (React)

- **Responsibility:** UI (listing, markdown editor, preview, Settings, tokens dashboard).
- **Does not do:** filesystem, process spawning, external HTTP calls. Everything via IPC.
- **Dependencies:** Main (via `window.api` exposed by the preload).

### 5.2 Main (Electron, Node.js + TypeScript)

- **Responsibility:** app lifecycle; creates window; exposes IPC in the preload; **hosts the domain services** (CRUD, sync, adapters, settings, repos); resolves secrets via `keytar` (Copilot PAT).
- **Does not do:** rendering, direct DOM access. The Renderer never touches the filesystem or HTTP — every effect goes through the Main services.
- **Dependencies:** Node stdlib, Keychain system, `yaml`/`js-yaml`.

### 5.3 Main services (TypeScript)

Domain logic organized as TypeScript modules inside the Main process. No subprocess, no protocol — the Renderer reaches them via `contextBridge` (see §8.1).

| Service                         | Responsibility                                                                | Does not do                                   |
| ------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------- |
| `ArtifactService`               | CRUD of `.md` with YAML frontmatter; reads/writes in the workspace.           | Sync, symlink, UI.                            |
| `AdapterManager`                | Orchestrates active adapters; requests sync from the right one(s) after Save. | Per-tool logic.                               |
| `ClaudeAdapter`                 | Maps artifact → Claude paths (personal and project); delegates to SymlinkManager. | HTTP, API, tokens.                         |
| `CopilotAdapter`                | Maps artifact → Copilot paths; triggers `copilot-instructions` generator.     | Tokens.                                       |
| `SymlinkManager`                | Creates, removes and validates symlinks; detects conflicts (real file at destination). Normalizes paths via `path.resolve` to handle spaces and special characters. | Content copy, git.                   |
| `TemplateService`               | Provides templates by type (skill/reference/agent).                           | Rendering.                                    |
| `RepoService`                   | Detects `.git/`, reads current branch; lists linked repos.                    | Git write, commit, push.                      |
| `SettingsService`               | Loads/persists `settings.json`; merges defaults.                              | Secrets (PAT lives in Keychain).              |
| `SchemaValidator` (should-have) | Validates frontmatter against per-type schema.                                | Automatic sanitization.                       |
| `SearchService` (should-have)   | In-memory text search (name + content).                                       | Persistent indexing.                          |
| `ClaudeTokenParser` (nice-to-have)   | Reads JSONL from `~/.claude/projects/*/`, aggregates tokens by skill and project. Isolated module: silent failure with log if JSONL format changes. | Dollar cost, UI.                       |
| `CopilotUsageClient` (nice-to-have)  | HTTP GET against GitHub Usage API with PAT (resolved from Keychain on the call). | Storing PAT, UI.                          |
| `CopilotInstructionsGen`        | Aggregates flagged references (frontmatter flag) into generated `copilot-instructions.md`; applies `chmod 444`. | Editing the file; symlink (delegates). |

---

## 6. Runtime view

Dynamic scenarios: how the blocks collaborate in critical flows.

### 6.1 Save artifact (happy path)

1. Renderer invokes `artifact.save` with payload + list of active adapters.
2. `ArtifactService` validates frontmatter → writes the source file in the workspace → updates `updatedAt`.
3. `AdapterManager` consults active adapters:
   - `ClaudeAdapter`: resolves destinations (`~/.claude/...` and, if `scope=project`, each repo linked in Settings).
   - `CopilotAdapter`: same; if the artifact is a `reference` with `includeInCopilotInstructions`, triggers `CopilotInstructionsGen`.
4. `SymlinkManager` creates/updates a symlink for each destination.
5. Returns `SyncResult[]` with `{ adapter, destination, status: ok|conflict|error, message }`.
6. Renderer updates preview + toast.

### 6.2 Save — failure due to destination conflict

- Destination exists and **is a symlink** pointing to another location: **overwrite** and log a warning in the `SyncResult` (user requested this behavior).
- Destination exists and **is not a symlink** (real file): **overwrite** the file, but emit `SyncResult.status = conflict` with `action: overwritten` and the path of the backup saved at `<workspace>/_backups/<timestamp>/`.
- Renderer shows a post-save modal listing each conflict; user can restore from backup manually.

> **Backup retention:** not defined in the spike — `_backups/` is never auto-cleaned. Revisit (time/size cap) post-spike if volume grows.

> **Rollback:** the source save is already done. If sync fails on some destinations, those that worked stay. There is no atomic cross-destination transaction — it's listed in the report.

### 6.3 Disable adapter

1. User toggles the switch in Settings.
2. Renderer asks "remove symlinks created by this adapter?".
3. If yes: `SymlinkManager` scans registered destinations (derived from artifacts), removes only symlinks whose target points to the workspace. Never removes real files.
4. Persists the setting; adapter is off.

### 6.4 Regenerate `copilot-instructions.md`

1. Triggered by: save of a flagged reference; toggle of the flag; "Sync all"; manual button in Settings.
2. `CopilotInstructionsGen` lists references with `includeInCopilotInstructions: true`, concatenates them in alphabetical order by `name`, writes to `_generated/copilot-instructions.md` with header `<!-- GENERATED — edit references in the app -->`, applies `chmod 444`. The header + `chmod 444` are friction only, not security: a "force save" editor can still overwrite, and that's accepted.
3. `CopilotAdapter` ensures symlinks to active destinations: `~/.copilot/` (personal) and `<linked-repo>/.github/copilot-instructions.md` for every linked repo (regardless of which references contributed — the generated file is unified).

### 6.5 Passive token reading (Claude)

1. User opens the dashboard; Renderer invokes `tokens.claude.stats` with a time window.
2. `ClaudeTokenParser` lists JSONLs in `~/.claude/projects/*/`, streams line-by-line (without loading everything into RAM), extracts `tool_use` events where `name == "Skill"` and `input.skill` matches a known slug — **matching pattern:** compare `input.skill` (or `skillName`, if it exists) against workspace slugs; fallback: regex on `file_path` containing `/skills/<slug>/`.
3. Aggregates `input_tokens`/`output_tokens` per skill and per project (parent folder of the JSONL).
4. Returns the aggregated series. No persistent cache in the spike — re-reads on each request.

> **ASSUMPTION:** the JSONL format follows what Claude Code currently exposes in `~/.claude/projects/`. Format breakage is an accepted risk (PRD §8). The matching strategy (tool name `Skill` + `input.skill`) is to be **validated in week 4 with real data**; if it breaks, `ClaudeTokenParser` fails silently with a log entry (see §5.3) and the dashboard returns empty.

> **Dashboard UI debt:** filters by date and grouping by skill/project are intentionally simple in the spike. Period/session aggregation and richer slicing are to be refined in the UI design post-spike.

### 6.6 First use

1. App detects absence of `settings.json` → opens onboarding.
2. User picks the workspace folder (default `~/sde-ai-app`).
3. Settings creates the workspace (`mkdir -p` + subfolders), writes the initial `settings.json`.
4. User enables adapters, optionally links repos, creates the first artifact via template.

> **Repo linking warning:** when the user links a repo, the UI shows an explicit warning that artifact symlinks created inside the repo may be committed as links by `git add` (per PRD §6); the dev decides whether to add them to `.gitignore`.

---

## 7. Deployment view

### 7.1 Platform and packaging

- **Single target:** macOS (Apple Silicon and Intel; architecture defined at build time).
- Electron app packaged as `.app` — single artifact, no embedded subprocess binary.
- Spike runs **unsigned** (`xattr -d com.apple.quarantine`); signing/notarization is post-spike.

### 7.2 Workspace layout (artifacts on disk)

```
<workspace>/
├─ skills/
│  └─ <slug>/
│     ├─ SKILL.md         # source
│     └─ <optional assets>
├─ references/
│  └─ <slug>.md
├─ agents/
│  └─ <slug>.md
├─ _generated/
│  └─ copilot-instructions.md   # generated, 444
├─ _backups/
│  └─ <timestamp>/        # files overwritten on destination conflict (§6.2); never auto-cleaned
└─ .sde/
   └─ templates/          # custom templates (optional)
```

> **Custom templates:** PRD §4 requires `≥1 template per type` (built-in). The `.sde/templates/` folder leaves the door open for the user to drop their own — not a must-have, but the layout supports it cheaply.

### 7.3 Config and log locations (on the host)

| File | Path |
|---|---|
| `settings.json` | `app.getPath('userData')/settings.json` (macOS: `~/Library/Application Support/sde-ai-app/`) |
| Main service log | `<userData>/logs/main.log` |
| Copilot PAT | Keychain via `keytar` (`service="sde-ai-app"`, `account="copilot-pat"`) |

### 7.4 Symlink destinations

- **Source:**
  - Skills: directory `<workspace>/skills/<slug>/` (the symlink targets the **directory**, mirroring Claude's layout and carrying any optional assets next to `SKILL.md`).
  - References: file `<workspace>/references/<slug>.md`.
  - Agents: file `<workspace>/agents/<slug>.md`.
- **Targets (symlink destinations):** by scope — `personal` → `~/.claude/`, `~/.copilot/`; `project` → `<linked-repo>/.claude/`, `<linked-repo>/.github/` (one symlink per linked repo). Skill symlinks are always directory-level; references and agents are file-level.
- **Generation:** `<workspace>/_generated/copilot-instructions.md` is the source of the Copilot symlink; `chmod 444` after each generation.

---

## 8. Cross-cutting concepts

### 8.1 Renderer ↔ Main contract

- Transport: `contextBridge.exposeInMainWorld('api', …)` in the preload, backed by `ipcRenderer.invoke`.
- Method: `await window.api.call(method: string, params: object) → result | error`.
- A single `call` method that multiplexes; Main dispatches to the corresponding service (see §5.3). Errors propagate as rejected promises shaped per §8.3.
- Unhandled exceptions inside a service are caught at the dispatch boundary and serialized into the error envelope — they never crash the app.

**Methods (summary — see `docs/IPC.md` if detailed later):**

| Method                          | Params                                   | Result                              |
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
| `tokens.copilot.stats`          | `{ from, to }` (PAT resolved by Main from Keychain) | `CopilotUsage`            |

### 8.2 Error handling

Every Main service rejection serializes to a plain object propagated through `ipcRenderer.invoke`:

```json
{ "kind": "<slug>", "message": "<human>", "details": { ... } }
```

`kind` enum: `validation`, `io`, `symlink_conflict`, `not_found`, `external_api`, `unauthorized`, `internal`.

### 8.3 External HTTP (Copilot)

- Endpoint: `GET https://api.github.com/user/copilot/usage` (fallback `/orgs/{org}/copilot/usage` if organizational PAT).
- Auth: `Authorization: Bearer <PAT>`.
- Handled errors: 401 → `unauthorized`; 404 → `not_found` (plan without Copilot); ≥500 → `external_api` with exponential retry (max 3).
- **Fallback:** if the endpoint is unavailable, the plan does not include Copilot, or the schema changes, the app estimates token cost via a local tokenizer over the artifact content (see PRD §4 nice-to-have).

### 8.4 Data model — YAML frontmatter

Standardization proposal (**ASSUMPTION**). Same schema for the 3 types, with optional type-specific fields:

```yaml
---
slug: code-review-checklist          # required, [a-z0-9-], unique per type
name: Code Review Checklist          # required, human-readable
type: skill                          # required: skill | reference | agent
description: Quick checklist for PRs. # required, ≤200 chars
scope: personal                      # required: personal | project
version: 0.1.0                       # required, semver
tags: [review, quality]              # optional
createdAt: 2026-04-20T10:00:00Z      # generated by the app
updatedAt: 2026-04-20T10:00:00Z      # generated by the app
# Type-specific:
includeInCopilotInstructions: true   # reference only — aggregates into copilot-instructions.md
---
```

Artifacts with `scope: project` are replicated (via symlink) in **all** linked repos in Settings — there is no per-artifact selection.

> **Frontmatter debt:** the schema above is an **initial proposal**. Refine after creating the first 5+ real artifacts (dogfooding) — fields may be added, renamed or made optional based on actual usage.

### 8.5 Data model — `settings.json`

**Location:** `app.getPath('userData')/settings.json` (cross-platform — macOS: `~/Library/Application Support/sde-ai-app/`). Separates app config from the artifact workspace (see ADR-5).

```json
{
  "workspacePath": "~/sde-ai-app",
  "adapters": {
    "claude": { "enabled": true },
    "copilot": { "enabled": false }
  },
  "linkedRepos": [
    { "id": "uuid", "name": "ogs-tech", "path": "/Users/x/Projects/ogs-tech" }
  ],
  "ui": { "theme": "system" }
}
```

The current branch of each linked repo is **not** persisted — it is recomputed on demand via `RepoService.getCurrentBranch(path)`. Persisting branch state would drift the moment the user switches branches in the repo.

The Copilot PAT does **not** live here — it's stored in Keychain via `keytar` with `service="sde-ai-app"`, `account="copilot-pat"`.

> **Schema migration debt:** the spike assumes a stable schema and does not version `settings.json`. Post-spike must add a `version` field and a migration step on app start.

### 8.6 Security

- Renderer with no direct access to Node/filesystem (`contextIsolation: true`, `nodeIntegration: false`).
- The Copilot PAT only lives in the Keychain; Main resolves it on demand for `CopilotUsageClient` calls and never exposes it through the `contextBridge`.
- No local auth (single-user); no open network port (IPC stays in-process via `ipcRenderer`/`ipcMain`).

---

## 9. Architectural decisions (ADR-lite)

| # | Decision | Discarded alternatives | Why chosen | Reversibility |
|---|---------|--------------------------|-------------------|-----------------|
| 1 | ~~Go as a single subprocess~~ — **superseded by ADR-11 (2026-04-25)** | — | — | — |
| 2 | ~~IPC via JSON-RPC 2.0 over stdin/stdout~~ — **superseded by ADR-11 (2026-04-25)** | — | — | — |
| 3 | Symlink as the sync mechanism | Copy with file-watcher; hardlink (fails on directory); bind mount (root) | PRD requires "single source, no copy"; macOS handles symlinks well cross-tool | **Locked by the PRD** |
| 4 | Copilot PAT in the Keychain (keytar) | Plaintext in `settings.json`; environment variable | Avoids leaks in backup/git/logs; keytar works cross-plat cheaply | High |
| 5 | Settings in `app.getPath('userData')` | `~/sde-ai-app/settings.json` (alongside the workspace) | Multi-platform; keeps workspace separate from app config | High — just a path migration |
| 6 | Frontmatter with single schema and per-type fields | Distinct schema per type; JSON instead of YAML | Less code, single editor; YAML is the convention in the ecosystem (Claude/Copilot) | High |
| 7 | `includeInCopilotInstructions` in the reference's frontmatter | Curated list in Settings; all references aggregated | Keeps the decision next to the artifact (versionable in git), less UI | Medium — simple migration if changed |
| 8 | Destination conflict: always overwrite, alert later | Abort; backup always; ask for modal confirmation per file | Save flow doesn't block; user surgically decides later | High |
| 9 | Read-only git via direct read of `.git/HEAD` and `.git/config` | `simple-git`, `nodegit`, shell out to `git` | Zero heavy dependency; covers 100% of what the PRD asks (detect repo + branch) | High |
| 10 | No persistent search index | SQLite FTS; LevelDB; Lunr | PRD is a spike, low N of artifacts, in-memory scan suffices | High |
| 11 | TypeScript-only stack inside the Electron Main process | Go subprocess + JSON-RPC (ADR-1, ADR-2); NestJS in Main; rewrite Main in another language | Single runtime → no protocol design, no `electron-rebuild` for a Go binary, no cross-process debug, no 1 MB stdio limit. Workload is I/O-bound (filesystem, HTTP, YAML) — Node handles it natively. The cost of the discarded path was ≈15-28% of the spike budget for zero technical gain in a single-user local app. | High — domain logic isolated as services that could be moved out later |
| 12 | Build/bundle via `electron-vite` (LTS) | Vite cru + `tsc` no Main; `electron-forge` | LTS suporta os 3 entry points (`main`/`preload`/`renderer`) + HMR no Renderer sem config significativa. Forge agrega packaging mas é overhead pré-spike; Vite + `tsc` fica como fallback se a fricção aparecer. Validado pela spec 001. | Alta — fallback Vite + `tsc` mantém o mesmo layout |
| 13 | Layering hexagonal leve no Main (`domain` / `application` / `infrastructure` / `ipc`) | Clean Architecture completa (entities/use-cases/interfaces/frameworks); flat | Hexagonal leve dá clareza de fronteiras e troca de adapter (ex.: `InMemorySettingsRepository` → `JsonFileSettingsRepository` na spec 002) sem cerimônia. Clean cheio é overkill para app desktop solo; flat dificulta substituir adapter. Validado pela spec 001. | Alta — promoção a Clean ou colapso para flat permanecem possíveis |
| 14 | Contrato IPC via single `call(method, params)` + dispatcher central | Um `ipcMain.handle` por operação; `tRPC`/`electron-trpc` | Single channel reduz superfície exposta via `contextBridge` e centraliza o error envelope (§8.2). Multi-channel duplica boilerplate; tRPC adiciona dependência runtime + schemas. Validado pela spec 001. | Alta — migração para tRPC ou multi-channel é viável se o contrato esticar |
| 15 | Escrita atômica de `settings.json` e artifacts via tempfile + `rename` | Write direto no destino; file locking (`flock`/`proper-lockfile`) | `rename` em mesmo FS é atômico em POSIX e NTFS; resolve corrupção parcial sem dependência externa. Write direto deixa janela de arquivo truncado se o processo é morto; locking adiciona complexidade desproporcional para um escritor único (Main process). Validado pelas specs 002 (`settings.json`) e 003 (artifacts em `<workspace>/<type>/<slug>`). | Alta — pode-se trocar por `proper-lockfile` se múltiplos escritores aparecerem |
| 16 | `linkedRepos[].branch` não persistido — recomputado via `RepoService.getCurrentBranch()` em cada uso | Snapshot ao linkar e congelar até re-link; persistir e atualizar via watcher de `.git/HEAD` | Snapshot mente assim que o usuário troca de branch; custo de ler `.git/HEAD` é negligível. Watcher exige listener em N repos para benefício marginal. Implica remover `branch` do shape em §8.5. Validado pela spec 002. | Alta — re-introduzir snapshot é trivial se aparecer custo de I/O |
| 17 | Modal de confirmação obrigatório no link de repo (texto explícito sobre symlinks possivelmente commitados) | Banner persistente em Settings; tooltip/inline help; nada | PRD §6 e ARCH §6.6 tratam como aviso explícito; tooltip é ignorado, banner vira ruído. Modal força reconhecimento uma vez por link. Validado pela spec 002. | Alta — substituir por banner/tooltip não invalida nenhum dado em disco |
| 18 | `workspacePath` inexistente na reabertura → tela de erro com "Re-selecionar pasta" / "Cancelar" | Disparar re-onboarding; recriar estrutura silenciosamente | Re-onboarding apaga `adapters`/`linkedRepos` já configurados; recriar silenciosamente mascara disco montado errado ou pasta renomeada. Tela de erro deixa decisão com o usuário e preserva configuração. Validado pela spec 002. | Alta — comportamento é um branch isolado no bootstrap router |
| 19 | `RepoService.getCurrentBranch` retorna `null` (não lança) em HEAD não-padrão (detached, packed-refs, garbage) | String sentinela (`"unknown"`, `"detached"`); lançar exceção | `null` força null-check no caller (TS) sem colidir com nome de branch válido; sentinela vira "branch fantasma" se vazada para UI; lançar obriga try/catch em todo consumidor para um caso esperado. Validado pela spec 002. | Alta — qualquer um dos modos descartados é ortogonal à interface |
| 20 | Identidade do artifact = `<type>/<slug>` derivada do path no disco | UUID por artifact; hash de conteúdo; índice paralelo em `catalog.json` | O par `<type>/<slug>` já é o path canônico no workspace; usá-lo como id elimina catálogo paralelo e remove fonte de drift entre arquivo e índice. UUID/hash exigem mapping table sem ganho funcional no spike. Validado pela spec 003. | Média — promover a UUID exige migração de paths e referências cruzadas (e.g., flag `includeInCopilotInstructions`) |
| 21 | Slug humano derivado de `name` via kebab-case, editável; regex `^[a-z0-9][a-z0-9-]*$`; colisão `<type>/<slug>` rejeita com `kind: validation` | UUID/hash como slug; auto-resolver colisão com sufixo `-2` | Slug humano é o path no disco e o que aparece em URLs do Claude/Copilot; auto-sufixo esconde duplicatas e gera drift entre `name` e `slug`. Rejeitar colisão força o usuário a renomear conscientemente. Validado pela spec 003. | Alta — relaxar regex ou ativar auto-sufixo é mudança local em `ArtifactService.save` |
| 22 | `artifact.save` retorna `{ artifact, syncReport: [] }` com hook de sync stub (vazio) durante a 003 | Adiar IPC `artifact.save` até a 004; entregar com sync hardcoded para Claude personal | Stub mantém o contrato IPC (ADR-14) estável e desbloqueia a UX de save desde já, sem hardcode acidental que vire débito quando a 004 plugar `AdapterManager`. Validado pela spec 003. | Alta — a 004 substitui apenas a implementação do hook; shape do retorno permanece |
| 23 | Persistência de artifacts via `fs/promises` direto em `FsArtifactRepository` (porta `ArtifactRepository` para in-memory em testes) | Repository pattern com `InMemoryArtifactRepository` também em produção; ORM/lib de persistência | Filesystem é a fonte de verdade do produto (PRD: "single source, no copy"); in-memory adapter cabe em testes da port (hexagonal — ADR-13) sem virar runtime de produção. ORM/biblioteca de persistência é overkill para Markdown + YAML. Validado pela spec 003. | Alta — adicionar cache ou trocar adapter é local à infrastructure layer |
| 24 | Editor Markdown = `<textarea>` nativo + preview via `react-markdown` | Monaco; CodeMirror; editor WYSIWYG (Tiptap) | PRD §5 explicitamente tira polish de escopo; textarea cobre dogfooding sem yak-shave de bundle/setup de Monaco/CodeMirror. Upgrade fica como debt se fricção real aparecer. Validado pela spec 003. | Alta — substituir o componente do editor não afeta IPC, services nem schema |
| 25 | Templates apenas built-in (`src/main/templates/`) nesta fase do spike; `.sde/templates/` fica como debt futura | Suportar `.sde/templates/` desde já; arquivo único por tipo sem catálogo | PRD §4 pede só "templates by type"; built-in cobre o must-have. Custom adiciona resolução de catálogo + UX de gerenciamento sem demanda comprovada no spike. Validado pela spec 003. | Alta — nova porta `TemplateRepository` já existe; basta adicionar adapter que lê do filesystem |
| 26 | Delete hard — remove arquivo/diretório no workspace; flag `removeSymlinks` é no-op até a 004 | Bloquear delete até a 004 entregar `SymlinkManager`; soft-delete movendo para `<workspace>/.trash/` | No-op explícito mantém o contrato IPC estável (ADR-14); soft-delete vira debt sem demanda do PRD; recuperação via `git checkout` quando o workspace estiver versionado. Validado pela spec 003. | Alta — promover a soft-delete é mudança local em `FsArtifactRepository.delete` |
| 27 | Validação mínima no save (presença de obrigatórios + `slug` regex + `description ≤ 200`) | Validação completa de schema agora; nenhuma validação até a spec 009 | Nenhuma validação deixa lixo no disco; completa duplica esforço com a 009 (`SchemaValidator`). Mínimo cobre apenas o que vira path ou aparece em UI sem invalidar a evolução para schema rico. Validado pela spec 003. | Alta — `SchemaValidator` da 009 entra como passo adicional no pipeline de save |
| 28 | Timestamp do diretório de backup = `YYYYMMDDTHHmmss` (UTC, segundos) com sufixo `-N` em colisão; um único timestamp compartilhado por save (todos os destinos conflitantes vão para o mesmo `<workspace>/_backups/<timestamp>/`, preservando o caminho relativo) | ISO ms `YYYYMMDDTHHmmss.sss` (duas operações no mesmo tick ainda colidem); `Date.now()` numérico (ilegível para restauração manual) | Único formato que cumpre zero-colisão de forma determinística (retry no sufixo é explícito e testável) e é legível para restauração manual — caso de uso real previsto em §6.2. Compartilhar timestamp por save elimina colisão intra-save e simplifica restauração. Validado pela spec 004. | Alta — formato é encapsulado em `SymlinkManager.timestampForNow`; trocar por ISO ms ou epoch numérico não afeta API |
| 29 | `scopes.includes('project')` com `linkedRepos: []` produz **um `SyncResult` por adapter habilitado** com `{ destination: null, status: "ok", details: { skipped: "no-linked-repos" } }` (mantendo as destinations de `personal` quando `scopes.includes('personal')`) | No-op silencioso (`SyncResult[]` vazio); `status: "error"` `kind: "validation"` | Save é válido (artifact gravado no workspace); registrar estruturadamente o "skipped" deixa rastro auditável e abre porta para UX futura sem mudar contrato. Modal pós-save (§6.2) só dispara para `status !== "ok"`, então o estado fica registrado mas não-intrusivo. Validado pelas specs 004 e 006. | Alta — substituir por toast ou error local não invalida shape do `SyncResult` |
| 30 | `Artifact.frontmatter.scopes: ArtifactScope[]` (sempre ≥1) substitui o singular `scope`; legacy `scope: <string>` é auto-migrado em leitura para `scopes: [<string>]` via helper `normalizeArtifactFrontmatter` no `FsArtifactRepository` | Manter `scope` singular e duplicar artefato quando precisa de ambos; adicionar valor `'both'` ao enum; migration script one-shot | Permite um único artifact alvejar `personal` + `project` sem duplicação; auto-migração na leitura é transparente (zero ação do usuário) e o custo extra (3 linhas no helper) é trivial. `'both'` no enum confunde "tag única" com "set membership"; script one-shot exige ação manual e quebra repos legados até rodar. `AdapterDestination.scope` (singular) permanece — é o destino *resolvido*, não a intenção do artifact. Validado pela spec 006. | Alta — remover o branch legado é mudança local no helper assim que não houver artifacts antigos em uso |
| 31 | `AdapterSettings` é só `{ enabled }`; o antigo `defaultScope` (`personal`/`project` por adapter) foi removido. `SettingsService.load`/`merge` faz strip silencioso da chave legada se presente em settings persistidos | Manter `defaultScope` como hint pra UI; substituir por `defaultScopes: ArtifactScope[]`; migration script | A intenção de escopo agora vive **no próprio artifact** (`frontmatter.scopes`), e nenhum service/adapter consumia `defaultScope` — era estado inerte gravado pela UI. Manter campo morto enviesa contrato e adiciona ruído em fixtures. Strip on load garante compatibilidade sem exigir ação do usuário. Validado pela spec 006 (Phase 10). | Alta — readicionar o campo é trivial caso a UI decida pré-popular escopos no `ArtifactEditor` |
| 32 | Personal global instruction files (`~/.claude/CLAUDE.md`, `~/.config/github-copilot/<editor>/global-copilot-instructions.md`) ficam **fora do escopo** do spike — o app gerencia apenas skills/references/agents; o usuário continua editando esses arquivos à mão | Tratar como novo artifact type single-instance (`personalInstructions`) sincronizado por adapter; estender `ClaudeAdapter`/`CopilotAdapter` para escrever esses paths além das pastas de artifact | PRD §6 tem stop rule e foco em validar centralização de skills/references/agents — adicionar instrução pessoal autoral livre amplia superfície (novo artifact type sem slug, single-instance, semântica de escopo distinta) sem evidência de que é o gargalo do dogfooding. O usuário já edita `CLAUDE.md` à mão sem fricção reportada; se o retro quinzenal apontar dor real, abre-se nova spec sem invalidar nada já entregue. | Alta — re-introduzir como artifact type ou novo serviço dedicado é aditivo; nenhum dado/contrato existente precisa migrar |

---

## 10. Quality requirements

Attributes derived from the PRD's constraints and goals. Not formal SLAs — they are spike targets.

| Attribute | Target | How to verify |
|---|---|---|
| **Time-to-validate** | App usable for dogfooding within the spike's 8-week soft cap (1 dev). | PRD §6 stop rule. |
| **Portability** | macOS only; portable code where cheap (paths, keytar). Linux/Windows stays as **debt** if requested later — code is portable but untested off macOS. | Build runs on macOS Apple Silicon and Intel. |
| **Secret security** | Copilot PAT never plaintext in file, log or git. | Manual inspection: `grep` in `userData/`, logs, settings. |
| **Service robustness** | Unhandled exception in a Main service is caught at the IPC dispatch boundary and surfaces as an error envelope; the app stays alive. | `try/catch` at the dispatch layer; manual fault injection in the spike. |
| **IPC latency** | Typical artifact save responds in < 1s; `contextBridge` round-trip overhead < 100ms. | Measure manually in the spike. |
| **Sync idempotency** | Re-save without changes does not create backups or duplicate symlinks. | Test fixture in week 1 — `artifact.save` 2× in a row. |
| **Non-invasive at destination** | Never deletes a real file at the destination without backup; never touches a file outside the workspace except via symlink. | Code review focused on `SymlinkManager`. |
| **Respect for manual git** | App never executes `git commit/push/checkout`. | Code review: zero shell-out to `git`. |

---

## 11. Glossary

| Term | Definition |
|---|---|
| **Artifact** | Markdown file with YAML frontmatter representing a skill, reference or agent profile. Unit of versioning and sync. |
| **Skill** | Artifact type; procedural instruction for the AI. On disk it is a directory `<slug>/SKILL.md` (mirrors the Claude Code layout). |
| **Reference** | Artifact type; reference textual content. May be aggregated into `copilot-instructions.md` via flag. |
| **Agent profile** | Artifact type; configuration of an agent (role, instructions, tools). |
| **Adapter** | Main service that knows the convention of a target tool (Claude or Copilot) and maps artifacts to destinations. |
| **Scope** | Artifact attribute: `personal` (sync to `~/.claude/`, `~/.copilot/`) or `project` (sync to each linked repo). |
| **Workspace** | Root directory where the app stores source artifacts (default `~/sde-ai-app`). |
| **Linked repo** | Local git repository the user linked in Settings; receives symlinks of artifacts with `scope: project`. |
| **Symlink** | Symbolic link in the filesystem; the sole sync mechanism — there is no copy. |
| **JSONL** | Files `~/.claude/projects/*/*.jsonl` that Claude Code writes with usage events (tool calls, tokens). |
| **PAT** | Personal Access Token from GitHub, required for the Copilot Usage API. Stored in the Keychain. |
| **Spike** | Time-boxed effort (no hard deadline; 8-week soft cap per PRD §6) to validate a hypothesis — in this case, "is centralizing AI context worthwhile?". |
