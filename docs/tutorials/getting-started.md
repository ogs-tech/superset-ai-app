---
title: Getting started
description: Run superset-ai-app locally from a fresh clone in under 5 minutes.
---

# Getting started

> **Audience:** first-time user with Node.js and Git installed.
> **Outcome:** the app is running on your machine and pointing to a workspace folder.

## Prerequisites

- macOS (the spike is macOS-only).
- Node.js 22+ and npm.
- Git.

## 1. Clone and install

```bash
git clone https://github.com/ogs-tech/superset-ai-app.git
cd superset-ai-app
npm install
```

## 2. Run in development

```bash
npm run dev
```

`electron-vite` boots the main and preload bundles, starts Vite for the renderer, and opens an Electron window.

## 3. First-launch onboarding

On first launch the app has no workspace yet, so the **Onboarding** screen asks you to pick one. The workspace is just a folder on disk where your customizations live as `.md` files with YAML frontmatter.

Pick (or create) any folder you control — for example `~/ai-workspace`. The app then:

1. Persists your choice via `workspace.setActive`.
2. Bootstraps the folder layout via `workspace.bootstrap`.
3. Merges default settings (adapters, linked repos, UI).

After this, the **Main** screen opens with an empty customization list.

## 4. Verify

You're ready when:

- The main window shows the customization list (empty on first run).
- `Settings` shows your workspace path and the configured adapter targets (`~/.claude/`, `~/.copilot/`).
- The workspace folder on disk exists and is writable.

## What's next

- Create your first customization _(how-to TBD)_.
- Read the [architecture reference](../reference/architecture.md) to understand the layers underneath.

## Troubleshooting

- **Window doesn't open** — check that no other process is holding port 5173 (Vite default) and rerun `npm run dev`.
- **I/O error screen** — the bootstrap step failed (workspace not writable, missing parent, etc.). Pick a different folder; the same retry button reruns the failed step.
- **Stale build artifacts** — delete `out/` and rerun.
