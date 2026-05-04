import { describe, it, expect } from 'vitest';
import { SearchService } from '../../../../../src/main/application/services/search-service.js';
import { InMemoryCustomizationRepository } from '../../../../../src/main/infrastructure/customization/in-memory-customization-repository.js';

describe('SearchService — contract (AC#1)', () => {
  it('search(query) resolves with { results: SearchResult[], total: number, truncated: boolean }', async () => {
    const customizationRepository = new InMemoryCustomizationRepository();
    const svc = new SearchService({ customizationRepository });

    const output = await svc.search('x');

    expect(Array.isArray(output.results)).toBe(true);
    expect(typeof output.total).toBe('number');
    expect(typeof output.truncated).toBe('boolean');
  });
});
