import {
  getDefaults,
  type Settings,
  type ThemeMode,
  type LanguagePreference,
} from '../../../shared/settings.js';
import type { SettingsRepository } from '../ports/settings-repository.js';
import { DomainError } from '../../domain/errors.js';

const stripLegacyFields = (settings: Settings): Settings => {
  // Drops fields from older on-disk shapes (a removed `copilot` adapter key, the
  // legacy per-adapter `defaultScope`) by rebuilding `adapters` from scratch, and
  // backfills a disabled `cursor` for settings files written before it existed.
  const adapters = settings.adapters as unknown as {
    claude?: Record<string, unknown>;
    cursor?: Record<string, unknown>;
  };
  const clean = (
    entry: Record<string, unknown> | undefined,
    fallbackEnabled: boolean,
  ): { enabled: boolean } => ({
    enabled: typeof entry?.['enabled'] === 'boolean' ? (entry['enabled'] as boolean) : fallbackEnabled,
  });
  return {
    ...settings,
    adapters: {
      claude: clean(adapters.claude, true),
      cursor: clean(adapters.cursor, false),
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

const THEME_MODES: readonly ThemeMode[] = ['system', 'light', 'dark'];
const LANGUAGE_PREFERENCES: readonly LanguagePreference[] = [
  'off',
  'mirror',
  'pt-BR',
  'en',
  'es',
];
const SETTINGS_FIELDS: readonly string[] = ['adapters', 'linkedRepos', 'ui', 'language'];

const invalid = (message: string): never => {
  throw new DomainError('validation', message);
};

const asRecord = (value: unknown, message: string): Record<string, unknown> => {
  if (!isPlainObject(value)) invalid(message);
  return value as Record<string, unknown>;
};

// Guards that an object is a well-formed `Settings` before it reaches disk. Mirrors
// the `Settings` shape exactly (strict on unknown keys) so neither a buggy renderer
// (settings.save) nor a malformed merge patch can persist garbage into settings.json.
function assertValidSettings(value: unknown): asserts value is Settings {
  const s = asRecord(value, 'Settings must be an object');

  for (const key of Object.keys(s)) {
    if (!SETTINGS_FIELDS.includes(key)) invalid(`Unknown settings field '${key}'`);
  }

  const adapters = asRecord(s['adapters'], "Missing or invalid 'adapters'");
  const adapterKeys = Object.keys(adapters);
  const ALLOWED_ADAPTERS = new Set(['claude', 'cursor']);
  if (!adapterKeys.includes('claude')) {
    invalid("'adapters' must contain the 'claude' adapter");
  }
  for (const key of adapterKeys) {
    if (!ALLOWED_ADAPTERS.has(key)) invalid(`Unknown adapter '${key}'`);
    const entry = asRecord(adapters[key], `'adapters.${key}' must be an object`);
    if (typeof entry['enabled'] !== 'boolean') {
      invalid(`'adapters.${key}.enabled' must be a boolean`);
    }
    if (Object.keys(entry).some((k) => k !== 'enabled')) {
      invalid(`'adapters.${key}' has unexpected fields`);
    }
  }

  const linkedRepos = s['linkedRepos'];
  if (!Array.isArray(linkedRepos)) invalid("'linkedRepos' must be an array");
  for (const repo of linkedRepos as unknown[]) {
    const entry = asRecord(repo, 'each linkedRepo must be an object');
    if (
      typeof entry['id'] !== 'string' ||
      typeof entry['name'] !== 'string' ||
      typeof entry['path'] !== 'string'
    ) {
      invalid("each linkedRepo needs string 'id', 'name' and 'path'");
    }
  }

  const ui = asRecord(s['ui'], "Missing or invalid 'ui'");
  if (!THEME_MODES.includes(ui['theme'] as ThemeMode)) {
    invalid(`'ui.theme' must be one of ${THEME_MODES.join(' | ')}`);
  }

  if (!LANGUAGE_PREFERENCES.includes(s['language'] as LanguagePreference)) {
    invalid(`'language' must be one of ${LANGUAGE_PREFERENCES.join(' | ')}`);
  }
}

export class SettingsService {
  constructor(private readonly repository: SettingsRepository) {}

  async load(): Promise<Settings | null> {
    const loaded = await this.repository.load();
    return loaded === null ? null : stripLegacyFields(loaded);
  }

  async save(settings: Settings): Promise<void> {
    assertValidSettings(settings);
    await this.repository.save(settings);
  }

  async merge(partial: DeepPartial<Settings>): Promise<Settings> {
    if (!isPlainObject(partial)) {
      throw new DomainError('validation', 'Settings patch must be an object');
    }
    const loaded = await this.repository.load();
    const current = loaded === null ? getDefaults() : stripLegacyFields(loaded);
    const next = deepMerge(current as unknown as Record<string, unknown>, partial as DeepPartial<Record<string, unknown>>) as unknown as Settings;
    assertValidSettings(next);
    await this.repository.save(next);
    return next;
  }

  getDefaults(): Settings {
    return getDefaults();
  }
}
