import type { Artifact, ArtifactType, SyncResult } from './artifact.js';
import type { Template, TemplateTargetType } from './template.js';

export type IpcErrorKind =
  | 'validation'
  | 'io'
  | 'symlink_conflict'
  | 'not_found'
  | 'external_api'
  | 'unauthorized'
  | 'internal';

export interface IpcError {
  kind: IpcErrorKind;
  message: string;
  details?: Record<string, unknown>;
}

export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: IpcError };

export const IPC_CHANNEL = 'ipc:call' as const;

export interface ArtifactListParams {
  type?: ArtifactType;
}

export interface ArtifactGetParams {
  id: string;
}

export interface ArtifactSaveParams {
  artifact: Artifact;
}

export interface ArtifactSaveResult {
  artifact: Artifact;
  syncReport: SyncResult[];
}

export interface AdapterSyncAllParams {
  adapterId?: string;
}

export type AdapterSyncAllResult = SyncResult[];

export interface ArtifactDeleteParams {
  id: string;
  removeSymlinks: boolean;
}

export interface ArtifactDeleteResult {
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

export type ArtifactListResult = Artifact[];
export type ArtifactGetResult = Artifact;
export type TemplateListResult = Template[];
export type TemplateGetResult = Template;
export type TemplateSaveResult = Template;
