import { describe, it, expect } from 'vitest';
import {
  marketplaceId,
  tryMarketplaceId,
  isValidMarketplaceId,
  MarketplaceIdInvalidError,
} from '../../../src/main/domain/marketplace-id.js';

describe('MarketplaceId', () => {
  describe('marketplaceId()', () => {
    it('accepts valid IDs', () => {
      ['claude-plugins-official', 'company-tools', 'a', 'a-b-c'].forEach((id) =>
        expect(marketplaceId(id)).toBe(id),
      );
    });

    it('rejects empty', () => {
      expect(() => marketplaceId('')).toThrow(MarketplaceIdInvalidError);
      expect(() => marketplaceId('')).toThrow(/cannot be empty/);
    });

    it('rejects starting with digit', () => {
      expect(() => marketplaceId('1foo')).toThrow(MarketplaceIdInvalidError);
      expect(() => marketplaceId('1foo')).toThrow(/must start with lowercase letter/);
    });

    it('rejects uppercase', () => {
      expect(() => marketplaceId('Foo')).toThrow(MarketplaceIdInvalidError);
    });

    it('rejects underscore', () => {
      expect(() => marketplaceId('a_b')).toThrow(MarketplaceIdInvalidError);
    });

    it('accepts a 64-character valid string', () => {
      const id64 = 'a' + 'b'.repeat(63);
      expect(marketplaceId(id64)).toBe(id64);
    });

    it('rejects strings longer than 64 chars', () => {
      const id65 = 'a' + 'b'.repeat(64);
      expect(() => marketplaceId(id65)).toThrow(MarketplaceIdInvalidError);
    });
  });

  describe('tryMarketplaceId()', () => {
    it('returns ok for valid IDs', () => {
      expect(tryMarketplaceId('claude-plugins-official').ok).toBe(true);
    });

    it('returns error for invalid', () => {
      const r = tryMarketplaceId('1bad');
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toBeInstanceOf(MarketplaceIdInvalidError);
    });

    it('never throws', () => {
      expect(() => tryMarketplaceId('')).not.toThrow();
    });
  });

  describe('isValidMarketplaceId()', () => {
    it('discriminates valid/invalid', () => {
      expect(isValidMarketplaceId('foo')).toBe(true);
      expect(isValidMarketplaceId('Foo')).toBe(false);
      expect(isValidMarketplaceId('1foo')).toBe(false);
      expect(isValidMarketplaceId(null)).toBe(false);
    });
  });
});
