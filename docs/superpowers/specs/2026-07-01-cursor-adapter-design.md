# Cursor Adapter — Design

- **Date:** 2026-07-01
- **Status:** Approved (design) — Cursor 2026 file surface verified against official docs; pending the ports/adapters refactor and an implementation plan.
- **Author:** Odenir Gomes (with Claude)
- **Scope:** Add a second sync target — **Cursor** — alongside the existing Claude adapter, so the
  same customizations (skills, agents, commands, global instruction) reach Cursor via its native
  file surface. The Claude adapter and its symlink behaviour are unchanged.

> Written in English to match the existing `docs/reference/*.md` and `docs/superpowers/specs/*.md`
> convention. The brainstorming conversation that produced it was in pt-BR.

---

## 1. Context and goal

The user's company pays for Cursor; they want their Superset AI customizations to show up in
Cursor without maintaining a second copy by hand. The app already syncs everything to Claude Code
by **symlinking** each workspace customization into `~/.claude/` (personal) or `<repo>/.claude/`
(project). Claude reads the workspace's Markdown + YAML-frontmatter format natively, so a symlink
is sufficient.

The goal is a **`CursorAdapter`** that publishes the same customizations into Cursor's file
locations, reusing the existing adapter / settings / health machinery.

## 2. Cursor's file surface (VERIFIED against official docs, mid-2026)

Cursor changed substantially since early 2026 and converged toward the SKILL.md / AGENTS.md open
standard. Verified from `cursor.com/docs`:

| Cursor concept | Directory (project) | Directory (global/home) | File | Frontmatter |
|---|---|---|---|---|
| **Agent Skills** | `.cursor/skills/<name>/` | `~/.cursor/skills/<name>/` | `SKILL.md` | `name`, `description`, optional `paths`, `disable-model-invocation`, `metadata` |
| **Subagents** | `.cursor/agents/<name>.md` | `~/.cursor/agents/<name>.md` | the `.md` itself | `name`, `description`, optional `model`, `readonly`, `is_background` + prompt body |
| **Commands** | — (being migrated) | — | — | Slash commands are **converted to skills** with `disable-model-invocation: true` (`/migrate-to-skills`). |
| **Always-on project instructions** | `<repo>/AGENTS.md` (root + subdirs); or `.cursor/rules/*.mdc` `alwaysApply:true` | **none** | plain Markdown | AGENTS.md has no frontmatter |
| **User/global rules** | — | **UI only** (Settings → Rules) | — | Not file-based; cannot be written by a file-sync app. |
| MCP | `.cursor/mcp.json` | `~/.cursor/mcp.json` | JSON | (out of scope) |

Two verified facts drive the design:

1. **Cursor reads legacy `.claude/skills/`, `~/.claude/skills/`, `.claude/agents/`** as fallback
   sources (`.cursor/` wins on name conflict). We do **not** rely on this — see Decision 3 — but it
   means skills/agents the app already syncs to Claude are, in practice, already visible to Cursor.
2. **Cursor has no file-based global instruction.** User Rules live only in the Settings UI. There
   is no `~/.cursor/AGENTS.md`, no global rules file, and Cursor does not read `~/.claude/CLAUDE.md`.
   The only file-based always-on target is per-project `AGENTS.md`.

## 3. Decisions made during brainstorming

1. **A second adapter, not a one-off migration.** The `CursorAdapter` lives beside `ClaudeAdapter`
   and is toggled via `adapters.cursor.enabled`. Claude behaviour is untouched.
2. **Architecture: extend the `Adapter` port with a materialization strategy (Approach A).** Each
   destination declares `strategy: 'symlink' | 'write'`. `symlink` is today's behaviour (used by
   Claude and by Cursor skills/agents). `write` renders transformed content and writes a generated
   file (used by Cursor commands and global instruction). Chosen over a separate `CursorProjector`
   service (Approach B) to keep **one** abstraction across sync / settings / health; chosen over a
   symlink-only subset (Approach C) because all four types are in scope.
3. **Skills/agents: native `.cursor/` symlinks, not legacy `.claude/` reliance.** Explicit, robust
   if Cursor drops legacy support, and controllable by the Cursor toggle.
