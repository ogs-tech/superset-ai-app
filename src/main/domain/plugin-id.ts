export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export type PluginId = string & { __brand: 'PluginId' };

import { PluginIdInvalidError } from './plugin-errors.js';
export { PluginIdInvalidError };

const PLUGIN_ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;

/**
 * Create a PluginId from a string
 * Throws PluginIdInvalidError if validation fails
 */
export function pluginId(raw: string): PluginId {
  const result = tryPluginId(raw);
  if (!result.ok) {
    throw result.error;
  }
  return result.value;
}

/**
 * Try to create a PluginId from a string
 * Returns a Result type instead of throwing
 */
export function tryPluginId(raw: string): Result<PluginId, PluginIdInvalidError> {
  if (typeof raw !== 'string') {
    return {
      ok: false,
      error: new PluginIdInvalidError(`Invalid plugin ID: expected string, got ${typeof raw}`, {
        raw: String(raw),
      }),
    };
  }

  if (!PLUGIN_ID_PATTERN.test(raw)) {
    let reason = '';
    if (raw.length === 0) {
      reason = 'cannot be empty';
    } else if (!/^[a-z]/.test(raw)) {
      reason = 'must start with lowercase letter';
    } else if (raw.length > 64) {
      reason = 'cannot exceed 64 characters';
    } else if (!/^[a-z0-9-]*$/.test(raw)) {
      reason = 'can only contain lowercase letters, digits, and hyphens';
    }

    const message = `Invalid plugin ID: '${raw}' (${reason})`;
    return {
      ok: false,
      error: new PluginIdInvalidError(message, { raw }),
    };
  }

  return {
    ok: true,
    value: raw as PluginId,
  };
}

/**
 * Check if a string is a valid PluginId without throwing
 */
export function isValidPluginId(value: unknown): value is PluginId {
  if (typeof value !== 'string') {
    return false;
  }
  return PLUGIN_ID_PATTERN.test(value);
}
