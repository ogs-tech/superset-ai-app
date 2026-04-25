# sde-ai-app

[![GitHub Repo](https://img.shields.io/badge/github-ogs--tech%2Fsde--ai--app-blue)](https://github.com/ogs-tech/sde-ai-app)

> **Throwaway validation spike** — local GUI to centralize AI artifacts (skills, references, agent profiles) in Markdown+YAML, versioned in manual git, synced via **symlink** to Claude Code and Copilot.
>
> **Status:** Discovery — no code yet. All documentation lives in [docs/](docs/).

## Goal

Validate in **4 weeks** (1 solo dev, macOS) whether it makes sense to centralize AI context in a local app with symlink-based sync — single source in the workspace, live copies in `~/.claude/`, `~/.copilot/`, `<repo>/.claude/` and `<repo>/.github/`.

Success = the author uses the app daily for ≥ 2 consecutive weeks without falling back to the old method (loose notes, ad-hoc folders).

## Stack

| Layer | Technology |
|---|---|
| Shell | Electron (latest LTS) |
| UI | React + TypeScript |
| Core | Go (subprocess via JSON-RPC 2.0 over stdin/stdout) |
| Secrets | Keychain via `keytar` |
| Git | Direct read of `.git/HEAD` (no libgit2) |

No backend, API, database, auth or telemetry.

## Scope

### In (must-have)
- CRUD of skills, references and agent profiles in `.md` with YAML frontmatter.
- Markdown preview alongside the editor.
- Templates by type.
- Adapters with symlinks to Claude Code and Copilot (personal and project).
- Adapter configuration + management of linked repos in Settings.

### Maybe in (should-have)
- Full schema validation.
- Text search.
- Token consumption (Claude via JSONL; Copilot via GitHub Usage API).

### Not in
- Collaboration, multiple users, automatic git write.
- Linux/Windows, i18n, accessibility, visual polish.
- Tools other than Claude and Copilot.
- Token cost in dollars.

## Documentation

- [docs/PRD.md](docs/PRD.md) — product requirements, scope and success criteria.
- [docs/ARCH.md](docs/ARCH.md) — architectural decisions, contracts between components and ADRs.

## How to run

_No code yet._ Next step of the spike: stack running (Electron + React + Go via IPC) in week 1 — see roadmap in [docs/PRD.md](docs/PRD.md).
