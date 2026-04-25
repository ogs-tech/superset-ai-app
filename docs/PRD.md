---
title: "PRD — Skillforge (sde-ai-app)"
internal_name: sde-ai-app
codename: forge
public_name: Skillforge
status: Draft
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

**Validation:** the author uses the app daily for 2+ consecutive weeks without going back to the old method, within a 4-week spike.

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
- Token consumption per artifact (Claude via JSONL, Copilot via Usage API).

## 5. Out of scope

- Collaboration, multi-user, team sync.
- Tools other than Claude and Copilot.
- Token cost in dollars (raw count only).
- Git history in the UI.
- Visual polish, accessibility, i18n.
- Marketable product.

## 6. Success metrics

- ≥ 10 working days editing at least 1 artifact.
- ≥ 2 consecutive weeks without going back to the old method.
- ≥ 5 artifacts created and used in real projects.
- Zero broken sync that takes > 1 day to fix.
- Final report with transferable decisions for the next step (Specfy).

**Failure:** abandonment before 2 continuous weeks, or going back to the old method without apparent pain.

## 7. Assumptions

- Author has ≥ 4h/day available during the 4 weeks.
- File format read by Claude Code and Copilot remains stable.
- Author's local git repos are sufficient to test sync in a real project.

## 8. Product risks

| Risk | Impact | Mitigation |
|-------|---------|-----------|
| Dogfooding abandoned early | High | That's the point of the spike — discover cheaply. | 
| Scope creep | High | Must-have locked; surprises go to post-spike. |
| Little real AI use during 4 weeks | Medium | Pre-select 2–3 projects where the skills will be applied. |
| Learnings don't transfer to Specfy | Low | Document decisions even if the code is thrown away. |
