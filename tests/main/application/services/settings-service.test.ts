import { describe, expect, it, vi } from 'vitest';
import { SettingsService } from '../../../../src/main/application/services/settings-service.js';
import type { SettingsRepository } from '../../../../src/main/application/ports/settings-repository.js';
import { DomainError } from '../../../../src/main/domain/errors.js';
import { getDefaults, type Settings } from '../../../../src/shared/settings.js';

const baseSettings = (): Settings => ({
  adapters: {
    claude: { enabled: true },
    cursor: { enabled: false },
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

type MergePatch = Parameters<SettingsService['merge']>[0];

describe('SettingsService.save — validation', () => {
  it('rejects a non-object payload', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const service = new SettingsService(stubRepo({ save }));

    await expect(service.save(null as unknown as Settings)).rejects.toMatchObject({
      kind: 'validation',
    });
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects an invalid theme', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const service = new SettingsService(stubRepo({ save }));
    const bad = { ...baseSettings(), ui: { theme: 'neon' } } as unknown as Settings;

    await expect(service.save(bad)).rejects.toMatchObject({ kind: 'validation' });
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects unknown top-level fields', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const service = new SettingsService(stubRepo({ save }));
    const bad = { ...baseSettings(), rogue: 1 } as unknown as Settings;

    await expect(service.save(bad)).rejects.toMatchObject({ kind: 'validation' });
    expect(save).not.toHaveBeenCalled();
  });
});

describe('SettingsService.merge — validation', () => {
  it('rejects a non-object patch instead of throwing a TypeError', async () => {
    const service = new SettingsService(
      stubRepo({ load: () => Promise.resolve(baseSettings()) }),
    );

    await expect(service.merge(null as unknown as MergePatch)).rejects.toMatchObject({
      kind: 'validation',
    });
  });

  it('rejects a patch that yields an invalid language', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const service = new SettingsService(
      stubRepo({ load: () => Promise.resolve(baseSettings()), save }),
    );

    await expect(
      service.merge({ language: 'klingon' } as unknown as MergePatch),
    ).rejects.toMatchObject({ kind: 'validation' });
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects unknown keys carried in by the patch', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const service = new SettingsService(
      stubRepo({ load: () => Promise.resolve(baseSettings()), save }),
    );

    await expect(
      service.merge({ rogue: true } as unknown as MergePatch),
    ).rejects.toMatchObject({ kind: 'validation' });
    expect(save).not.toHaveBeenCalled();
  });
});

describe('SettingsService.getDefaults', () => {
  it('returns the canonical default settings', () => {
    const service = new SettingsService(stubRepo());

    expect(service.getDefaults()).toEqual(getDefaults());
  });
});

describe('SettingsService — cursor adapter', () => {
  it('save accepts settings with a cursor adapter', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const service = new SettingsService(stubRepo({ save }));
    const withCursor: Settings = {
      adapters: { claude: { enabled: true }, cursor: { enabled: true } },
      linkedRepos: [],
      ui: { theme: 'system' },
      language: 'off',
    };

    await service.save(withCursor);

    expect(save).toHaveBeenCalledWith(withCursor);
  });

  it('save rejects an unknown adapter key', async () => {
    const service = new SettingsService(stubRepo());
    const bad = {
      adapters: { claude: { enabled: true }, copilot: { enabled: true } },
      linkedRepos: [],
      ui: { theme: 'system' },
      language: 'off',
    } as unknown as Settings;

    await expect(service.save(bad)).rejects.toBeInstanceOf(DomainError);
  });

  it('save rejects settings missing the cursor adapter', async () => {
    const service = new SettingsService(stubRepo());
    const bad = {
      adapters: { claude: { enabled: true } },
      linkedRepos: [],
      ui: { theme: 'system' },
      language: 'off',
    } as unknown as Settings;

    await expect(service.save(bad)).rejects.toBeInstanceOf(DomainError);
  });

  it('load backfills a disabled cursor for pre-cursor settings files', async () => {
    const legacy = {
      adapters: { claude: { enabled: true } },
      linkedRepos: [],
      ui: { theme: 'system' },
      language: 'off',
    } as unknown as Settings;
    const service = new SettingsService(stubRepo({ load: () => Promise.resolve(legacy) }));

    const loaded = await service.load();

    expect(loaded?.adapters.cursor).toEqual({ enabled: false });
    expect(loaded?.adapters.claude).toEqual({ enabled: true });
  });
});
