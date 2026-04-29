---
title: "PRD — Skillforge (sde-ai-app)"
internal_name: sde-ai-app
codename: forge
public_name: Skillforge
status: Ready
created_at: 2026-04-19
updated_at: 2026-04-25
---

# PRD — Skillforge (sde-ai-app)

> [!NOTE]
> Stack, flows and technical decisions in [ARCH.md](./ARCH.md).

## 1. Problem

Devs who use AI (Claude Code, Copilot) accumulate skills, references and prompts scattered across notes, loose folders and ad-hoc repos. They know they exist, but can't find them when needed.

## 2. Hypothesis

Centralizing these artifacts in a local GUI, versioned in git, with symlink-based sync to the tools, is worth the effort.

**Validation:** the author uses the app daily for 2+ consecutive weeks without going back to the old method.

## 3. User

Single persona: the author themselves. Dogfooding. No external users.

## 4. Scope

### Must-have

- CRUD of skills, references and agent profiles in Markdown + YAML frontmatter.
- Templates by type (don't face a blank page).
- Markdown preview on save.
- Sync via symlink to Claude Code and Copilot, personal and project scopes.
- `copilot-instructions.md` generated from flagged references.
- Settings: enable/disable adapter, default scope, management of linked repos.

### Should-have (if there's time left)

- Full schema validation of frontmatter.
- Text search.

> Should-haves only start **after** must-haves have been in real use for ≥ 1 week. If a should-have takes > 3 days of implementation, it's cut and becomes post-spike debt.

### Nice-to-have

- Token consumption per artifact (Claude via JSONL, Copilot via Usage API). Split from should-have because the JSONL parser and the Copilot HTTP client carry significantly more risk (format breakage, plan/PAT requirements) than schema validation or text search.

## 5. Out of scope

- Collaboration, multi-user, team sync.
- Tools other than Claude and Copilot.
- Token cost in dollars (raw count only).
- Git history in the UI.
- Visual polish, accessibility, i18n.
- Marketable product.
- Personal global instruction files (`~/.claude/CLAUDE.md`, `~/.config/github-copilot/<editor>/global-copilot-instructions.md`). The app manages skills/references/agents only; personal authorial instructions stay user-edited. See ARCH ADR-32.

## 6. Success metrics

- ≥ 10 working days in which ≥ 1 synced artifact was effectively consumed by Claude Code or Copilot in a real work session (verifiable via Claude JSONL or Copilot log).
- ≥ 2 consecutive weeks without creating/editing artifacts outside the app (loose notes, ad-hoc prompts, direct edits in `~/.claude/` or `~/.copilot/`).
- ≥ 5 artifacts created and used in real projects.
- Zero occurrences of broken symlink, unresolved conflict or desynced artifact persisting > 1 working day after detection.
- Final report with transferable decisions for the next step (Specfy).

**Checkpoints:** 30min retro every **2 weeks** with 3 fixed questions:

1. Am I using it? (yes/no/partial — with evidence)
2. Is anything blocking daily use? (friction, bug, missing feature)
3. Should I cut scope, continue or stop?

Decision logged in this PRD (changelog) or a dedicated file. The 8-week soft cap below remains as the outer limit.

**Stop rule (continue / cut scope / stop):** the spike runs without a hard deadline, but ends when any signal below triggers a 30min retro:

- 8 calendar weeks without hitting validation (≥2 consecutive weeks of use + ≥5 artifacts in a real project) — soft cap.
- Validation reached → close spike, decide on hardening / move to Specfy.

**Failure:** abandonment before 2 continuous weeks, or going back to the old method without apparent pain.

## 7. Assumptions

- Author has ≥ 4h/day available throughout the spike.
- File format read by Claude Code and Copilot remains stable.
- Author's local git repos are sufficient to test sync in a real project.
