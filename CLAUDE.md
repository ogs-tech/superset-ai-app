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

### `spec.md` frontmatter

Schema: [docs/specs/.spec-schema.json](docs/specs/.spec-schema.json). Add `# yaml-language-server: $schema=../.spec-schema.json` at the top of `spec.md` for inline VS Code validation.

```yaml
---
id: "001"
title: Symlink sync
status: draft                # draft | active | done | dropped
priority: now                # now | next | later
created_at: YYYY-MM-DD
updated_at: YYYY-MM-DD
depends_on: []               # optional, list of spec ids (e.g. ["002", "003"])
labels: [must-have]          # optional: must-have | should-have | nice-to-have | infra | ui | core | adapter | debt
related_prd: "§4.1"          # optional, PRD section reference
related_arch: "§6.1"         # optional, ARCH section reference
---
```

### Status lifecycle

`draft` → `active` → `done` (or `dropped`). Update `updated_at` on each transition.

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
