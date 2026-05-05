import type { Result } from './plugin-id.js';
import { GlobalInstructionIdInvalidError } from './customization-errors.js';
export { GlobalInstructionIdInvalidError };

const ALLOWED_SLUGS = ['default'] as const;

export type GlobalInstructionId = (typeof ALLOWED_SLUGS)[number] & {
  __brand: 'GlobalInstructionId';
};

export function globalInstructionId(raw: string): GlobalInstructionId {
  const result = tryGlobalInstructionId(raw);
  if (!result.ok) throw result.error;
  return result.value;
}

export function tryGlobalInstructionId(
  raw: string,
): Result<GlobalInstructionId, GlobalInstructionIdInvalidError> {
  if (typeof raw !== 'string') {
    return {
      ok: false,
      error: new GlobalInstructionIdInvalidError(
        `Invalid global-instruction ID: expected string, got ${typeof raw}`,
        { raw: String(raw) },
      ),
    };
  }
  if (!isAllowed(raw)) {
    return {
      ok: false,
      error: new GlobalInstructionIdInvalidError(
        `Invalid global-instruction ID: '${raw}' (must be one of: ${ALLOWED_SLUGS.join(', ')})`,
        { raw },
      ),
    };
  }
  return { ok: true, value: raw as GlobalInstructionId };
}

export function isValidGlobalInstructionId(value: unknown): value is GlobalInstructionId {
  return typeof value === 'string' && isAllowed(value);
}

function isAllowed(value: string): value is (typeof ALLOWED_SLUGS)[number] {
  return (ALLOWED_SLUGS as readonly string[]).includes(value);
}
