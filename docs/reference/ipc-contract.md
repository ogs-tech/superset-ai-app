---
title: IPC contract
description: Methods exposed by the preload bridge from the renderer to the main process — naming, params, results and error shape.
---

# IPC contract

A single Electron IPC channel routes every renderer ↔ main call. The renderer sends a `{ method, params }` envelope; the main process dispatches by method name and replies with a typed `IpcResult`.

## Wire shape

```ts
const IPC_CHANNEL = 'ipc:call';

interface Envelope { method: string; params: unknown; }

type IpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: IpcError };

interface IpcError {
  kind: IpcErrorKind;
  message: string;
  details?: Record<string, unknown>;
}

type IpcErrorKind =
  | 'validation'
  | 'io'
  | 'symlink_conflict'
  | 'not_found'
  | 'external_api'
  | 'unauthorized'
  | 'auth'
  | 'conflict'
  | 'internal';
```

Defined in [`src/shared/ipc-contract.ts`](../../src/shared/ipc-contract.ts).

## Preload bridge

`src/preload/index.ts` exposes a single function on `window.api`:

```ts
window.api.call<T>(method: string, params: unknown): Promise<IpcResult<T>>;
```

The renderer wraps it via `callIpc` ([`src/renderer/lib/ipc.ts`](../../src/renderer/lib/ipc.ts)), which unwraps `data` on success and throws `IpcCallError` on failure:

```ts
import { callIpc } from './lib/ipc.js';

const list = await callIpc<Customization[]>('customization.list');
```

## Dispatch and error mapping

[`src/main/ipc/dispatcher.ts`](../../src/main/ipc/dispatcher.ts) wraps every handler in a try/catch:

| Thrown | `IpcError.kind` | Notes |
|---|---|---|
| `DomainError(kind, …)` | `kind` (carried verbatim) | `details` propagated when present. |
| `Error` | `internal` | Message preserved; details dropped. |
| Anything else | `internal` | Message: `"Unknown error"`. |
| Unknown method | `not_found` | Returned without invoking any handler. |

## Methods

Grouped by namespace. Source: [`src/main/ipc/registry.ts`](../../src/main/ipc/registry.ts).

### `app`

| Method | Params | Result |
|---|---|---|
| `app.getHomeDir` | — | `string` (user home directory). |

### `settings`

| Method | Params | Result |
|---|---|---|
| `settings.get` | — | `Settings \| null` |
| `settings.save` | `Settings` | `void` |
| `settings.merge` | `Partial<Settings>` | `Settings` (merged result) |

`Settings` shape lives in [`src/shared/settings.ts`](../../src/shared/settings.ts).

### `repo`

| Method | Params | Result |
|---|---|---|
| `repo.detectGit` | `{ path: string }` | `boolean` |
| `repo.getCurrentBranch` | `{ path: string }` | `string` |
| `repo.link` | `{ path: string; name?: string }` | `LinkedRepoView` |
| `repo.unlink` | `{ id: string }` | `void` |
| `repo.list` | — | `LinkedRepoView[]` |

`repo.link` rejects with `{ kind: 'validation' }` if `path` is not a git repository.

### `workspace`

| Method | Params | Result |
|---|---|---|
| `workspace.bootstrap` | `{ workspacePath: string }` | `void` |
| `workspace.exists` | `{ path: string }` | `boolean` |
| `workspace.getActive` | — | `string` |
| `workspace.setActive` | `{ workspacePath: string }` | `void` |

`workspace.getActive` and `workspace.setActive` reject with `{ kind: 'internal' }` if the `workspaceLocator` dependency is not wired.

### `dialog`

| Method | Params | Result |
|---|---|---|
| `dialog.selectFolder` | `{ defaultPath?: string }` (or `null`) | `{ canceled: boolean; path?: string }` |

### `skill`

| Method | Params | Result |
|---|---|---|
| `skill.list` | `{ scope?: 'personal' \| 'project' }` | `Skill[]` (workspace + plugin-provided, with `source` field) |
| `skill.get` | `{ id: string }` | `Skill` |
| `skill.save` | `{ skill: Skill; isCreate?: boolean }` | `{ skill: Skill; syncReport: SyncResult[] }` |
| `skill.delete` | `{ id: string; removeSymlinks: boolean }` | `{ ok: true }` |

