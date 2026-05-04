import { describe, it, expect, vi } from 'vitest';
import { SearchService } from '../../../../../src/main/application/services/search-service.js';
import { InMemoryCustomizationRepository } from '../../../../../src/main/infrastructure/customization/in-memory-customization-repository.js';

describe('SearchService — no cache (AC#16)', () => {
  it('3 consecutive search calls invoke CustomizationRepository.list 3 times', async () => {
    const repo = new InMemoryCustomizationRepository();
    const listSpy = vi.spyOn(repo, 'list');
    const svc = new SearchService({ customizationRepository: repo });

    await svc.search('x');
    await svc.search('x');
    await svc.search('x');

    expect(listSpy).toHaveBeenCalledTimes(3);
  });
});
