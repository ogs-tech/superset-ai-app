---
type: global-instruction
name: copilot
description: Personal global instructions for VS Code Copilot (~/.copilot/instructions/).
scopes:
  - personal
version: 0.1.0
---

# GitHub Copilot — global instructions

Personal coding conventions VS Code Copilot should follow across every workspace.

## Style

- Prefer named functions over anonymous lambdas in module scope.
- Keep comments minimal — explain WHY when the code can't.

## Workflow

- Suggest tests alongside new logic.
- Don't introduce new dependencies without flagging the choice.
