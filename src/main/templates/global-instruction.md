---
name: default
targetType: global-instruction
description: Personal global instructions distributed to every enabled assistant.
scopes:
  - personal
version: 0.1.0
---

# Global instructions

Personal preferences and conventions that apply across every workspace and every enabled assistant (Claude Code, Copilot, ...).

## Tone and process

- Reply concisely; lead with the answer and skip preambles.
- Ask one question at a time when blocked; don't stack assumptions.

## Engineering defaults

- Follow TDD when implementing features or bug fixes.
- Run lint and typecheck before declaring a task done.
- Suggest tests alongside new logic.
- Don't introduce new dependencies without flagging the choice.
