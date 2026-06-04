import type { SyncResult } from './customization.js';

export type IpcErrorKind =
  | 'validation'
  | 'io'
  | 'symlink_conflict'
  | 'not_found'
  | 'external_api'
  | 'unauthorized'
  | 'internal'
  | 'auth'
  | 'conflict';

export interface IpcError {
  kind: IpcErrorKind;
  message: string;
  details?: Record<string, unknown>;
}

export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: IpcError };

export const IPC_CHANNEL = 'ipc:call' as const;

export interface AdapterSyncAllParams {
  adapterId?: string;
}

export type AdapterSyncAllResult = SyncResult[];

// ──────────────────────────────────────────────────────────────────────────
// Plugin methods (IPC method names)
// ──────────────────────────────────────────────────────────────────────────
// plugin.list(params) → PluginListItemIpc[]
// plugin.get(params) → PluginDetailIpc
// plugin.import(params) → PluginSummaryIpc
// plugin.createOwned(params) → PluginSummaryIpc
// plugin.remove(params) → { ok: true }
// plugin.toggle(params) → { ok: true }
// plugin.update(params) → PluginSummaryIpc
// plugin.publish(params) → PluginPublishInfoIpc

// ──────────────────────────────────────────────────────────────────────────
// Credentials methods (IPC method names)
// ──────────────────────────────────────────────────────────────────────────
// credentials.setGithubToken(params) → { ok: true }
// credentials.hasGithubToken() → HasGithubTokenResult
