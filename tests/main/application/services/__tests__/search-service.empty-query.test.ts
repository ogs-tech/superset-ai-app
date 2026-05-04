import { describe, it, expect, vi } from 'vitest';
import { SearchService } from '../../../../../src/main/application/services/search-service.js';
import { InMemoryCustomizationRepository } from '../../../../../src/main/infrastructure/customization/in-memory-customization-repository.js';

describe('SearchService — empty query (AC#3)', () => {
  it('query "" returns empty result without calling list', async () => {
    const customizationRepository = new InMemoryCustomizationRepository();
    const listSpy = vi.spyOn(customizationRepository, 'list');
    const svc = new SearchService({ customizationRepository });

    const output = await svc.search('');

    expect(output).toEqual({ results: [], total: 0, truncated: false });
    expect(listSpy).not.toHaveBeenCalled();
  });

  it('query "   " (whitespace) returns empty result without calling list', async () => {
    const customizationRepository = new InMemoryCustomizationRepository();
    const listSpy = vi.spyOn(customizationRepository, 'list');
    const svc = new SearchService({ customizationRepository });

    const output = await svc.search('   ');

    expect(output).toEqual({ results: [], total: 0, truncated: false });
    expect(listSpy).not.toHaveBeenCalled();
  });
});
