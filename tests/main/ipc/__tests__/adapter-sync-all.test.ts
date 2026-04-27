import { describe, expect, it, vi } from 'vitest';
import { buildHandlers, type IpcDeps } from '../../../../src/main/ipc/registry.js';
import { createDispatcher } from '../../../../src/main/ipc/dispatcher.js';
import type { AdapterManager } from '../../../../src/main/application/services/adapter-manager.js';
import type { SyncResult } from '../../../../src/shared/artifact.js';

const stubResults: SyncResult[] = [
  { adapter: 'claude', destination: '/dest/claude', status: 'ok' },
  { adapter: 'copilot', destination: '/dest/copilot', status: 'ok' },
];

const buildDeps = (syncAll: ReturnType<typeof vi.fn>): IpcDeps => {
  const adapterManager = {
    syncAll,
    syncOne: vi.fn().mockResolvedValue([]),
  } as unknown as AdapterManager;
  return {
    adapterManager,
  } as unknown as IpcDeps;
};

describe('IPC adapter.syncAll dispatcher integration', () => {
  it('delegates to AdapterManager.syncAll without filter when adapterId is omitted', async () => {
    const syncAll = vi.fn().mockResolvedValue(stubResults);
    const handlers = buildHandlers(buildDeps(syncAll));
    const dispatch = createDispatcher(handlers);

    const result = await dispatch('adapter.syncAll', {});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual(stubResults);
    expect(syncAll).toHaveBeenCalledWith({});
  });

  it('forwards adapterId filter when provided', async () => {
    const syncAll = vi.fn().mockResolvedValue([stubResults[0]]);
    const handlers = buildHandlers(buildDeps(syncAll));
    const dispatch = createDispatcher(handlers);

    const result = await dispatch('adapter.syncAll', { adapterId: 'claude' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([stubResults[0]]);
    expect(syncAll).toHaveBeenCalledWith({ adapterId: 'claude' });
  });

  it('returns validation envelope for non-string adapterId', async () => {
    const syncAll = vi.fn();
    const handlers = buildHandlers(buildDeps(syncAll));
    const dispatch = createDispatcher(handlers);

    const result = await dispatch('adapter.syncAll', { adapterId: 42 });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation');
    expect(syncAll).not.toHaveBeenCalled();
  });
});
