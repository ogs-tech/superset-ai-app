import { describe, it, expect, vi } from 'vitest';
import { buildHandlers, type IpcDeps } from '../../../../src/main/ipc/registry.js';
import { createDispatcher } from '../../../../src/main/ipc/dispatcher.js';
import type { AdapterManager } from '../../../../src/main/application/services/adapter-manager.js';

const buildDeps = (count: number) => {
  const countDestinations = vi.fn<() => Promise<number>>().mockResolvedValue(count);
  const adapterManager = { countDestinations } as unknown as AdapterManager;
  return { adapterManager, countDestinations };
};

describe('IPC adapter.countDestinations (T033 — AC#17)', () => {
  it('returns { count: N } from AdapterManager.countDestinations', async () => {
    const { adapterManager, countDestinations } = buildDeps(5);
    const handlers = buildHandlers({ adapterManager } as unknown as IpcDeps);
    const dispatch = createDispatcher(handlers);

    const result = await dispatch('adapter.countDestinations', { adapterId: 'claude' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual({ count: 5 });
    expect(countDestinations).toHaveBeenCalledWith('claude');
  });
});
