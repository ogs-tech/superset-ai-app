import type { IpcError, IpcErrorKind, IpcResult } from '../../shared/ipc-contract.js';
import { DomainError } from '../domain/errors.js';
import {
  PluginIdInvalidError,
  ManifestInvalidError,
  SemVerInvalidError,
  PluginCollisionError,
  OwnPluginIdCollisionError,
  OperationNotAllowedForOriginError,
  RefNotFoundError,
  SettingsLockTimeoutError,
  CredentialStoreUnavailableError,
  PublishAuthMissingError,
  RepoAlreadyExistsError,
  TagConflictError,
  PublishConflictError,
} from '../domain/plugin-errors.js';

export type IpcHandler = (params: unknown) => Promise<unknown> | unknown;

export type IpcHandlers = Record<string, IpcHandler>;

export type Dispatcher = (method: string, params: unknown) => Promise<IpcResult<unknown>>;

export function createDispatcher(handlers: IpcHandlers): Dispatcher {
  return async (method, params) => {
    const handler = handlers[method];
    if (!handler) {
      return { ok: false, error: notFound(method) };
    }
    try {
      const data = await handler(params);
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: toIpcError(err) };
    }
  };
}

function notFound(method: string): IpcError {
  return { kind: 'not_found', message: `Unknown IPC method: ${method}` };
}

function getPluginErrorKind(err: unknown): IpcErrorKind | null {
  if (
    err instanceof PluginIdInvalidError ||
    err instanceof ManifestInvalidError ||
    err instanceof SemVerInvalidError ||
    err instanceof PluginCollisionError ||
    err instanceof OwnPluginIdCollisionError ||
    err instanceof OperationNotAllowedForOriginError
  ) return 'validation';

  if (err instanceof RefNotFoundError) return 'not_found';

  if (
    err instanceof SettingsLockTimeoutError ||
    err instanceof CredentialStoreUnavailableError
  ) return 'io';

  if (err instanceof PublishAuthMissingError) return 'auth';

  if (
    err instanceof RepoAlreadyExistsError ||
    err instanceof TagConflictError ||
    err instanceof PublishConflictError
  ) return 'conflict';

  return null;
}

function toIpcError(err: unknown): IpcError {
  const pluginKind = getPluginErrorKind(err);
  if (pluginKind !== null && err instanceof Error) {
    const base: IpcError = { kind: pluginKind, message: err.message };
    const details = (err as { details?: Record<string, unknown> }).details;
    return details !== undefined ? { ...base, details } : base;
  }
  if (err instanceof DomainError) {
    const base: IpcError = { kind: err.kind, message: err.message };
    return err.details === undefined ? base : { ...base, details: err.details };
  }
  if (err instanceof Error) {
    return { kind: 'internal', message: err.message };
  }
  return { kind: 'internal', message: 'Unknown error' };
}
