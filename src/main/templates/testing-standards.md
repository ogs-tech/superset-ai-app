---
name: testing-standards
targetType: reference
description: Project testing conventions — AAA, when integration beats unit, anti-patterns to avoid, and when not to do TDD.
scopes:
  - personal
version: 0.1.0
---

# testing-standards

## AAA — Arrange, Act, Assert

Every test has three sections, in order:

1. **Arrange** — set up the inputs, fixtures, and state.
2. **Act** — perform the single action under test.
3. **Assert** — check the observable outcome.

If the *Act* section has more than one call to the system under test, you probably have more than one test pretending to be one. Split.

If the *Arrange* section is longer than the rest of the test combined, the system under test is hard to set up — that's a design smell worth surfacing, not just a test problem to work around with helpers.

## When integration beats unit

Reach for an integration test when:

- The behaviour lives in *the seam between components*, not inside one. A unit test of either side will pass while the integration is broken.
- The system being tested is a coordinator (HTTP handler, message consumer, persistence layer). Mocking everything around it produces a test that confirms the mocks, not the behaviour.
- The defect class you're worried about is configuration drift, schema change, or framework upgrade — these only show up when real components are wired together.

Reach for a unit test when:

- The behaviour is a pure function or self-contained algorithm.
- The cost of the integration test setup outweighs the value of running it on every change.
- You're locking down a tricky edge case that is easier to reason about in isolation.

## Anti-patterns to avoid

- **Mock-heavy tests.** A test that mocks everything ends up asserting the mock setup. If you find yourself mocking five collaborators to test one method, the test is not the problem — the design is.
- **Tautological assertions.** `expect(result).toBe(result)`, `expect(spy).toHaveBeenCalled()` without checking *with what*, asserting on the constant you just passed in. The test passes for trivial reasons.
- **Implementation-coupled tests.** Tests that break when you rename a private method, reorder internal calls, or refactor without changing behaviour. They tax every refactor without catching real bugs.
- **Snapshot-everything.** Snapshot tests for output that changes legitimately — every snapshot diff becomes a "press y to update" reflex, and real regressions slip through.
- **Brittle selectors.** Tests that match exact whitespace, exact error messages, or DOM structure that's free to change. Test the contract, not the spelling.

## When NOT to do TDD

TDD is a tool, not a religion. Skip it (or apply it lightly) when:

- **Exploration.** You're spiking to figure out *whether* something is feasible. Tests-first requires knowing what you're building; spikes exist precisely because you don't.
- **Glue code.** Wiring two libraries together, configuration plumbing, framework adapters. The test would either be tautological or restate the framework's documentation.
- **Unstable external integrations.** Third-party APIs whose contracts change without warning, services that rate-limit your test runs, undocumented protocols you're reverse-engineering. Pin behaviour with a recorded fixture or contract test, but don't TDD against a moving target.
- **Throwaway prototypes.** Code that will be deleted within days. The test cost outlives the code it tests.

When you skip TDD, write the test *after* — same day. "I'll add tests later" without a deadline becomes "no tests". If the area genuinely cannot be tested, write down *why* in the PR description so the next person knows it wasn't an oversight.
