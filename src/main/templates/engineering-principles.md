---
name: engineering-principles
targetType: reference
description: Core engineering principles — YAGNI, KISS, DRY-with-care, action reversibility, root cause vs symptom.
scopes:
  - personal
version: 0.1.0
---

# engineering-principles

A small set of guiding principles. Each is a *bias*, not a rule. Apply with judgment.

## YAGNI — You Aren't Gonna Need It

Don't build for the requirement that *might* show up. Build for the one that exists. Speculative generality (extra parameters, hooks, abstraction layers "for the future") almost always solves the wrong problem when the future arrives.

When tempted to add an unused parameter or a configurable knob, ask: *who is asking for this, today?* If the answer is "nobody", cut it.

## KISS — Keep It Simple

Prefer the boring solution. The most legible code wins arguments. Cleverness has compounding cost: every reader pays the tax.

Three similar lines is better than a premature abstraction. Repeat yourself a little before you commit to the wrong shared shape.

## DRY — with care

DRY is about removing duplicate *knowledge*, not duplicate *characters*. Two functions that look the same but encode different rules are not duplicates — they're two things that happen to spell the same way today and will diverge tomorrow.

Wait for the third occurrence before extracting. The first time, write it. The second time, notice. The third time, refactor — and you'll know what the right shape is, because you've seen three.

## Reversibility of actions

Before doing something, ask: *if this is wrong, how hard is it to undo?*

- **Cheap to reverse** (local edits, branches, drafts): act, observe, adjust.
- **Hard to reverse** (production deploys, data migrations, force pushes, sent messages): pause, get a second pair of eyes, write down what you're doing and why.

The cost of confirming an action is small. The cost of an unwanted irreversible action is enormous.

## Root cause vs symptom

When something breaks, the visible symptom is rarely the underlying defect. Ask *"why does that happen?"* until you reach something that does not move further. That is the root cause.

Fixing the symptom (adding a try/catch around the crash, retrying the failed call, hardcoding the value that came out wrong) makes the visible problem go away while leaving the cause intact. The same bug will resurface in a different shape.

A symptomatic fix is sometimes the *right call* under pressure — but only when paired with a tracked plan to fix the root cause later (see `bug-fix`).

## How to apply

These principles compete with each other. YAGNI says don't add the abstraction; DRY says remove duplication. Reversibility says move slowly; KISS says ship the simple thing. The job is judgment — pick the principle the current situation needs, not the one you cite most often.
