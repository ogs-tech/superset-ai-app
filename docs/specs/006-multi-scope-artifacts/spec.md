---
id: "006"
title: Multi-scope artifacts
status: review
priority: now
created_at: 2026-04-27
updated_at: 2026-04-27
depends_on: ["005"]
labels: [must-have, core, ui]
related_prd: "§4"
related_arch: "§5.3, §7.4"
---

# 006 — Multi-scope artifacts

## What

Replace the single-valued `scope: ArtifactScope` field on `ArtifactFrontmatter` with a multi-valued `scopes: ArtifactScope[]`. An artifact can target `personal`, `project`, or both at the same time without duplication. Existing artifacts on disk (legacy `scope: <string>`) are auto-migrated on read.

## Why

Today users cannot mark an artifact as both personal and project — they have to duplicate the artifact, which creates two coupled files that drift over time. Adapter resolution already handles a list of destinations internally; the limitation is purely at the frontmatter contract. Allowing `scopes: ['personal','project']` removes the duplication and matches how users naturally think about reuse.

## Non-goals

- New scope values beyond `personal | project`.
- Per-adapter scope overrides (e.g. "personal in Claude, project in Copilot").
- Bulk migration UI/wizard — auto-migration on read is sufficient.

## In scope

- Frontmatter contract change in `src/shared/artifact.ts`.
- Auto-migration of legacy `scope: <string>` → `scopes: [<string>]` at parse time.
- Validation: `scopes.length >= 1` (rejected with `details.invalid: ['scopes']`).
- Adapter `resolveDestinations` iterates over `scopes`.
- `AdapterManager` skip rule for `'project'` when `linkedRepos` is empty must trigger when `scopes.includes('project')`.
- UI: replace `<select>` with two checkboxes in `ArtifactEditor`.
- Templates default `scopes: [personal]`.
- Test sweep across all fixtures and assertions.
- Remover `AdapterSettings.defaultScope` (campo morto após scopes multi-valor): tipo, defaults, UI de Settings, bootstrap; strip silencioso ao carregar settings legados.

## Out of scope

- Migrating the value beyond shape (e.g. inferring intent from project layout) — deferred.
- Removing the legacy reader path — deferred until enough time has passed that no legacy artifacts remain in the wild.

## Considered alternatives

- **Add `'both'` to the `ArtifactScope` enum.** Smaller change, but it conflates "set membership" with "single tag" and does not extend cleanly. Rejected in favor of the array form, which is more idiomatic and future-proof.
- **Keep single scope, generate a paired artifact in the UI when user marks both.** Creates two files that must stay in sync; pushes complexity onto the disk layout. Rejected.
- **Migration via one-shot script (`pnpm migrate:scopes`) instead of on-read.** Cleaner production code (only one shape to read) but requires user action and breaks existing repositories until the script runs. Rejected for UX reasons; accept the small dual-read cost.

## Acceptance criteria

1. `ArtifactFrontmatter.scopes` is `ArtifactScope[]`; the legacy `scope` field is no longer in the type.
2. Reading a markdown file with `scope: personal` (legacy) yields an `Artifact` with `scopes: ['personal']` in memory; saving the same artifact persists `scopes: [personal]` in YAML.
3. `ArtifactService.save` rejects `scopes: []` with `kind: 'validation'` and `details.invalid: ['scopes']`.
4. `ClaudeAdapter.resolveDestinations` returns the union of personal-destination and per-linked-repo destinations when `scopes` includes both values.
5. `AdapterManager.syncOne` and `syncAll` emit `details.skipped: 'no-linked-repos'` when `scopes.includes('project')` and `linkedRepos` is empty (regardless of whether `'personal'` is also present, the `'personal'` destinations still sync).
6. Templates `skill.md`, `agent.md`, `reference.md` ship with `scopes: [personal]`.
7. `ArtifactEditor` renders two checkboxes (`personal`, `project`); marking/unmarking updates `frontmatter.scopes` accordingly.
8. `pnpm test`, `pnpm typecheck`, and `pnpm lint` all pass with no regressions.
9. `AdapterSettings` não expõe `defaultScope`; `getDefaults()` retorna apenas `{ enabled }` para `claude`/`copilot`. `SettingsService.load()` descarta a chave legada `defaultScope` se presente em settings persistidos. A tela de Settings não renderiza `<select>` de escopo por adapter.

## Risks & assumptions

- `ASSUMPTION`: every artifact already on disk uses `scope: 'personal'` or `scope: 'project'` (string). No mixed/array values exist yet.
- `ASSUMPTION`: `AdapterDestination.scope` (singular, in `ports/adapter.ts`) is the *resolved* destination's scope tag and stays singular — the multi-valued field lives only in the artifact's frontmatter.
- `RISCO`: a legacy artifact saved by an older version of the app while a newer version reads it — the migration path covers reads but a downgrade scenario is not addressed; out of scope.
- `DEBT`: the legacy reader path (accepting `scope: <string>`) lingers until removed in a follow-up spec.

## References

- PRD §4 (artifact model)
- ARCH §5.3 (adapter resolution), §7.4 (frontmatter contract)
- Spec 005 (Claude adapter — depends on this resolution behavior)
