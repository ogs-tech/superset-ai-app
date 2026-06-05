import { describe, expect, it, vi } from 'vitest';
import { SettingsService } from '../../../../src/main/application/services/settings-service.js';
import type { SettingsRepository } from '../../../../src/main/application/ports/settings-repository.js';
import { DomainError } from '../../../../src/main/domain/errors.js';
import { getDefaults, type Settings } from '../../../../src/shared/settings.js';

const baseSettings = (): Settings => ({
  adapters: {
    claude: { enabled: true },
  },
  linkedRepos: [{ id: 'r1', name: 'repo', path: '/repos/r1' }],
  ui: { theme: 'system' },
  language: 'off',
});

const stubRepo = (overrides: Partial<SettingsRepository> = {}): SettingsRepository => ({
  load: () => Promise.resolve(null),
  save: () => Promise.resolve(),
  ...overrides,
});

describe('SettingsService.load', () => {
  it('returns null when repository.load resolves null', async () => {
    const service = new SettingsService(stubRepo({ load: () => Promise.resolve(null) }));

    const result = await service.load();

    expect(result).toBeNull();
  });

  it('returns the deep-equal object produced by repository.load', async () => {
    const persisted = baseSettings();
    const service = new SettingsService(stubRepo({ load: () => Promise.resolve(persisted) }));

    const result = await service.load();

    expect(result).toEqual(persisted);
  });

  it('propagates DomainError from the repository without swallowing it', async () => {
    const domainErr = new DomainError('io', 'disk on fire', { path: '/x' });
    const service = new SettingsService(
      stubRepo({ load: () => Promise.reject(domainErr) }),
    );

    await expect(service.load()).rejects.toBe(domainErr);
  });
});

describe('SettingsService.merge', () => {
  it('applies a deep-merge over the persisted state', async () => {
    const persisted = baseSettings();
    const save = vi.fn().mockResolvedValue(undefined);
    const service = new SettingsService(
      stubRepo({ load: () => Promise.resolve(persisted), save }),
    );

    const result = await service.merge({
      adapters: { claude: { enabled: false } },
      ui: { theme: 'dark' },
      language: 'off',
    });

    expect(result.adapters.claude).toEqual({ enabled: false });
    expect(result.ui.theme).toBe('dark');
    expect(result.linkedRepos).toEqual(persisted.linkedRepos);
  });

  it('persists the consolidated object via repository.save', async () => {
    const persisted = baseSettings();
    const save = vi.fn().mockResolvedValue(undefined);
    const service = new SettingsService(
      stubRepo({ load: () => Promise.resolve(persisted), save }),
    );

    const result = await service.merge({ ui: { theme: 'light' } });

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(result);
    expect(result.ui.theme).toBe('light');
  });

  it('uses defaults as the base when no settings are persisted yet', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const service = new SettingsService(
      stubRepo({ load: () => Promise.resolve(null), save }),
    );

    const result = await service.merge({ ui: { theme: 'dark' } });

    expect(result).toEqual({ ...getDefaults(), ui: { theme: 'dark' } });
    expect(save).toHaveBeenCalledWith(result);
  });

  it('replaces array fields wholesale (no element-wise merge)', async () => {
    const persisted = baseSettings();
    const save = vi.fn().mockResolvedValue(undefined);
    const service = new SettingsService(
      stubRepo({ load: () => Promise.resolve(persisted), save }),
    );

    const result = await service.merge({ linkedRepos: [] });

    expect(result.linkedRepos).toEqual([]);
  });
});

describe('SettingsService.save', () => {
  it('delegates to repository.save with the supplied object', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const service = new SettingsService(stubRepo({ save }));
    const settings = baseSettings();

    await service.save(settings);

    expect(save).toHaveBeenCalledWith(settings);
  });
});

describe('SettingsService.getDefaults', () => {
  it('returns the canonical default settings', () => {
    const service = new SettingsService(stubRepo());

    expect(service.getDefaults()).toEqual(getDefaults());
  });
});
