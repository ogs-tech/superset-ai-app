# CLAUDE.md — sde-ai-app

## Docs

- When editing `docs/PRD.md`, always read `docs/ARCH.md` first.
- When editing `docs/ARCH.md`, always read `docs/PRD.md` first.
- Changes that affect product behavior require synchronized updates to PRD and ARCH.

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

### `spec.md` frontmatter (minimum)

```yaml
---
id: 001
title: Symlink sync
status: draft        # draft | active | done | dropped
created_at: YYYY-MM-DD
updated_at: YYYY-MM-DD
related_prd: "§4.1"  # optional, PRD section reference
related_arch: "§6.1" # optional, ARCH section reference
---
```

### Status lifecycle

`draft` → `active` → `done` (or `dropped`). Update `updated_at` on each transition.

### Sync with PRD/ARCH

- Spec changes product behavior → update PRD must-have/should-have.
- Spec produces an architectural decision → add ADR in ARCH §9 and reference the spec.
- Cross-link via `related_prd` / `related_arch`.

### Discovery (no manual index)

- List specs: `ls docs/specs/`
- Status overview: `grep -h "^status:" docs/specs/*/spec.md`
- Pending tasks: `grep -rc "^- \[ \]" docs/specs/*/tasks.md`