Saving or deleting a plugin-provided skill (`source.kind === 'plugin'`) raises `OperationNotAllowedForOriginError` (`kind: 'internal'` unless mapped). See [`src/main/application/schemas/skill.ts`](../../src/main/application/schemas/skill.ts).

### `agent`

| Method | Params | Result |
|---|---|---|
| `agent.list` | `{ scope?: 'personal' \| 'project' }` | `Agent[]` (workspace + plugin-provided) |
| `agent.get` | `{ id: string }` | `Agent` |
| `agent.save` | `{ agent: Agent; isCreate?: boolean }` | `{ agent: Agent; syncReport: SyncResult[] }` |
| `agent.delete` | `{ id: string; removeSymlinks: boolean }` | `{ ok: true }` |

Same plugin-source guard as `skill.*`.

### `reference`

| Method | Params | Result |
|---|---|---|
| `reference.list` | `{ scope?: 'personal' \| 'project' }` | `Reference[]` |
| `reference.get` | `{ id: string }` | `Reference` |
| `reference.save` | `{ reference: Reference; isCreate?: boolean }` | `{ reference: Reference; syncReport: SyncResult[] }` |
| `reference.delete` | `{ id: string; removeSymlinks: boolean }` | `{ ok: true }` |

References are app-only — never synced to Claude (see `claude-adapter.ts`).

### `global-instruction`

| Method | Params | Result |
|---|---|---|
| `global-instruction.get` | `{ id: 'default' }` | `GlobalInstruction` |
| `global-instruction.save` | `{ globalInstruction: GlobalInstruction; isCreate?: boolean }` | `{ globalInstruction: GlobalInstruction; syncReport: SyncResult[] }` |

The id is fixed to `'default'`; only one instance per machine.

### `marketplace`

| Method | Params | Result |
|---|---|---|
| `marketplace.list` | `{ scope: 'personal' \| 'project' }` | `MarketplaceSummary[]` (record + parsed manifest if available) |
| `marketplace.get` | `{ scope; id }` | `MarketplaceSummary \| null` |
| `marketplace.add` | `{ scope; id; source: { path: string } }` | `void` (persists to `extraKnownMarketplaces`) |
| `marketplace.remove` | `{ scope; id }` | `void` |
| `marketplace.refresh` | `{ scope; id }` | `MarketplaceSummary \| null` (re-parses manifest from disk) |

Existing `marketplace.detect` and `plugin.installFromMarketplace` (in the `plugin` namespace) handle URL detection and plugin installation from a marketplace entry.

### `customization` *(deprecated)*

Retained for the legacy `CustomizationList` screen used by `PluginEditor` and for cross-type search results.

| Method | Params | Result |
|---|---|---|
| `customization.list` | `{ type?: CustomizationType; root?: 'customizations' \| 'plugin:<id>' }` | `Customization[]` |
| `customization.get` | `{ id: string; root? }` | `Customization` |
| `customization.save` | `{ customization: Customization; isCreate?: boolean; root? }` | `{ customization: Customization; syncReport: SyncResult[] }` |
| `customization.delete` | `{ id: string; removeSymlinks: boolean; root? }` | `{ ok: true }` |
| `customization.search` | `{ query: string; options?: SearchOptions }` | `SearchOutput` |

`CustomizationType`, `Customization`, `SyncResult` — see [`src/shared/customization.ts`](../../src/shared/customization.ts) and [Customization schema](customization-schema.md). Prefer the typed namespaces above for new code.

### `template`

| Method | Params | Result |
|---|---|---|
| `template.list` | `{ targetType?: TemplateTargetType }` (or none) | `Template[]` |
| `template.get` | `{ id: string }` | `Template` |
| `template.save` | `{ template: Template; isCreate?: boolean }` | `Template` |
| `template.delete` | `{ id: string }` | `{ ok: true }` |

`Template`, `TemplateTargetType` — see [`src/shared/template.ts`](../../src/shared/template.ts).

### `adapter`

| Method | Params | Result |
|---|---|---|
| `adapter.syncAll` | `{ adapterId?: string }` (or none) | `SyncResult[]` |
| `adapter.removeAll` | `{ adapterId: string }` | `RemoveAdapterResult` |
| `adapter.setEnabled` | `{ adapterId: string; enabled: boolean; removeSymlinks?: boolean; runSyncAll?: boolean }` | See below |
| `adapter.countDestinations` | `{ adapterId: string }` | `{ count: number }` |

