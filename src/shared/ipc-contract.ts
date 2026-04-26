import type { Artifact, ArtifactType, SyncResult, Template } from './artifact.js';

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

export interface ArtifactDeleteParams {
  id: string;
  removeSymlinks: boolean;
}

export interface ArtifactDeleteResult {
  ok: true;
}

export interface TemplateListParams {
  type: ArtifactType;
}

export type ArtifactListResult = Artifact[];
export type ArtifactGetResult = Artifact;
export type TemplateListResult = Template[];
