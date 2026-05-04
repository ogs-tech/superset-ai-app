---
name: code-review
targetType: skill
description: Structured self-review of your own diff before asking a human. Catches the obvious problems and makes the PR readable for the next person.
scopes:
  - personal
version: 0.1.0
---

# code-review

Run this before you request a human review. The goal is not to prove the code is perfect — it is to remove the obvious problems so the human reviewer can focus on judgment, and to make sure the next person can understand *why* in five minutes.

## Checklist

### Correctness

- Does the diff actually do what the PR description says?
- Edge cases covered: empty inputs, nulls, boundary values, concurrent calls, failure paths.
- Off-by-one, wrong-comparison, swapped-argument bugs.

### Security

- Untrusted input validated at the boundary.
- No secrets, tokens, or PII in code, logs, or error messages.
- SQL/command/path injection: parameterised, escaped, or rejected.
- Authorisation checked, not just authentication.

### Tests

- New behaviour has a test, or you have a written reason it doesn't (see `testing-standards` for when not to TDD).
- Tests would actually fail if the code were wrong (no tautological assertions).
- The test name describes the behaviour, not the implementation.

### Readability

- Names are accurate. A misleading name is worse than a generic one.
- Functions do one thing or are obviously a coordinator.
- Comments explain *why*, not *what*. Delete comments that restate the code.
- No dead code, commented-out blocks, or stray debug prints.

### PR clarity (the "5-minute test")

Read your own PR description as if you'd never seen this code.

- Is the *problem* stated, not just the change?
- Is the *why* clear — what trade-off was made, what alternative was rejected?
- Could a reviewer who is not in your head approve this in 5 minutes?

If the answer is no, **fix the description before asking for review**, not the code. Most "bad PRs" are well-written code with a useless description.

## What this skill does not do

- It does not replace the human reviewer. It removes the noise so the human can focus on the parts that need judgment.
- It does not enforce style nits a linter already catches. If your formatter and linter don't flag it, don't review for it.
