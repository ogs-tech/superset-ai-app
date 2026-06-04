# superset-ai-app

[![GitHub Repo](https://img.shields.io/badge/github-ogs--tech%2Fsuperset--ai--app-blue)](https://github.com/ogs-tech/superset-ai-app)

> **Validation spike** — local desktop app to centralize AI customizations (skills, references, agent profiles, global instructions) in Markdown + YAML and sync them to **Claude Code** and **GitHub Copilot** via symlinks.
>
> **Status:** Spike — single-developer dogfooding. See [docs/explanation/prd.md](docs/explanation/prd.md) for goals and stop rules.

## What it does

Single source of truth for AI customizations in your workspace; live copies in `~/.claude/`, `~/.copilot/`, `<repo>/.claude/`, and `<repo>/.github/`.

Customization types: `skill` · `reference` · `agent` · `global-instruction`. Scopes: `personal` · `project`.

## Stack

| Layer | Technology |
|---|---|
| Shell | Electron 41 |
| UI | React 19 + TypeScript 5.9 |
| Build | electron-vite + Vite 7 |
| Tests | Vitest + Testing Library |
| Validation | Zod 4 |

Pure TypeScript — no backend, API, database, auth, or telemetry.

## Quick start

```bash
git clone https://github.com/ogs-tech/superset-ai-app.git
cd superset-ai-app
npm install
npm run dev
```

On first launch, pick a workspace folder. Full walkthrough: [docs/tutorials/getting-started.md](docs/tutorials/getting-started.md).

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start the app in development (electron-vite). |
| `npm run build` | Production build (main + preload + renderer). |
| `npm run preview` | Preview the production build. |
| `npm test` | Run the test suite once. |
| `npm run test:watch` | Run tests in watch mode. |
| `npm run lint` | Lint with ESLint. |
| `npm run typecheck` | Typecheck Node and web TS configs. |
| `npm run format` | Format with Prettier. |

## Documentation

Documentation follows the [Diátaxis](https://diataxis.fr/) framework. Start at the hub:

**→ [docs/index.md](docs/index.md)**

Direct links:

- **Tutorials** — [Getting started](docs/tutorials/getting-started.md)
- **Reference** — [Architecture](docs/reference/architecture.md) · [Customization schema](docs/reference/customization-schema.md) · [IPC contract](docs/reference/ipc-contract.md)
- **Explanation** — [PRD](docs/explanation/prd.md)

## Scope (4-week spike)

- **In:** CRUD of customizations, templates, symlink sync to Claude/Copilot (personal + project), settings UI.
- **Maybe in:** Schema validation, text search, token usage stats.
- **Out:** Multi-user, auto-commit, Linux/Windows, i18n, accessibility, tools other than Claude/Copilot.

Success = author uses the app daily for ≥ 2 consecutive weeks without falling back to loose notes.

## Repository

Source: [github.com/ogs-tech/superset-ai-app](https://github.com/ogs-tech/superset-ai-app).
