import { getDefaults, type Settings } from '../../../shared/settings.js';
import type { SettingsRepository } from '../ports/settings-repository.js';

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

  load(): Promise<Settings | null> {
    return this.repository.load();
  }

  save(settings: Settings): Promise<void> {
    return this.repository.save(settings);
  }

  async merge(partial: DeepPartial<Settings>): Promise<Settings> {
    const current = (await this.repository.load()) ?? getDefaults();
    const next = deepMerge(current as unknown as Record<string, unknown>, partial as DeepPartial<Record<string, unknown>>) as unknown as Settings;
    await this.repository.save(next);
    return next;
  }

  getDefaults(): Settings {
    return getDefaults();
  }
}
