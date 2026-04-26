import type { IpcResult } from '../../shared/ipc-contract.js';

export class IpcCallError extends Error {
  readonly kind: string;
  readonly details: Record<string, unknown> | undefined;

  constructor(kind: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'IpcCallError';
    this.kind = kind;
    this.details = details;
  }
}

export async function callIpc<T>(method: string, params: unknown = {}): Promise<T> {
  const result = (await window.api.call<T>(method, params)) as IpcResult<T>;
  if (!result.ok) {
    throw new IpcCallError(result.error.kind, result.error.message, result.error.details);
  }
  return result.data;
}
