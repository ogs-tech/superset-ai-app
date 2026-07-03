---
title: Entity schema
description: Field contract for the canonical Entity model (skill, agent, instruction) — flat TS shape, on-disk frontmatter rules, per-kind constraints and validation error shape.
---

# Entity schema

An **entity** is the canonical, tool-agnostic unit synced to Claude Code — the `Entity` interface in [`src/shared/entity.ts`](../../src/shared/entity.ts). It replaced the old polymorphic `Customization`/`CustomizationFrontmatter` model: fields are **flat** on the object (`entity.name`, `entity.description`, `entity.content`) rather than nested under `frontmatter`/`body`, and every entity carries a `urn` (`urn:{kind}:{name}`).

Three kinds are implemented today — `skill`, `agent`, `instruction`. (`EntityKind` also lists `'mcp'` and `'hook'` for a future unification; those two are **not yet** canonical entities — `hook-service`/`mcp-service` have their own separate schemas and storage, see [Architecture](architecture.md).) The former `command` kind has been **removed**: a slash-command is now a `skill` with `explicitOnly: true` (↔ frontmatter `disable-model-invocation: true`). Existing `commands/*.md` files under the workspace are orphaned — there is no migration.

```ts
interface Entity {
  urn: string;              // `urn:{kind}:{name}`
  kind: EntityKind;
  name: string;
  description: string;
  scopes: Scope[];
  metadata: EntityMetadata; // version, tags?, createdAt, updatedAt
  source: EntitySource;     // { kind: 'workspace' } | { kind: 'plugin'; pluginId; provenance }
  ext?: Record<string, unknown>;
}

interface Skill extends Entity { kind: 'skill'; content: string; explicitOnly?: boolean; }
interface Agent extends Entity { kind: 'agent'; systemPrompt: string; model?: string; tools?: string[]; deniedTools?: string[]; }
interface Instruction extends Entity { kind: 'instruction'; content: string; activation: InstructionActivation; globs?: string[]; }
```

`skill` and `agent` are still stored as a Markdown file with a YAML frontmatter block followed by a body — `EntitySerializer` (`src/main/application/entity/entity-serializer.ts`) maps the flat fields to/from frontmatter:

```markdown
---
name: my-skill
type: skill
description: Short, one-line summary of what this entity does.
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

Free Markdown — this becomes `content` (skill) or `systemPrompt` (agent).
```

`instruction` is stored **frontmatter-free**: the entire file is the body (`content`), written/read verbatim by `renderEntityFile`/`parseEntityFile`. There is no on-disk representation for `description`, `scopes`, `metadata`, or `activation`/`globs` today — a freshly-read instruction always gets `description: ''`, `scopes: ['personal']`, `metadata: { version: '0.0.0', createdAt: '', updatedAt: '' }`, and `activation: 'always'` regardless of what was set in memory before the last save. Any legacy frontmatter present in `global-instructions/<name>.md` (the read-only fallback path) is stripped, not parsed.

Entities are validated by `EntityValidator` (`src/main/application/services/entity-validator.ts`) against the Zod schemas in [`src/main/application/schemas/entity-schema.ts`](../../src/main/application/schemas/entity-schema.ts) — one schema per kind (`skillEntitySchema`, `agentEntitySchema`, `instructionEntitySchema`). This replaced the old, since-removed `schema-validator.ts`/`SchemaValidator`.

## Common fields

