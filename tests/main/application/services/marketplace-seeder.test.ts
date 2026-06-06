import { describe, expect, it, vi } from 'vitest';
import {
  MarketplaceSeeder,
  OFFICIAL_MARKETPLACE_REPO,
  OFFICIAL_MARKETPLACE_URL,
} from '../../../../src/main/application/services/marketplace-seeder.js';

const officialRecord = (overrides: Record<string, unknown> = {}) => ({
  id: 'claude-plugins-official',
  source: { kind: 'github', repo: OFFICIAL_MARKETPLACE_REPO },
  ...overrides,
});

const buildSeeder = (listResult: unknown[]) => {
  const list = vi.fn(async () => listResult);
  const addFromUrl = vi.fn(async () => ({ id: 'claude-plugins-official', manifest: {} }));
  const refresh = vi.fn(async () => null);
  const seeder = new MarketplaceSeeder({
    marketplaceService: { list, addFromUrl, refresh } as never,
    log: () => {},
  });
  return { seeder, list, addFromUrl, refresh };
};

describe('MarketplaceSeeder.seedDefaultsIfMissing', () => {
  it('seeds the official marketplace when none is registered', async () => {
    const { seeder, addFromUrl, refresh } = buildSeeder([]);

    await seeder.seedDefaultsIfMissing('personal');

    expect(addFromUrl).toHaveBeenCalledWith('personal', OFFICIAL_MARKETPLACE_URL);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('does nothing when the official marketplace is present and its manifest loads', async () => {
    const { seeder, addFromUrl, refresh } = buildSeeder([
      officialRecord({ manifest: { name: 'official', plugins: [] } }),
    ]);

    await seeder.seedDefaultsIfMissing('personal');

    expect(addFromUrl).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('repairs a dangling registration by re-cloning when the manifest is missing', async () => {
    // Registered (e.g. left over from a previous run) but the clone cache is
    // gone, so list() returns the record without a manifest.
    const { seeder, addFromUrl, refresh } = buildSeeder([officialRecord()]);

    await seeder.seedDefaultsIfMissing('personal');

    expect(refresh).toHaveBeenCalledWith('personal', 'claude-plugins-official');
    expect(addFromUrl).not.toHaveBeenCalled();
  });

  it('swallows a failed repair so startup is not blocked', async () => {
    const { seeder, refresh } = buildSeeder([officialRecord()]);
    refresh.mockRejectedValueOnce(new Error('network down'));

    await expect(seeder.seedDefaultsIfMissing('personal')).resolves.toBeUndefined();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('skips seeding entirely when listing marketplaces fails', async () => {
    const list = vi.fn(async () => {
      throw new Error('settings unreadable');
    });
    const addFromUrl = vi.fn();
    const refresh = vi.fn();
    const seeder = new MarketplaceSeeder({
      marketplaceService: { list, addFromUrl, refresh } as never,
      log: () => {},
    });

    await expect(seeder.seedDefaultsIfMissing('personal')).resolves.toBeUndefined();
    expect(addFromUrl).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
});
