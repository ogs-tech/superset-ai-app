import type { IpcError, IpcResult } from '../../shared/ipc-contract.js';
import { DomainError } from '../domain/errors.js';

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

function toIpcError(err: unknown): IpcError {
  if (err instanceof DomainError) {
    const base: IpcError = { kind: err.kind, message: err.message };
    return err.details === undefined ? base : { ...base, details: err.details };
  }
  if (err instanceof Error) {
    return { kind: 'internal', message: err.message };
  }
  return { kind: 'internal', message: 'Unknown error' };
}