4. **Commands become skills** with `disable-model-invocation: true` — matching Cursor's own
   migration direction. This is a `write` case (generate a `SKILL.md` directory).
5. **Global instruction → per-repo `AGENTS.md`**, mirrored into every linked repo (its scope is
   `personal`, and Cursor has no global instruction file). This is a `write` case (strip
   frontmatter, emit the body). A pre-existing `AGENTS.md` is backed up before overwrite.
6. **Personal skills/agents/commands reach Cursor globally** via `~/.cursor/...` — no linked repo
   required. The old "mirror personal into every repo" workaround is dropped for these types; it
   remains **only** for the global instruction.
7. **Link-a-repo notice (UX requirement).** Because Cursor has no global instruction file and
   project-scoped items need a target, the app must warn the user: without a linked repo, their
   personal skills/agents/commands still reach Cursor, but the **global instruction and any
   project-scoped customization do not**. See §7.

## 4. Mapping (final)

| Type | Scope | Cursor destination | Strategy |
|---|---|---|---|
| `skill` | personal | `~/.cursor/skills/<name>/` | symlink (directory) |
| `skill` | project | `<repo>/.cursor/skills/<name>/` | symlink (directory) |
| `agent` | personal | `~/.cursor/agents/<name>.md` | symlink |
| `agent` | project | `<repo>/.cursor/agents/<name>.md` | symlink |
| `command` | personal | `~/.cursor/skills/<name>/SKILL.md` (generated, `disable-model-invocation: true`) | write |
| `command` | project | `<repo>/.cursor/skills/<name>/SKILL.md` (generated) | write |
| `global-instruction` | personal → mirrored to each linked repo | `<repo>/AGENTS.md` | write (strip frontmatter) |

**Preserved vs lost:**

- **Skill resources are preserved.** Skills are symlinked as whole directories, so `SKILL.md`
  plus any supporting files travel with them (unlike an earlier `.mdc` translation idea).
- **Frontmatter compatibility.** Cursor ignores unknown frontmatter keys, so the app's Claude-style
  frontmatter (`type`, `scopes`, `version`, `createdAt`, `updatedAt`, `tags`) passes through the
  skill/agent symlink without breaking Cursor's `name`/`description` parsing. Low risk; validated
  during implementation. (Assumes workspace skills already store their file as `SKILL.md`, the
  Claude/Cursor-shared name.)
- **Agent profiles become Cursor subagents.** Cursor's optional `model`/`readonly`/`is_background`
  are simply absent; defaults apply.

## 5. Architecture (Approach A)

### 5.1 Port change

`AdapterDestination` gains a discriminated `strategy`:

```ts
type AdapterDestination =
  | { scope: 'personal' | 'project'; destination: string; strategy: 'symlink' }
  | { scope: 'personal' | 'project'; destination: string; strategy: 'write';
      render: (customization: Customization) => string; };
```

- `ClaudeAdapter.resolveDestinations` returns every destination with `strategy: 'symlink'`
  (mechanical change, identical behaviour).
- `CursorAdapter.resolveDestinations` returns `symlink` for skills/agents and `write` (with a
  `render` closure) for commands and the global instruction.

### 5.2 New `FileMaterializer` (infrastructure)

Mirrors `SymlinkManager`'s conflict/backup discipline for **generated** files:

1. `mkdir` the destination's parent (recursive).
2. If the destination exists and is **not** ours (absent from the manifest), back it up under
   `~/.superset-ai-app/_backups/...` (same scheme as `SymlinkManager`), then overwrite.
3. Write the rendered content, prefixed with a marker comment:
   `<!-- Managed by Superset AI — edits will be overwritten -->`.
4. Record `{ destination, contentHash, adapterId, customizationId }` in the **manifest**.

### 5.3 Manifest (source of truth for generated files)

`~/.superset-ai-app/.cursor-adapter/manifest.json` (or a generic `generated-files.json` keyed by
adapter). Because generated files are not symlinks-into-workspace, the manifest is how we know
which files we own. Nothing outside the manifest is ever deleted or overwritten without backup.

## 6. Sync / remove / health flows

