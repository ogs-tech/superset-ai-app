# CLAUDE.md — sde-ai-app

## Docs

- When editing `docs/PRD.md`, always read `docs/ARCH.md` first.
- When editing `docs/ARCH.md`, always read `docs/PRD.md` and `docs/ROADMAP.md` first.
- When editing `docs/ROADMAP.md`, always read `docs/ARCH.md` first.
- Changes that affect product behavior require synchronized updates to PRD and ARCH.
- Changes that affect execution sequence or delivery order require synchronized updates to ARCH and ROADMAP.

## Specs

Lightweight spec-driven workflow for non-trivial work. Convention over tooling — no manual index, discovery via `ls`/`grep`.

### When to create a spec

- New feature, module, or behavior change.
- Refactor crossing module boundaries.
- Ambiguous requirement that needs upfront alignment.
- Skip for: single-file bug fix, rename, copy/config tweak.

### Location and naming

- Path: `docs/specs/<id>-<slug>/`
- `<id>`: next free 3-digit number (`001`, `002`, ...). Never reused, never renamed.
- `<slug>`: kebab-case (`symlink-sync`, `claude-adapter`).
- Abandoned spec: keep the folder, set `status: dropped` in frontmatter.

### Required structure

```
docs/specs/<id>-<slug>/
├─ spec.md   # what and why
└─ tasks.md  # - [ ] checkboxes
```

### `SPEC.md` frontmatter

```yaml
---
id: "001"
title: Symlink sync
status: draft                # draft | active | review | done | dropped | superseded
priority: now                # now | next | later
created_at: YYYY-MM-DD
updated_at: YYYY-MM-DD
depends_on: []               # optional, list of spec ids (e.g. ["002", "003"])
labels: [must-have]          # optional: must-have | should-have | nice-to-have | infra | ui | core | adapter | debt
related_prd: "§4.1"          # optional, PRD section reference
related_arch: "§6.1"         # optional, ARCH section reference
branch: "001-symlink-sync"   # optional, git branch where the spec is being implemented
superseded_by: "042"         # required when status is `superseded`
---
```

### Required sections

Canonical structure for `spec.md` (omit only when truly N/A):

- **What** — one-paragraph summary of what is being built.
- **Why** — motivation, problem, link to PRD/ARCH context.
- **Non-goals** — decisions to **not** do something (different from "Out of scope", which defers to a future spec).
- **In scope** — what this spec delivers.
- **Out of scope** — explicitly deferred to a future spec id.
- **Considered alternatives** — options weighed and rejected, with reasons (Google design doc / MADR convention).
- **Acceptance criteria** — numbered, verifiable. Each item must be testable by reading code or running a command.
- **Risks & assumptions** — labeled `ASSUMPTION`, `RISCO`, or `DEBT`.
- **References** — PRD/ARCH/ROADMAP/external links.

Use `[NEEDS CLARIFICATION]` markers inline when a decision is pending; resolve all of them before transitioning `draft` → `active`.

### `tasks.md` format

Each task line follows:

```
- [ ] T<nnn> [P?] <description, file path when applicable> → AC#<n>[, AC#<n>...]
```

- **`T<nnn>`** — stable, sequential id (`T001`, `T002`, ...). Never reused, never renumbered. Cite in commits, PRs, and reviews.
- **`[P]`** — optional. Marks tasks that can run in parallel with adjacent `[P]` tasks (different files, no dependency on the immediately preceding task).
- **File path** — embed in the description when the task creates or modifies a specific file (e.g. ``T012 GREEN `src/main/ipc/dispatcher.ts` ``).
- **`→ AC#N`** — references the Acceptance criteria item satisfied by the task. Omit only for refactor/bookkeeping tasks that produce no new observable behavior.

Group tasks under `## Phase N — <name>` sections (e.g. `Setup`, `Foundational`, layer name, `Verification`, `Bookkeeping`). Phases imply ordering; `[P]` only applies *within* a phase. For TDD tasks, prefix the description with `RED`, `GREEN`, or `REFACTOR`.

### Status lifecycle

`draft` → `active` → `review` → `done` (or `dropped` / `superseded`). Update `updated_at` on each transition. When `status: superseded`, set `superseded_by` to the new spec id.

Transitions:

- `draft` → `active`: ao iniciar a Phase 1; todos os `[NEEDS CLARIFICATION]` resolvidos.
- `active` → `review`: Phase de Verification verde **e** Bookkeeping completo (ARCH/PRD sincronizados).
- `review` → `done`: aprovado no retro quinzenal (PRD §6). Antes do retro a spec fica em `review` aguardando validação de produto/arquitetura.

Dependências (`depends_on`): uma spec pode iniciar Phase 1 mesmo quando seu `depends_on` está em `review` (ainda não `done`), desde que a Verification da dependência esteja verde. O `done` formal vem só no retro quinzenal e não bloqueia trabalho downstream.

### Sync with PRD/ARCH

- Spec changes product behavior → update PRD must-have/should-have.
- Spec produces an architectural decision → add ADR in ARCH §9 and reference the spec.
- Cross-link via `related_prd` / `related_arch`.

### Roadmap

[docs/ROADMAP.md](docs/ROADMAP.md) holds the Now/Next/Later narrative and retro log. Updated **only at biweekly retros** (PRD §6). The `priority:` field in spec frontmatter is the queryable source of truth; ROADMAP is the human-readable snapshot.

### Discovery (no manual index)

- List specs: `ls docs/specs/`
- Status overview: `grep -h "^status:" docs/specs/*/spec.md`
- Now-bucket: `grep -l "^priority: now" docs/specs/*/spec.md`
- Pending tasks: `grep -rc "^- \[ \]" docs/specs/*/tasks.md`
