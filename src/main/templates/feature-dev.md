---
name: feature-dev
targetType: skill
description: Implement a feature. Pick a mode (fast-path, spike, or full-RPI) based on objective criteria — don't default to ceremony.
scopes:
  - personal
version: 0.1.0
---

# feature-dev

The default mode is **fast-path**. Research → Plan → Implement is the *exception*, justified by the criteria below — not the routine. Most feature work is medium-sized and does not need it.

Process must pay its own cost or it gets cut. Every artifact you produce should answer: who reads this, and when?

## How to choose mode

Go to **full-RPI** if **two or more** of these are true:

1. The change touches more than ~3 relevant files (excluding tests and generated code).
2. It modifies a public contract (API, schema, cross-module interface).
3. It is hard to reverse (data migration, production change, coordinated deploy).
4. The team has no shared context on this area.
5. Your gut estimate is greater than half a day.

Otherwise **fast-path**.

If the uncertainty is *"is this even feasible?"*, do a **spike** first with an explicit time-box (e.g. 2h, 1 day). Spike code does not become production code by default — throw it away or rewrite cleanly.

## Mode: fast-path (default)

1. Read the surrounding code enough to not break neighbours.
2. Make the change. Write tests if the area has them.
3. Run lint, typecheck, tests.
4. Done.

No bookkeeping. No plan document. The diff and the commit message are the record.

## Mode: spike

1. State the question you're answering and the time-box up front. Examples: *"Can we stream this through the existing pipeline in under 200ms? — 2h."*
2. Write the smallest thing that answers it. Cut corners deliberately.
3. When the time-box ends, stop. Write down the answer (in the PR description, an issue, or a chat message — somewhere a human will read it).
4. Discard or rewrite the spike code. Do not slide it into production.

## Mode: full-RPI

### Research

- Map the relevant code: entry points, key types, neighbours that will need to move.
- Find precedents: has this pattern been solved here before?
- List constraints: invariants, performance, security, compatibility.
- Use the `researcher` agent for breadth when the area is unfamiliar.

### Plan

- Propose an ordered list of steps. Name the files that will change.
- Call out trade-offs and the alternative you rejected.
- Use the `planner` agent if you want a structured pass.
- Get a second opinion via the `reviewer` agent — give it the *problem and constraints*, **not** your plan. Independence is the value.

### Implement

- Follow the plan. If reality forces a divergence, update the plan, don't paper over it.
- Apply TDD where it fits (see `testing-standards`). Skip TDD where it doesn't (exploration, glue code, unstable external integrations).
- Commit in small, reviewable slices.

### Bookkeeping (full-RPI only)

Each artifact must declare *who reads it* and *when*. If you can't answer, don't write it.

- **Decision log** → reread during onboarding and when someone asks *"why did we do X?"* six months later. Format: decision, alternatives considered, why this one. If you're not writing it in that shape, don't write it.
- **State / progress** → reread at the next work session or at handoff. If the feature finishes in one session, skip it.

If a category of bookkeeping has gone unread for three months, cut it from the next package revision.

## What this skill does not do

- It does not force RPI on small changes.
- It does not produce documents nobody will read.
- It does not treat TDD, DRY, or "best practices" as dogma — apply with judgment, not as a rule.
