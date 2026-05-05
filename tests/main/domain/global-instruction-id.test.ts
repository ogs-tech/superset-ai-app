import { describe, it, expect } from 'vitest';
import {
  globalInstructionId,
  tryGlobalInstructionId,
  isValidGlobalInstructionId,
  GlobalInstructionIdInvalidError,
} from '../../../src/main/domain/global-instruction-id.js';

describe('GlobalInstructionId', () => {
  describe('globalInstructionId()', () => {
    it('accepts "default"', () => {
      expect(globalInstructionId('default')).toBe('default');
    });

    it('rejects any other slug', () => {
      ['foo', '', 'Default', 'main', 'global'].forEach((id) =>
        expect(() => globalInstructionId(id)).toThrow(GlobalInstructionIdInvalidError),
      );
    });

    it('error message lists allowed slugs', () => {
      expect(() => globalInstructionId('other')).toThrow(/must be one of: default/);
    });
  });

  describe('tryGlobalInstructionId()', () => {
    it('returns ok for "default"', () => {
      const r = tryGlobalInstructionId('default');
      expect(r.ok).toBe(true);
    });

    it('returns error for non-allowed slugs', () => {
      const r = tryGlobalInstructionId('other');
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toBeInstanceOf(GlobalInstructionIdInvalidError);
    });

    it('never throws', () => {
      expect(() => tryGlobalInstructionId('foo')).not.toThrow();
    });
  });

  describe('isValidGlobalInstructionId()', () => {
    it('returns true only for "default"', () => {
      expect(isValidGlobalInstructionId('default')).toBe(true);
      expect(isValidGlobalInstructionId('other')).toBe(false);
      expect(isValidGlobalInstructionId(null)).toBe(false);
    });
  });
});
