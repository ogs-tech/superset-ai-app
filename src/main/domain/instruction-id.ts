import type { Result } from './plugin-id.js';
import { InstructionIdInvalidError } from './customization-errors.js';
export { InstructionIdInvalidError };

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
const RESERVED = new Set(['default']);

export type PersonalInstructionId = 'default' & { __brand: 'PersonalInstructionId' };
export type ProjectInstructionSlug = string & { __brand: 'ProjectInstructionSlug' };

export function personalInstructionId(raw: string): PersonalInstructionId {
  if (raw !== 'default') {
    throw new InstructionIdInvalidError(
      `Invalid personal instruction ID: '${raw}' (must be 'default')`,
      { raw },
    );
  }
  return raw as PersonalInstructionId;
}

export function tryPersonalInstructionId(
  raw: string,
): Result<PersonalInstructionId, InstructionIdInvalidError> {
  if (typeof raw !== 'string' || raw !== 'default') {
    return {
      ok: false,
      error: new InstructionIdInvalidError(
        `Invalid personal instruction ID: '${raw}' (must be 'default')`,
        { raw: String(raw) },
      ),
    };
  }
  return { ok: true, value: raw as PersonalInstructionId };
}

export function isPersonalInstructionId(value: unknown): value is PersonalInstructionId {
  return typeof value === 'string' && value === 'default';
}

export function projectInstructionSlug(raw: string): ProjectInstructionSlug {
  const result = tryProjectInstructionSlug(raw);
  if (!result.ok) throw result.error;
  return result.value;
}

export function tryProjectInstructionSlug(
  raw: string,
): Result<ProjectInstructionSlug, InstructionIdInvalidError> {
  if (typeof raw !== 'string') {
    return {
      ok: false,
      error: new InstructionIdInvalidError(
        `Invalid project instruction slug: expected string, got ${typeof raw}`,
        { raw: String(raw) },
      ),
    };
  }
  if (RESERVED.has(raw)) {
    return {
      ok: false,
      error: new InstructionIdInvalidError(
        `Invalid project instruction slug: '${raw}' is reserved for personal instruction`,
        { raw },
      ),
    };
  }
  if (!SLUG_RE.test(raw)) {
    return {
      ok: false,
      error: new InstructionIdInvalidError(
        `Invalid project instruction slug: '${raw}' (must match ${SLUG_RE.source})`,
        { raw },
      ),
    };
  }
  return { ok: true, value: raw as ProjectInstructionSlug };
}

export function isProjectInstructionSlug(value: unknown): value is ProjectInstructionSlug {
  return typeof value === 'string' && !RESERVED.has(value) && SLUG_RE.test(value);
}
