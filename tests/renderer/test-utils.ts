import { vi } from 'vitest';
import type { IpcErrorKind, IpcResult } from '../../src/shared/ipc-contract.js';

export type CallSpy = ReturnType<typeof vi.fn>;

export function mockApi(): CallSpy {
  const call = vi.fn();
  Object.defineProperty(window, 'api', {
    value: { call },
    writable: true,
    configurable: true,
  });
  return call;
}

export const ok = <T>(data: T): IpcResult<T> => ({ ok: true, data });
export const fail = (kind: IpcErrorKind, message: string): IpcResult<never> => ({
  ok: false,
  error: { kind, message },
});
