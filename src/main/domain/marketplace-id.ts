import type { Result } from './plugin-id.js';
import { MarketplaceIdInvalidError } from './customization-errors.js';
export { MarketplaceIdInvalidError };

export type MarketplaceId = string & { __brand: 'MarketplaceId' };

const MARKETPLACE_ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;

function reasonFor(raw: string): string {
  if (raw.length === 0) return 'cannot be empty';
  if (!/^[a-z]/.test(raw)) return 'must start with lowercase letter';
  if (raw.length > 64) return 'cannot exceed 64 characters';
  return 'can only contain lowercase letters, digits, and hyphens';
}

export function marketplaceId(raw: string): MarketplaceId {
  const result = tryMarketplaceId(raw);
  if (!result.ok) throw result.error;
  return result.value;
}

export function tryMarketplaceId(
  raw: string,
): Result<MarketplaceId, MarketplaceIdInvalidError> {
  if (typeof raw !== 'string') {
    return {
      ok: false,
      error: new MarketplaceIdInvalidError(
        `Invalid marketplace ID: expected string, got ${typeof raw}`,
        { raw: String(raw) },
      ),
    };
  }
  if (!MARKETPLACE_ID_PATTERN.test(raw)) {
    return {
      ok: false,
      error: new MarketplaceIdInvalidError(
        `Invalid marketplace ID: '${raw}' (${reasonFor(raw)})`,
        { raw },
      ),
    };
  }
  return { ok: true, value: raw as MarketplaceId };
}

export function isValidMarketplaceId(value: unknown): value is MarketplaceId {
  return typeof value === 'string' && MARKETPLACE_ID_PATTERN.test(value);
}
