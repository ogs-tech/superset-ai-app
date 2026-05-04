import { describe, expect, it, vi } from 'vitest';
import { buildHandlers, type IpcDeps } from '../../../../src/main/ipc/registry.js';
import { createDispatcher } from '../../../../src/main/ipc/dispatcher.js';
import type { SearchService, SearchOutput } from '../../../../src/main/application/services/search-service.js';

const stubOutput: SearchOutput = {
  results: [],
  total: 0,
  truncated: false,
};

const buildDeps = (search: () => Promise<SearchOutput>): IpcDeps => {
  const searchService: Partial<SearchService> = { search };
  return { searchService } as unknown as IpcDeps;
};

describe('IPC customization.search (T018 — AC#12)', () => {
  it('delegates to SearchService.search("review", undefined) and returns { results, total, truncated }', async () => {
    const search = vi.fn<() => Promise<SearchOutput>>().mockResolvedValue(stubOutput);
    const handlers = buildHandlers(buildDeps(search));
    const dispatch = createDispatcher(handlers);

    const result = await dispatch('customization.search', { query: 'review' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual(stubOutput);
    expect(search).toHaveBeenCalledWith('review', undefined);
  });
});
