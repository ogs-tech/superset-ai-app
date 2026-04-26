---
title: "ARCH — Skillforge (sde-ai-app)"
internal_name: sde-ai-app
codename: forge
public_name: Skillforge
status: Ready
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

- Stack: **Electron + React + Go** via IPC. No backend, API, database, auth, telemetry.
- Target platform: **macOS only** (Linux/Windows out of scope).
- Sync: **symlink** (single source), no copy. Save is the only action.
- Git: **read-only** (detect repo, branch). Manual commit.
- Target tools: **Claude Code and Copilot only**. Others are out.
- Time-box: 1 dev, no hard deadline; stop rule in PRD §6 (8-week soft cap).

---

## 3. System scope and context

### 3.1 Technical context — process boundaries

```
┌──────────────────────────────────────────────────────────────────┐
│                         Electron Process                          │
│                                                                   │
│  ┌─────────────────┐   contextBridge   ┌──────────────────────┐   │
│  │   Renderer      │◄─────IPC─────────►│  Main (Node.js)      │   │
│  │   (React)       │                   │                      │   │
│  │                 │                   │  - windows/menus     │   │
│  │  - Editor       │                   │  - keytar (secrets)  │   │
│  │  - Preview      │                   │  - spawn Go Core     │   │
│  │  - Settings     │                   │  - JSON-RPC bridge   │   │
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
              │  (artifacts)   │  ~/.copilot/       │  (usage)     │
              │  <repo>/.claude│  <repo>/.github    │              │
              └────────────────┴────────────────────┴──────────────┘
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
| Core      | Go (stdlib + `yaml.v3`)            | Binary embedded in `resources/`.                     |
| IPC       | JSON-RPC 2.0 over stdin/stdout     | See ADR-2 in section 9.                              |
| Secrets   | Keychain via `keytar`              | Cross-platform at low cost — see ADR-4.              |
| Markdown  | React library (e.g. react-markdown) | Rendering only, no WYSIWYG editing.                 |
| Git       | Direct read of `.git/HEAD` in Go   | No libgit2, no `go-git` — avoids heavy dependency.   |

### 4.2 Structural decisions (summary — details in §9)

- **Go as a single subprocess** (not a native library) → isolated packaging and debugging.
- **JSON-RPC 2.0 over stdin/stdout** → zero network setup, no local auth.
- **Symlink as the sync mechanism** (locked by the PRD) → single source, no copy.
- **Monolith per component, no persistence beyond files** → consistent with spike timeline.

---

## 5. Building blocks view

Static view of the system components.

### 5.1 Renderer (React)

- **Responsibility:** UI (listing, markdown editor, preview, Settings, tokens dashboard).
- **Does not do:** filesystem, process spawning, external HTTP calls. Everything via IPC.
- **Dependencies:** Main (via `window.api` exposed by the preload).

### 5.2 Main (Electron, Node.js)

- **Responsibility:** app lifecycle; creates window; exposes IPC in the preload; **spawns the Go Core**; proxies Renderer↔Go calls; resolves secrets via `keytar` (Copilot PAT); handles Go restart/crash.
- **Does not do:** domain logic (no YAML parsing, no symlink, no git). It's a "dumb bridge" with security responsibility.
- **Dependencies:** Go Core (subprocess), Keychain system.

### 5.3 Go Core (subprocess)

Monolithic module in a single binary with internal services:

| Service                         | Responsibility                                                                | Does not do                                   |
| ------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------- |
| `ArtifactService`               | CRUD of `.md` with YAML frontmatter; reads/writes in the workspace.           | Sync, symlink, UI.                            |
| `AdapterManager`                | Orchestrates active adapters; requests sync from the right one(s) after Save. | Per-tool logic.                               |
| `ClaudeAdapter`                 | Maps artifact → Claude paths (personal and project); delegates to SymlinkManager. | HTTP, API, tokens.                         |
| `CopilotAdapter`                | Maps artifact → Copilot paths; triggers `copilot-instructions` generator.     | Tokens.                                       |
| `SymlinkManager`                | Creates, removes and validates symlinks; detects conflicts (real file at destination). Normalizes paths via `filepath.Abs` to handle spaces and special characters. | Content copy, git.                   |
| `TemplateService`               | Provides templates by type (skill/reference/agent).                           | Rendering.                                    |
| `RepoService`                   | Detects `.git/`, reads current branch; lists linked repos.                    | Git write, commit, push.                      |
| `SettingsService`               | Loads/persists `settings.json`; merges defaults.                              | Secrets (PAT lives in Keychain).              |
| `SchemaValidator` (should-have) | Validates frontmatter against per-type schema.                                | Automatic sanitization.                       |
| `SearchService` (should-have)   | In-memory text search (name + content).                                       | Persistent indexing.                          |
| `ClaudeTokenParser` (nice-to-have)   | Reads JSONL from `~/.claude/projects/*/`, aggregates tokens by skill and project. Isolated module: silent failure with log if JSONL format changes. | Dollar cost, UI.                       |
| `CopilotUsageClient` (nice-to-have)  | HTTP GET against GitHub Usage API with PAT (received via IPC on the call). | Storing PAT, UI.                          |
| `CopilotInstructionsGen`        | Aggregates flagged references (frontmatter flag) into generated `copilot-instructions.md`; applies `chmod 444`. | Editing the file; symlink (delegates). |

---

## 6. Runtime view

Dynamic scenarios: how the blocks collaborate in critical flows.

### 6.1 Save artifact (happy path)

1. Renderer sends `artifact.save` with payload + list of active adapters.
2. Go validates frontmatter → writes the source file in the workspace → updates `updatedAt`.
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
3. If yes: Go scans registered destinations (derived from artifacts), removes only symlinks whose target points to the workspace. Never removes real files.
4. Persists the setting; adapter is off.

### 6.4 Regenerate `copilot-instructions.md`

1. Triggered by: save of a flagged reference; toggle of the flag; "Sync all"; manual button in Settings.
2. `CopilotInstructionsGen` lists references with `includeInCopilotInstructions: true`, concatenates them in alphabetical order by `name`, writes to `_generated/copilot-instructions.md` with header `<!-- GENERATED — edit references in the app -->`, applies `chmod 444`. The header + `chmod 444` are friction only, not security: a "force save" editor can still overwrite, and that's accepted.
3. `CopilotAdapter` ensures symlinks to active destinations (personal and each linked repo with the flag).

### 6.5 Passive token reading (Claude)

1. User opens the dashboard; Renderer sends `tokens.claude.stats` with a time window.
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
- Electron app packaged as `.app`; Go binary embedded in `resources/`.
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
└─ .sde/
   └─ templates/          # custom templates (optional)
```

> **Custom templates:** PRD §4 requires `≥1 template per type` (built-in). The `.sde/templates/` folder leaves the door open for the user to drop their own — not a must-have, but the layout supports it cheaply.

### 7.3 Config and log locations (on the host)

| File | Path |
|---|---|
| `settings.json` | `app.getPath('userData')/settings.json` (macOS: `~/Library/Application Support/sde-ai-app/`) |
| Go Core log | `<userData>/logs/core.log` |
| Copilot PAT | Keychain via `keytar` (`service="sde-ai-app"`, `account="copilot-pat"`) |

### 7.4 Symlink destinations

- **Source:** `<workspace>/skills/<slug>/SKILL.md` (skills are a directory, mirroring Claude), `<workspace>/references/<slug>.md`, `<workspace>/agents/<slug>.md`.
- **Targets (symlink destinations):** by scope — `personal` → `~/.claude/`, `~/.copilot/`; `project` → `<linked-repo>/.claude/`, `<linked-repo>/.github/` (one symlink per linked repo).
- **Generation:** `<workspace>/_generated/copilot-instructions.md` is the source of the Copilot symlink; `chmod 444` after each generation.

---

## 8. Cross-cutting concepts

### 8.1 Renderer ↔ Main contract

- Transport: `contextBridge.exposeInMainWorld('api', …)` in the preload.
- Method: `await window.api.call(method: string, params: object) → result | error`.
- A single `call` method that multiplexes — Main routes: secrets stay in Main; the rest is forwarded to Go.

### 8.2 Main ↔ Go Core contract

- Transport: subprocess **stdin/stdout**.
- Protocol: **JSON-RPC 2.0**, one message per line (`\n` delimiter).
- Max payload: 1 MB per message to avoid stdin/stdout deadlock with large messages; planned stress test in week 1.
- Per-request timeout: 10s (configurable); Go crash → Main respawns and notifies Renderer.
- Go stderr → log file at `<userData>/logs/core.log`.

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
| `tokens.copilot.stats`          | `{ from, to, pat }` (PAT injected by Main) | `CopilotUsage`                    |

### 8.3 Error handling

Every error follows JSON-RPC shape:

```json
{ "code": <int>, "message": "<human>", "data": { "kind": "<slug>", "details": {...} } }
```

`kind` enum: `validation`, `io`, `symlink_conflict`, `not_found`, `external_api`, `unauthorized`, `internal`.

### 8.4 External HTTP (Copilot)

- Endpoint: `GET https://api.github.com/user/copilot/usage` (fallback `/orgs/{org}/copilot/usage` if organizational PAT).
- Auth: `Authorization: Bearer <PAT>`.
- Handled errors: 401 → `unauthorized`; 404 → `not_found` (plan without Copilot); ≥500 → `external_api` with exponential retry (max 3).
- **Fallback:** if the endpoint is unavailable, the plan does not include Copilot, or the schema changes, the app estimates token cost via a local tokenizer over the artifact content (see PRD §4 nice-to-have).

### 8.5 Data model — YAML frontmatter

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

### 8.6 Data model — `settings.json`

**Location:** `app.getPath('userData')/settings.json` (cross-platform — macOS: `~/Library/Application Support/sde-ai-app/`). Separates app config from the artifact workspace (see ADR-5).

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

The Copilot PAT does **not** live here — it's stored in Keychain via `keytar` with `service="sde-ai-app"`, `account="copilot-pat"`.

> **Schema migration debt:** the spike assumes a stable schema and does not version `settings.json`. Post-spike must add a `version` field and a migration step on app start.

### 8.7 Security

- Renderer with no direct access to Node/filesystem (`contextIsolation: true`, `nodeIntegration: false`).
- The Copilot PAT only flows through Main (injected into IPC calls to Go) and lives in the Keychain.
- No local auth (single-user); no open network port (IPC over stdin/stdout).

---

## 9. Architectural decisions (ADR-lite)

| # | Decision | Discarded alternatives | Why chosen | Reversibility |
|---|---------|--------------------------|-------------------|-----------------|
| 1 | Go as a single subprocess (not a native library) | `c-shared` lib via cgo + Node addon; port everything to Node | Simple to package, independent debugging, isolated crash | High — just swap the transport |
| 2 | IPC via JSON-RPC 2.0 over stdin/stdout | HTTP localhost (exposed port, CORS); Unix socket (poor cross-plat); gRPC (complexity+tooling) | Zero network setup, no local auth needed, line-by-line is easy to debug | High — transport layer isolated |
| 3 | Symlink as the sync mechanism | Copy with file-watcher; hardlink (fails on directory); bind mount (root) | PRD requires "single source, no copy"; macOS handles symlinks well cross-tool | **Locked by the PRD** |
| 4 | Copilot PAT in the Keychain (keytar) | Plaintext in `settings.json`; environment variable | Avoids leaks in backup/git/logs; keytar works cross-plat cheaply | High |
| 5 | Settings in `app.getPath('userData')` | `~/sde-ai-app/settings.json` (alongside the workspace) | Multi-platform; keeps workspace separate from app config | High — just a path migration |
| 6 | Frontmatter with single schema and per-type fields | Distinct schema per type; JSON instead of YAML | Less code, single editor; YAML is the convention in the ecosystem (Claude/Copilot) | High |
| 7 | `includeInCopilotInstructions` in the reference's frontmatter | Curated list in Settings; all references aggregated | Keeps the decision next to the artifact (versionable in git), less UI | Medium — simple migration if changed |
| 8 | Destination conflict: always overwrite, alert later | Abort; backup always; ask for modal confirmation per file | Save flow doesn't block; user surgically decides later | High |
| 9 | Read-only git via direct read of `.git/HEAD` and `.git/config` | `go-git`, `libgit2`, shell out to `git` | Zero heavy dependency; covers 100% of what the PRD asks (detect repo + branch) | High |
| 10 | No persistent search index | SQLite FTS; BoltDB; Bleve | PRD is a spike, low N of artifacts, in-memory scan suffices | High |

---

## 10. Quality requirements

Attributes derived from the PRD's constraints and goals. Not formal SLAs — they are spike targets.

| Attribute | Target | How to verify |
|---|---|---|
| **Time-to-validate** | App usable for dogfooding within the spike's 8-week soft cap (1 dev). | PRD §6 stop rule. |
| **Portability** | macOS only; portable code where cheap (paths, keytar). Linux/Windows stays as **debt** if requested later — code is portable but untested off macOS. | Build runs on macOS Apple Silicon and Intel. |
| **Secret security** | Copilot PAT never plaintext in file, log or git. | Manual inspection: `grep` in `userData/`, logs, settings. |
| **Core robustness** | Go Core crash does not bring down the UI. | Main respawns; "core restarted" banner in Renderer. |
| **IPC latency** | Typical artifact save responds in < 1s. | Timeout configured at 10s; measure manually in the spike. |
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
| **Adapter** | Component of the Go Core that knows the convention of a target tool (Claude or Copilot) and maps artifacts to destinations. |
| **Scope** | Artifact attribute: `personal` (sync to `~/.claude/`, `~/.copilot/`) or `project` (sync to each linked repo). |
| **Workspace** | Root directory where the app stores source artifacts (default `~/sde-ai-app`). |
| **Linked repo** | Local git repository the user linked in Settings; receives symlinks of artifacts with `scope: project`. |
| **Symlink** | Symbolic link in the filesystem; the sole sync mechanism — there is no copy. |
| **JSONL** | Files `~/.claude/projects/*/*.jsonl` that Claude Code writes with usage events (tool calls, tokens). |
| **PAT** | Personal Access Token from GitHub, required for the Copilot Usage API. Stored in the Keychain. |
| **Spike** | Time-boxed effort (4 weeks) to validate a hypothesis — in this case, "is centralizing AI context worthwhile?". |
