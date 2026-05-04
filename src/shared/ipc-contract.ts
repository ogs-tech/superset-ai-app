import type { Customization, CustomizationType, SyncResult } from './customization.js';
import type { Template, TemplateTargetType } from './template.js';

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

export interface CustomizationListParams {
  type?: CustomizationType;
}

export interface CustomizationGetParams {
  id: string;
}

export interface CustomizationSaveParams {
  customization: Customization;
}

export interface CustomizationSaveResult {
  customization: Customization;
  syncReport: SyncResult[];
}

export interface AdapterSyncAllParams {
  adapterId?: string;
}

export type AdapterSyncAllResult = SyncResult[];

export interface CustomizationDeleteParams {
  id: string;
  removeSymlinks: boolean;
}

export interface CustomizationDeleteResult {
  ok: true;
}

export interface TemplateListParams {
  targetType?: TemplateTargetType;
}

export interface TemplateGetParams {
  id: string;
}

export interface TemplateSaveParams {
  template: Template;
  isCreate?: boolean;
}

export interface TemplateDeleteParams {
  id: string;
}

export interface TemplateDeleteResult {
  ok: true;
}

export type CustomizationListResult = Customization[];
export type CustomizationGetResult = Customization;
export type TemplateListResult = Template[];
export type TemplateGetResult = Template;
export type TemplateSaveResult = Template;

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