`adapter.setEnabled` returns:

- When `enabled: false` — a `RemoveAdapterResult` (default `removeSymlinks: true`); pass `removeSymlinks: false` to skip cleanup.
- When `enabled: true` — `{ syncReport: SyncResult[] }` (default `runSyncAll: true`); pass `runSyncAll: false` to skip the sync.

`RemoveAdapterResult`:

```ts
interface RemoveAdapterResult {
  removed: number;
  skipped: number;
  errors: { destination: string; kind: string; message: string }[];
}
```

### `plugin`

| Method | Params | Result |
|---|---|---|
| `plugin.import` | `{ url: string; ref?: string; scope?: string }` | `PluginSummary` |
| `plugin.list` | `{ scope?: string }` | `PluginListItem[]` |
| `plugin.get` | `{ id: string; scope?: string }` | `PluginDetail` |
| `plugin.update` | `{ id: string; scope?: string }` | `PluginSummary` |
| `plugin.remove` | `{ id: string; scope?: string }` | `void` |
| `plugin.toggle` | `{ id: string; scope?: string; enabled: boolean }` | `PluginSummary` |
| `plugin.createOwned` | `{ id: string; version: string; description?: string; scope?: string }` | `PluginSummary` |
| `plugin.deleteOwned` | `{ id: string; scope?: string }` | `void` |
| `plugin.publish` | `{ id: string; scope?: string; repoName?: string; visibility?: 'public' \| 'private'; version: string; commitMessage?: string }` | `PluginPublishInfo` |

**Plugin types:**

```ts
interface PluginListItem {
  id: string;
  name: string;
  version: string;
  source: 'imported' | 'owned';
  enabled: boolean;
}

interface PluginDetail extends PluginListItem {
  description?: string;
  author?: string;
  publishedTo?: Array<{ registry: string; url: string; version: string; publishedAt: string }>;
}

interface PluginSummary {
  id: string;
  version: string;
  enabled: boolean;
}

interface PluginPublishInfo {
  id: string;
  version: string;
  registryUrl: string;
  releaseUrl: string;
  publishedAt: string;
}
```

**Error conditions:**

- `plugin.import` — `{ kind: 'validation' }` if `url` is empty or invalid; `{ kind: 'external_api' }` if the remote registry is unreachable; `{ kind: 'conflict' }` if a plugin with that `id` already exists.
- `plugin.publish` — `{ kind: 'auth', message: 'PublishAuthMissing' }` if no GitHub PAT is configured; `{ kind: 'conflict' }` if the version already exists or local/remote branches diverge.

### `credentials`

| Method | Params | Result |
|---|---|---|
| `credentials.setGithubToken` | `{ token: string }` | `void` |
| `credentials.clearGithubToken` | — | `void` |
| `credentials.hasGithubToken` | — | `{ hasToken: boolean }` |

**Credential storage:**

- `setGithubToken` — encrypts the PAT using Electron's `safeStorage` and persists it; the token is **never** returned by any method.
- `clearGithubToken` — erases the stored credential.
- `hasGithubToken` — returns only a boolean; never returns the token itself.

## Validation rules (handler side)

Every handler that takes parameters validates them before delegating to the service. Common patterns:

- Non-empty string fields → `validation` error: `Missing or invalid '<field>'`.
- Enum fields (`type`, `targetType`) → `validation` error: `Invalid '<field>' (must be <a> | <b> | …)`.
- Object fields where an object is required → `validation` error: `Invalid '<label>' payload`.
- Booleans are required when the field is non-optional → `validation` error: `Missing or invalid '<field>'`.

Schema-level validation (frontmatter rules) runs deeper, inside the services — see [Customization schema](customization-schema.md).

## Adding a new method

1. Define params and result types in `src/shared/ipc-contract.ts` (or a focused shared module).
2. Add the handler in `src/main/ipc/registry.ts` under the appropriate namespace, validating raw params with the helpers (`asString`, `asObject`, `asCustomizationType`, …).
3. Use `callIpc<Result>('namespace.method', params)` from the renderer.

There is no separate registration file for the channel itself — the dispatcher receives the full handler map and looks up `method` directly.

## See also

- [Architecture overview](architecture.md) — how IPC sits between renderer and services.
- [Customization schema](customization-schema.md) — frontmatter rules enforced after the handler accepts the payload.
