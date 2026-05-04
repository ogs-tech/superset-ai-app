---
name: git-workflow
targetType: reference
description: Conventions for commits and pull requests — scope, granularity, when to split, when to bundle.
scopes:
  - personal
version: 0.1.0
---

# git-workflow

## Commits

A good commit is the smallest change that compiles, passes tests, and means something on its own.

- **Subject line**: imperative mood, under ~72 chars. *"Add retry to upload"*, not *"Added a retry"* or *"upload changes"*.
- **Body**: explain *why*, not *what*. The diff already shows what.
- **One concern per commit.** A commit that mixes a refactor and a bug fix forces every future reader (and `git bisect`) to untangle them.
- **Don't commit broken intermediate states.** Each commit should leave the tree green. If you can't, squash before review.

## Pull request scope

A PR is a unit of *review*, not a unit of work. Size it for the reviewer's attention, not yours.

- **One reviewable idea per PR.** Mixed PRs ("I refactored X and added Y") get worse reviews because each reviewer focuses on the half they care about and skims the rest.
- **Aim for under ~400 lines of diff** where possible (excluding generated files, lockfiles, snapshot updates). Larger PRs get rubber-stamped or stalled.
- **Description carries the why.** The PR is the durable record — six months from now, the diff is in `git log`, but the *reason* lives in the PR description.

## When to split a PR

Split when:

- The PR contains a refactor *and* a behaviour change. Land the refactor first (no behaviour change → easy review), then the behaviour change on top (small diff → real review).
- Reviewers are asking different questions about different parts. That's a signal the parts have different audiences.
- The PR is so large that nobody is reviewing it carefully. A stalled PR is worse than two merged ones.

## When to bundle (don't split)

Don't split when:

- The pieces only make sense together. Splitting *just to be smaller* produces PRs that can't be evaluated independently — the reviewer has to load both anyway.
- The split would create a temporarily-broken main branch (e.g. callsite migration in one PR, signature change in another). Bundle, or use a feature flag.
- The total diff is small enough that splitting is more ceremony than signal.

The rule: split when it makes the **reviewer's** job easier, not when it makes the **author's** mental model neater.

## Force pushes and rewrites

- **Local branch, before review:** rewrite freely.
- **Branch under review, with collaborators:** ask before force-pushing — you may overwrite a teammate's pending changes.
- **Shared branches (main, release):** never force push. The cost of a bad force push to a shared branch is hours of reconstruction.
