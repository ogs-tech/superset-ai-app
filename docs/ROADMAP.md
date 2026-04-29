---
title: 'ROADMAP — Skillforge (sde-ai-app)'
internal_name: sde-ai-app
codename: forge
public_name: Skillforge
status: Draft
created_at: 2026-04-25
updated_at: 2026-04-26
---

# ROADMAP — Skillforge

> Execution sequence for the spike. Now/Next/Later updated **only at biweekly retros** (PRD §6).

## Now

| Spec                   | Description                                                                                                                                                             | Status   |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `001-walking-skeleton` | Scaffold Electron + React + TypeScript + Main services + `contextBridge` IPC round-trip. Lays the structural foundation for all subsequent specs (ARCH §3.1, §5, §8.1). | `review` |

## Next

| Spec                      | Description                                                                           | Status                  |
| ------------------------- | ------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------- | --- | ---------------------------------------------------------- | -------- |
| `002-onboarding-settings` | first-use flow: pick workspace, write `settings.json`,                                | `004-symlink-sync-core` | `SymlinkManager` + `AdapterManager`. Save flow + conflict handling (ARCH §6.1, §6.2). | —   | link repos. `SettingsService` + `RepoService` (ARCH §6.6). | `review` |
| `003-artifact-crud`       | `ArtifactService` + `TemplateService` + UI listing/edit. No sync yet (ARCH §5.3).     | `review`                |
| `004-symlink-sync-core`   | `SymlinkManager` + `AdapterManager`. Save flow + conflict handling (ARCH §6.1, §6.2). | `review`                |

## Later

### Must-have remaining (PRD §4)

| Spec                                               | Description                                                    | Status |
| -------------------------------------------------- | -------------------------------------------------------------- | ------ |
| `005-claude-adapter` e `006-multi-scope-artifacts` | `ClaudeAdapter` (ARCH §5.3). Depends on 004.                   | —      |
| `006-copilot-adapter`                              | `CopilotAdapter` (ARCH §5.3). Depends on 004.                  | —      |
| `007-copilot-instructions-gen`                     | aggregation + `chmod 444` (ARCH §6.4). Depends on 006.         | —      |
| `008-disable-adapter-flow`                         | toggle off + symlink cleanup (ARCH §6.3). Depends on 005, 006. | —      |

### Should-have (PRD §4 — only after must-have validated ≥1 week in real use)

| Spec                   | Description                                                 | Status |
| ---------------------- | ----------------------------------------------------------- | ------ |
| `009-schema-validator` | frontmatter validation against per-type schema (ARCH §5.3). | —      |
| `010-search-service`   | in-memory text search (ARCH §5.3).                          | —      |

### Nice-to-have (PRD §4)

| Spec                       | Description                                                         | Status |
| -------------------------- | ------------------------------------------------------------------- | ------ |
| `011-claude-token-parser`  | JSONL aggregation (ARCH §5.3, §6.5). Format-breakage risk accepted. | —      |
| `012-copilot-usage-client` | GitHub Usage API + PAT via Keychain (ARCH §5.3, §8.3).              | —      |

## Retro log
