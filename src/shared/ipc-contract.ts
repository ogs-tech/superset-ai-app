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