All three kinds share these fields (defined once in `entity-schema.ts`'s `entityBase`, extended per kind). The on-disk frontmatter keys for `skill`/`agent` are unchanged from before the refactor; `metadata.*` maps to top-level frontmatter keys (`version`, `tags`, `createdAt`, `updatedAt`), and `kind` maps to frontmatter `type`.

| Field | Type | Required | Rule |
|---|---|---|---|
| `name` | string | yes | Slug — must match `^[a-z0-9][a-z0-9-]*$` (lowercase, digits, hyphens; no leading hyphen). |
| `kind` (frontmatter `type`) | enum | yes | One of `skill` · `agent` · `instruction`. |
| `description` | string | yes for skill/agent | 1–1024 characters for `skill`/`agent` (empty string rejected); always `''` for `instruction` (frontmatter-free, see above). |
| `scopes` | array | yes | At least 1 entry, no duplicates, each `personal` or `project` — except `instruction`, pinned to exactly `['personal']`. |
| `metadata.version` | string | yes | Semver `^\d+\.\d+\.\d+(-[\w.-]+)?$` (e.g. `1.2.3`, `1.2.3-rc.1`). |
| `metadata.createdAt` | string | yes | ISO 8601 datetime (e.g. `2026-05-04T12:00:00.000Z`). |
| `metadata.updatedAt` | string | yes | ISO 8601 datetime. |
| `metadata.tags` | array | no | Optional. Each tag must match `^[a-z0-9-]+$`. |
| `source` | object | yes | `{ kind: 'workspace' }` or `{ kind: 'plugin'; pluginId; provenance }`. Plugin-sourced entities reject `save`/`delete` (`OperationNotAllowedForOriginError`). |

> Every kind's Zod schema uses `.passthrough()`, so unknown frontmatter keys are kept on `entity.ext` rather than rejected. Adapters and renderer code, however, only read the fields above.

## Per-kind rules

Each kind's schema extends the common base. Only the differences are listed.

### `skill`

- `content: string` (the Markdown body).
- `explicitOnly?: boolean` — maps to frontmatter `disable-model-invocation: true` when set. A skill with `explicitOnly: true` is not offered for implicit model invocation — this is exactly what the removed `command` kind used to mean; commands are now expressed this way.
- No additional constraints beyond the common fields. `kind` (frontmatter `type`) must be the literal `skill`.

### `agent`

- `systemPrompt: string` (the Markdown body — the old `body` field, renamed).
- `model?: string`, `tools?: string[]`, `deniedTools?: string[]` — optional frontmatter fields, passed through verbatim.
- No additional constraints beyond the common fields. `kind` (frontmatter `type`) must be the literal `agent`.

### `instruction`

Renamed from `global-instruction`; stricter than the other kinds — there is exactly **one** instruction per machine, and it is the only kind stored frontmatter-free.

| Field | Constraint |
|---|---|
| `kind` (frontmatter `type`, when present) | must be the literal `instruction`. |
| `name` | must be the literal string `default`. Any other value is rejected (enforced by both `instructionEntitySchema` and the `globalInstructionId()` domain guard). |
| `scopes` | must be exactly `["personal"]` (tuple of length 1). `project` is not allowed. |
| `activation` | one of `always` \| `glob` \| `agent-requested` \| `manual`. **Not persisted** — see below. |
| `globs` | optional `string[]`, used with `activation: 'glob'`. **Not persisted** — see below. |

## Body

The Markdown body is unconstrained at the schema layer — `content: string` (skill/instruction) or `systemPrompt: string` (agent). Validation only covers the structured fields (frontmatter for skill/agent; the flat `Entity` fields in memory for instruction, since instruction has no on-disk frontmatter to validate).

## Scope semantics

| Scope | Meaning | Adapter target (typical) |
|---|---|---|
| `personal` | Applies machine-wide for the author. | `~/.claude/` (instruction: **both** `~/.claude/CLAUDE.md` and `~/AGENTS.md`) |
| `project` | Applies to repos linked in Settings. | `<repo>/.claude/` |

A skill or agent can declare both scopes; the adapter publishes it to each enabled target. `instruction` is pinned to `personal` only.

## Validation result

`EntityValidator.validate(entity)` (`src/main/application/services/entity-validator.ts`) does not return a result object — it **throws** on failure:

```ts
class EntityValidator {
  validate(entity: Entity): void; // throws DomainError on failure
}
```

On success it returns `void`. On failure it throws:

```ts
new DomainError('validation', 'Entity failed validation', {
  errors: Array<{ path: string; message: string }>,
});
```

`path` is the dotted Zod issue path rooted at the **entity field**, not `frontmatter` (e.g. `name`, `metadata.version`, `scopes[0]`) — there is no `frontmatter.` prefix, since the in-memory model is flat. `message` is Zod's own issue message (or the custom message supplied in `entity-schema.ts`, e.g. `'instruction name must be "default"'`). The dispatcher maps this straight to `IpcError { kind: 'validation', message: 'Entity failed validation', details: { errors } }` — see [IPC contract](ipc-contract.md#dispatch-and-error-mapping). This replaced the old `SchemaValidator.validate()` → `ValidationResult` API and its curated error-`kind` taxonomy (`required`, `format`, `min-length`, …), which no longer exists; there is no per-issue `kind` field today, only `path` + `message`.

## See also

- [Architecture overview](architecture.md) — where the validator sits in the layers.
- [IPC contract](ipc-contract.md) — `skill.*` / `agent.*` / `instruction.*` methods that carry these entities over IPC.
- [PRD — schema validation as should-have](../explanation/prd.md#4-scope) — why the schema is currently lenient (`passthrough`) and what it would tighten if promoted from should-have.
