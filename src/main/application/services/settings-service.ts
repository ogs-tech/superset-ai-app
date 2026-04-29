import { getDefaults, type Settings } from '../../../shared/settings.js';
import type { SettingsRepository } from '../ports/settings-repository.js';

const stripLegacyFields = (settings: Settings): Settings => {
  const adapters = settings.adapters as unknown as Record<
    'claude' | 'copilot',
    Record<string, unknown>
  >;
  const clean = (entry: Record<string, unknown>): { enabled: boolean } => {
    const rest = { ...entry };
    delete rest.defaultScope;
    return rest as { enabled: boolean };
  };
  return {
    ...settings,
    adapters: {
      claude: clean(adapters.claude),
      copilot: clean(adapters.copilot),
    },
  };
};

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<infer U>
    ? Array<U>
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const deepMerge = <T extends Record<string, unknown>>(
  base: T,
  patch: DeepPartial<T>,
): T => {
  const result: Record<string, unknown> = { ...base };
  for (const [key, patchValue] of Object.entries(patch)) {
    if (patchValue === undefined) continue;
    const baseValue = (base as Record<string, unknown>)[key];
    if (isPlainObject(baseValue) && isPlainObject(patchValue)) {
      result[key] = deepMerge(
        baseValue,
        patchValue as DeepPartial<Record<string, unknown>>,
      );
    } else {
      result[key] = patchValue;
    }
  }
  return result as T;
};

export class SettingsService {
  constructor(private readonly repository: SettingsRepository) {}

  async load(): Promise<Settings | null> {
    const loaded = await this.repository.load();
    return loaded === null ? null : stripLegacyFields(loaded);
  }

  save(settings: Settings): Promise<void> {
    return this.repository.save(settings);
  }

  async merge(partial: DeepPartial<Settings>): Promise<Settings> {
    const loaded = await this.repository.load();
    const current = loaded === null ? getDefaults() : stripLegacyFields(loaded);
    const next = deepMerge(current as unknown as Record<string, unknown>, partial as DeepPartial<Record<string, unknown>>) as unknown as Settings;
    await this.repository.save(next);
    return next;
  }

  getDefaults(): Settings {
    return getDefaults();
  }
}
