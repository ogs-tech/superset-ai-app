import type { Result } from './plugin-id.js';
import { SkillIdInvalidError } from './customization-errors.js';
export { SkillIdInvalidError };

export type SkillId = string & { __brand: 'SkillId' };

const SKILL_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

function reasonFor(raw: string): string {
  if (raw.length === 0) return 'cannot be empty';
  if (raw.length > 64) return 'cannot exceed 64 characters';
  if (!/^[a-z0-9]/.test(raw)) return 'must start with lowercase letter or digit';
  if (!/[a-z0-9]$/.test(raw)) return 'cannot end with hyphen';
  return 'can only contain lowercase letters, digits, and hyphens';
}

export function skillId(raw: string): SkillId {
  const result = trySkillId(raw);
  if (!result.ok) throw result.error;
  return result.value;
}

export function trySkillId(raw: string): Result<SkillId, SkillIdInvalidError> {
  if (typeof raw !== 'string') {
    return {
      ok: false,
      error: new SkillIdInvalidError(`Invalid skill ID: expected string, got ${typeof raw}`, {
        raw: String(raw),
      }),
    };
  }
  if (!SKILL_ID_PATTERN.test(raw)) {
    return {
      ok: false,
      error: new SkillIdInvalidError(`Invalid skill ID: '${raw}' (${reasonFor(raw)})`, { raw }),
    };
  }
  return { ok: true, value: raw as SkillId };
}

export function isValidSkillId(value: unknown): value is SkillId {
  return typeof value === 'string' && SKILL_ID_PATTERN.test(value);
}
