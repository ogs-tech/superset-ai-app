import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNEL, type IpcResult } from '../shared/ipc-contract.js';

const api = {
  call: <T>(method: string, params: unknown): Promise<IpcResult<T>> =>
    ipcRenderer.invoke(IPC_CHANNEL, { method, params }) as Promise<IpcResult<T>>,
  isDev: process.env['NODE_ENV'] === 'development',
};

contextBridge.exposeInMainWorld('api', api);

export type Api = typeof api;
