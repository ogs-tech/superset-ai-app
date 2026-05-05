import type { Result } from './plugin-id.js';
import { CommandIdInvalidError } from './customization-errors.js';
export { CommandIdInvalidError };

export type CommandId = string & { __brand: 'CommandId' };

const COMMAND_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

function reasonFor(raw: string): string {
  if (raw.length === 0) return 'cannot be empty';
  if (raw.length > 64) return 'cannot exceed 64 characters';
  if (!/^[a-z0-9]/.test(raw)) return 'must start with lowercase letter or digit';
  if (!/[a-z0-9]$/.test(raw)) return 'cannot end with hyphen';
  return 'can only contain lowercase letters, digits, and hyphens';
}

export function commandId(raw: string): CommandId {
  const result = tryCommandId(raw);
  if (!result.ok) throw result.error;
  return result.value;
}

export function tryCommandId(raw: string): Result<CommandId, CommandIdInvalidError> {
  if (typeof raw !== 'string') {
    return {
      ok: false,
      error: new CommandIdInvalidError(
        `Invalid command ID: expected string, got ${typeof raw}`,
        { raw: String(raw) },
      ),
    };
  }
  if (!COMMAND_ID_PATTERN.test(raw)) {
    return {
      ok: false,
      error: new CommandIdInvalidError(`Invalid command ID: '${raw}' (${reasonFor(raw)})`, { raw }),
    };
  }
  return { ok: true, value: raw as CommandId };
}

export function isValidCommandId(value: unknown): value is CommandId {
  return typeof value === 'string' && COMMAND_ID_PATTERN.test(value);
}
