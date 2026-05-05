import type { Result } from './plugin-id.js';
import { ReferenceIdInvalidError } from './customization-errors.js';
export { ReferenceIdInvalidError };

export type ReferenceId = string & { __brand: 'ReferenceId' };

const REFERENCE_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

function reasonFor(raw: string): string {
  if (raw.length === 0) return 'cannot be empty';
  if (raw.length > 64) return 'cannot exceed 64 characters';
  if (!/^[a-z0-9]/.test(raw)) return 'must start with lowercase letter or digit';
  if (!/[a-z0-9]$/.test(raw)) return 'cannot end with hyphen';
  return 'can only contain lowercase letters, digits, and hyphens';
}

export function referenceId(raw: string): ReferenceId {
  const result = tryReferenceId(raw);
  if (!result.ok) throw result.error;
  return result.value;
}

export function tryReferenceId(raw: string): Result<ReferenceId, ReferenceIdInvalidError> {
  if (typeof raw !== 'string') {
    return {
      ok: false,
      error: new ReferenceIdInvalidError(
        `Invalid reference ID: expected string, got ${typeof raw}`,
        { raw: String(raw) },
      ),
    };
  }
  if (!REFERENCE_ID_PATTERN.test(raw)) {
    return {
      ok: false,
      error: new ReferenceIdInvalidError(
        `Invalid reference ID: '${raw}' (${reasonFor(raw)})`,
        { raw },
      ),
    };
  }
  return { ok: true, value: raw as ReferenceId };
}

export function isValidReferenceId(value: unknown): value is ReferenceId {
  return typeof value === 'string' && REFERENCE_ID_PATTERN.test(value);
}
