import { describe, expect, it, vi } from 'vitest';
import { SettingsService } from '../../../../src/main/application/services/settings-service.js';
import type { SettingsRepository } from '../../../../src/main/application/ports/settings-repository.js';
import type { Settings } from '../../../../src/shared/settings.js';

const stubRepo = (overrides: Partial<SettingsRepository> = {}): SettingsRepository => ({
  load: () => Promise.resolve(null),
  save: () => Promise.resolve(),
  ...overrides,
});

const legacyPersisted = (): Settings =>
  ({
    workspacePath: '/tmp/legacy',
    adapters: {
      claude: { enabled: true, defaultScope: 'personal' },
      copilot: { enabled: false, defaultScope: 'project' },
    },
    linkedRepos: [],
    ui: { theme: 'system' },
  }) as unknown as Settings;

describe('SettingsService — legacy defaultScope strip on load', () => {
  it('drops defaultScope from each adapter when loading legacy settings', async () => {
    const service = new SettingsService(
      stubRepo({ load: () => Promise.resolve(legacyPersisted()) }),
    );

    const result = await service.load();

    expect(result).not.toBeNull();
    expect(result!.adapters.claude).toEqual({ enabled: true });
    expect(result!.adapters.copilot).toEqual({ enabled: false });
    expect(
      (result!.adapters.claude as unknown as { defaultScope?: string }).defaultScope,
    ).toBeUndefined();
    expect(
      (result!.adapters.copilot as unknown as { defaultScope?: string }).defaultScope,
    ).toBeUndefined();
  });

  it('persists the cleaned shape when merge is called over legacy state', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const service = new SettingsService(
      stubRepo({ load: () => Promise.resolve(legacyPersisted()), save }),
    );

    const next = await service.merge({ ui: { theme: 'dark' } });

    expect(save).toHaveBeenCalledTimes(1);
    expect(next.adapters.claude).toEqual({ enabled: true });
    expect(next.adapters.copilot).toEqual({ enabled: false });
    expect((save.mock.calls[0]![0] as Settings).adapters.claude).toEqual({ enabled: true });
  });
});
