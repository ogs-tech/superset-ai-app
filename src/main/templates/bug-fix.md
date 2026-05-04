---
name: bug-fix
targetType: skill
description: Fix a bug — reproduce, isolate the root cause, write a failing test, fix, confirm. Band-aids are allowed under pressure if they are tracked.
scopes:
  - personal
version: 0.1.0
---

# bug-fix

## Steps

1. **Reproduce.** Pin down the exact input, environment, and sequence that triggers the bug. If you cannot reproduce, you cannot verify a fix — say so and stop.
2. **Isolate the root cause.** Trace from the symptom to the underlying defect. Resist stopping at the first plausible-looking change. Ask *"why does that happen?"* until you reach something that cannot move further.
3. **Write a failing test** that captures the bug. The test should fail before the fix and pass after. If the area genuinely cannot be tested (UI affordance, external integration), state that explicitly and describe the manual repro instead.
4. **Fix at the root cause**, not the symptom.
5. **Confirm.** Re-run the failing test. Run the surrounding tests. Manually verify if the area touches UI or external systems.

## Band-aids

A band-aid (symptomatic fix that does not address the root cause) is **allowed** under pressure: an outage, a release going out in an hour, a customer waiting.

The rule is not *"never band-aid"* — it is *"never an untracked band-aid"*. Every band-aid must produce one of:

- A linked issue/ticket describing the real fix needed.
- A `TODO` in the code with a link to that ticket.
- An explicit debt entry in the project's tracking system.

A band-aid without a tracked follow-up is what's prohibited. The band-aid itself is just engineering under constraint.

## What this skill does not do

- It does not force every fix to be a "proper" root-cause fix when the cost-benefit doesn't work.
- It does not skip the test step just because the fix is small. The test is what stops the bug from coming back.