- **`AdapterManager.syncDestination`** branches on `strategy`:
  - `symlink` → `SymlinkManager.create` (today's path).
  - `write` → `FileMaterializer.write({ destination, content: render(customization), adapterId })`.
- **remove / removeAll / removeAdapterSymlinks / factory-reset:** symlink destinations via
  `SymlinkManager`; `write` destinations via manifest-driven delete (only paths recorded in the
  manifest are removed).
- **Health:** a new `GeneratedFileCollector` validates each manifest entry — file exists? content
  hash matches the current render? — reporting `missing` / `drift`, analogous to the existing
  `SymlinkCollector`.
- **`countDestinations` / `planDestinations`** include `write` destinations.
- **Save-triggered re-render:** the app already calls `syncOne` on save, so editing a command or
  the global instruction re-renders and rewrites the generated file automatically. Manual edits to
  a generated file are intentionally overwritten.

## 7. Settings, UI, and the link-a-repo notice

- **Settings:** add `adapters.cursor.enabled` (mirrors `adapters.claude`).
- **UI:** a Cursor toggle in the adapters settings; the Health (Diagnóstico) screen surfaces Cursor
  entries.
- **Link-a-repo notice (required):** when the Cursor adapter is enabled, surface a notice explaining
  the per-project reality of Cursor:
  - With **no linked repo**: personal skills/agents/commands still reach Cursor (`~/.cursor/...`),
    but the **global instruction** and any **project-scoped** customization are **not** synced.
  - Recommend linking at least one repository to pick up project-scoped config and the global
    instruction. This reuses the existing `skipped: no-linked-repos` sync result and should also
    appear as a Health warning, not only a one-time banner.

## 8. Edge cases

- **No linked repos + repo-only targets** (global instruction, project-scoped items) → `SyncResult`
  `skipped: no-linked-repos` (existing pattern) + Health warning (§7).
- **Name collision `skill` × `command`** (both map to `.cursor/skills/<name>/`) → reported as a
  sync conflict; resolution is user-driven (rename). Rare, since names are user-controlled slugs.
- **Pre-existing `AGENTS.md`** in a repo → backed up before overwrite, with a warning; the user can
  switch to an `alwaysApply:true` rule later if AGENTS.md ownership is contested.
- **Command-name collision in `~/.cursor/skills/`** with an existing generated skill → backup +
  manifest update.

## 9. Testing

- **node project:**
  - `CursorAdapter.resolveDestinations` — every type × scope × N linked repos; strategy per type.
  - Renders — command → `SKILL.md` (frontmatter incl. `disable-model-invocation: true` + body);
    global instruction → AGENTS.md (frontmatter stripped, body preserved, marker present).
  - `FileMaterializer` — write, backup-on-conflict, manifest record.
  - Manifest-driven cleanup — removes only owned paths; leaves foreign files.
  - `GeneratedFileCollector` — `missing` / `drift` / ok.
- **jsdom project:** Cursor adapter toggle renders and persists; link-a-repo notice shows when
  enabled with zero linked repos.

## 10. Out of scope

- MCP → `~/.cursor/mcp.json` / `<repo>/.cursor/mcp.json` (not requested; MCP already has its own
  live-config broker for Claude).
- Cursor **User Rules** (Settings-UI-only; not writable by a file-sync app). A truly global Cursor
  instruction must be pasted into Settings → Rules by hand.
- `.cursor/rules/*.mdc` generation (skills/agents/global-instruction already have better native
  homes; rules are not needed).

## 11. Sequencing (dependency on the refactor)

The user is planning a **"canonical patterns" refactor of the ports/adapters/services layer**,
which touches the exact seam this feature extends (`Adapter` port, `AdapterManager`, and the new
`FileMaterializer`). Decision: **the refactor lands first**, and the Cursor adapter is implemented
on the refactored base. The **design** in this spec is refactor-independent (mapping and strategy
survive the reshape); only class/file names may shift. The **implementation plan** for the Cursor
adapter should be written **after** the refactor is defined and merged.

## 12. Open questions (for the plan, not blocking the design)

- Exact manifest location/shape once the refactor settles the infrastructure layout.
- Whether the link-a-repo notice is a dismissible banner, a Health-only warning, or both.
- Confirm, on a real machine, that the workspace stores skills as `<name>/SKILL.md` (Cursor's
  expected filename) so the directory symlink is picked up without renaming.
