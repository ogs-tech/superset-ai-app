/// <reference types="vite/client" />

import type { IpcResult } from '../shared/ipc-contract.js';

declare global {
  interface Window {
    api: {
      call<T>(method: string, params: unknown): Promise<IpcResult<T>>;
      isDev: boolean;
    };
  }
}

export {};
