import type { Result } from './plugin-id.js';
import { HookIdInvalidError } from './customization-errors.js';
export { HookIdInvalidError };

export type HookId = string & { __brand: 'HookId' };

// Permissive on purpose: accepts both uuid v4 (workspace hooks) and synthetic
// plugin ids of the form `<plugin-id>:<EventName>:<index>`. Allows alnum,
// underscore, colon, hyphen; 1-128 chars; must start with alnum.
const HOOK_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_:-]{0,127}$/;

export function hookId(raw: string): HookId {
  const result = tryHookId(raw);
  if (!result.ok) throw result.error;
  return result.value;
}

export function tryHookId(raw: string): Result<HookId, HookIdInvalidError> {
  if (typeof raw !== 'string') {
    return {
      ok: false,
      error: new HookIdInvalidError(`Invalid hook ID: expected string, got ${typeof raw}`, {
        raw: String(raw),
      }),
    };
  }
  if (!HOOK_ID_PATTERN.test(raw)) {
    return {
      ok: false,
      error: new HookIdInvalidError(`Invalid hook ID: '${raw}'`, { raw }),
    };
  }
  return { ok: true, value: raw as HookId };
}

export function isValidHookId(value: unknown): value is HookId {
  return typeof value === 'string' && HOOK_ID_PATTERN.test(value);
}
