import { vi } from 'vitest';
import type { ReactElement } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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

export const ok = <T,>(data: T): IpcResult<T> => ({ ok: true, data });
export const fail = (kind: IpcErrorKind, message: string): IpcResult<never> => ({
  ok: false,
  error: { kind, message },
});

export function makeTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function renderWithQuery(
  ui: ReactElement,
  options?: RenderOptions & { client?: QueryClient },
) {
  const { client: providedClient, ...rest } = options ?? {};
  const client = providedClient ?? makeTestQueryClient();
  return {
    client,
    ...render(ui, {
      ...rest,
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    }),
  };
}
