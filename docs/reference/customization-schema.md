---
title: Customization schema
description: YAML frontmatter contract for customizations and templates, with field rules, per-type constraints and validation error shape.
---

# Customization schema

A **customization** is a Markdown file with a YAML frontmatter block followed by a Markdown body:

```markdown
---
name: my-skill
type: skill
description: Short, one-line summary of what this customization does.
scopes:
  - personal
  - project
version: 1.0.0
createdAt: 2026-05-04T12:00:00.000Z
updatedAt: 2026-05-04T12:00:00.000Z
tags:
  - example
---

# Body

Free Markdown.
```

Schemas are defined with Zod under [`src/main/application/schemas/`](../../src/main/application/schemas/) and dispatched by `SchemaValidator` in [`src/main/application/services/schema-validator.ts`](../../src/main/application/services/schema-validator.ts).

## Common frontmatter

All four customization types share these fields. Defined in `schemas/common.ts`.

| Field | Type | Required | Rule |
|---|---|---|---|
| `name` | string | yes | Slug — must match `^[a-z0-9][a-z0-9-]*$` (lowercase, digits, hyphens; no leading hyphen). |
| `type` | enum | yes | One of `skill` · `reference` · `agent` · `global-instruction`. |
| `description` | string | yes | 1–1024 characters. Empty string is rejected. |
| `scopes` | array | yes | At least 1 entry, no duplicates. Each entry is `personal` or `project`. |
| `version` | string | yes | Semver `^\d+\.\d+\.\d+(-[\w.-]+)?$` (e.g. `1.2.3`, `1.2.3-rc.1`). |
| `createdAt` | string | yes | ISO 8601 datetime (e.g. `2026-05-04T12:00:00.000Z`). |
| `updatedAt` | string | yes | ISO 8601 datetime. |
| `tags` | array | no | Optional. Each tag must match `^[a-z0-9-]+$`. |

> Frontmatter uses Zod `.passthrough()`, so unknown fields are kept rather than rejected. Adapters and renderer code, however, only read the fields above.

## Per-type rules

Each type extends the common schema. Only the differences are listed.

### `skill`

No additional fields or constraints. `type` must be the literal `skill`.

### `reference`

No additional fields or constraints. `type` must be the literal `reference`.

### `agent`

No additional fields or constraints. `type` must be the literal `agent`.

### `global-instruction`

Stricter than the others — there is exactly **one** global-instruction per machine.

| Field | Constraint |
|---|---|
| `type` | must be the literal `global-instruction`. |
| `name` | must be the literal string `default`. Any other value is rejected. |
| `scopes` | must be exactly `["personal"]` (tuple of length 1). `project` is not allowed. |

## Body

The Markdown body is unconstrained at the schema layer (just `body: string` in `Customization`). Validation only covers the frontmatter.

## Scope semantics

| Scope | Meaning | Adapter target (typical) |
|---|---|---|
| `personal` | Applies machine-wide for the author. | `~/.claude/`, `~/.copilot/` |
| `project` | Applies to repos linked in Settings. | `<repo>/.claude/`, `<repo>/.github/` |

A customization can declare both scopes; the adapter publishes it to each enabled target.

## Templates

Templates live alongside customizations and seed new files. Schema in `schemas/template.ts`.

Differences vs. customization frontmatter:

| Field | Note |
|---|---|
| `targetType` (instead of `type`) | One of `skill` · `reference` · `agent` · `global-instruction`. Indicates which customization type the template produces. |
| `name` | Slug rule — **no** `default` constraint, even for `global-instruction` templates. |
| `scopes` | Same rule as customizations (≥ 1, no duplicates) — **no** `["personal"]` constraint. |

All other fields (`description`, `version`, `createdAt`, `updatedAt`, `tags`) follow the common rules.

## Validation result

`SchemaValidator.validate()` returns:

```ts
type ValidationResult =
  | { ok: true }
  | { ok: false; errors: ValidationError[] };

interface ValidationError {
  path: string;   // e.g. "frontmatter.scopes[0]"
  kind: string;   // see table below
  message: string;
}
```

### Error kinds

Mapped from Zod issues by `schema-validator.ts`:

| `kind` | When |
|---|---|
| `required` | A required field is missing. |
| `format` | Value has the wrong type or fails a regex (slug, semver, datetime). |
| `min-length` | String is shorter than the minimum (e.g. empty `description`). |
| `max-length` | String exceeds the maximum (e.g. `description` > 1024 chars). |
| `min-items` | Array has fewer entries than required (e.g. empty `scopes`). |
| `max-items` | Array has more entries than allowed. |
| `enum` | Value is not in the allowed set (e.g. unknown `type`). |
| `exact` | Tuple length / literal mismatch (e.g. `global-instruction` `scopes` not exactly `["personal"]`). |
| `unique` | Array contains duplicates (e.g. `["personal", "personal"]`). |

Path is always rooted at `frontmatter`, with dotted field names and `[i]` for array indices.

## See also

- [Architecture overview](architecture.md) — where the validator sits in the layers.
- [PRD — schema validation as should-have](../explanation/prd.md#4-scope) — why the schema is currently lenient (`passthrough`) and what it would tighten if promoted from should-have.
