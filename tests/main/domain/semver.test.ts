import { describe, expect, it } from 'vitest';
import { compareSemVer, semVer, SemVerInvalidError, trySemVer } from '../../../src/main/domain/semver.js';

describe('semVer', () => {
  describe('valid versions', () => {
    it('parses basic version', () => {
      const result = semVer('1.2.3');
      expect(result).toBe('1.2.3');
    });

    it('parses version with pre-release', () => {
      const result = semVer('1.0.0-rc.1');
      expect(result).toBe('1.0.0-rc.1');
    });

    it('parses version with beta pre-release', () => {
      const result = semVer('2.0.0-beta.1');
      expect(result).toBe('2.0.0-beta.1');
    });

    it('parses version with alpha pre-release', () => {
      const result = semVer('0.0.1-alpha');
      expect(result).toBe('0.0.1-alpha');
    });

    it('parses zero version', () => {
      const result = semVer('0.0.0');
      expect(result).toBe('0.0.0');
    });

    it('parses version with complex pre-release', () => {
      const result = semVer('1.2.3-rc.1.alpha');
      expect(result).toBe('1.2.3-rc.1.alpha');
    });
  });

  describe('invalid versions', () => {
    it('throws for version with v prefix', () => {
      expect(() => semVer('v1')).toThrow(SemVerInvalidError);
    });

    it('throws for incomplete version (2 parts)', () => {
      expect(() => semVer('1.2')).toThrow(SemVerInvalidError);
    });

    it('throws for too many version parts', () => {
      expect(() => semVer('1.2.3.4')).toThrow(SemVerInvalidError);
    });

    it('throws for empty pre-release', () => {
      expect(() => semVer('1.2.3-')).toThrow(SemVerInvalidError);
    });

    it('throws for empty string', () => {
      expect(() => semVer('')).toThrow(SemVerInvalidError);
    });

    it('throws for non-numeric major', () => {
      expect(() => semVer('a.2.3')).toThrow(SemVerInvalidError);
    });

    it('throws for non-numeric minor', () => {
      expect(() => semVer('1.b.3')).toThrow(SemVerInvalidError);
    });

    it('throws for non-numeric patch', () => {
      expect(() => semVer('1.2.c')).toThrow(SemVerInvalidError);
    });
  });

  describe('error details', () => {
    it('includes raw input in error details', () => {
      try {
        semVer('invalid');
        expect.fail('should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SemVerInvalidError);
        if (error instanceof SemVerInvalidError) {
          expect(error.details?.raw).toBe('invalid');
        }
      }
    });

    it('has correct error name', () => {
      try {
        semVer('nope');
        expect.fail('should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SemVerInvalidError);
        if (error instanceof SemVerInvalidError) {
          expect(error.name).toBe('SemVerInvalidError');
        }
      }
    });
  });
});

describe('trySemVer', () => {
  describe('valid versions', () => {
    it('returns ok with value for valid version', () => {
      const result = trySemVer('1.2.3');
      expect(result).toEqual({ ok: true, value: '1.2.3' });
    });

    it('returns ok with value for version with pre-release', () => {
      const result = trySemVer('1.0.0-rc.1');
      expect(result).toEqual({ ok: true, value: '1.0.0-rc.1' });
    });
  });

  describe('invalid versions', () => {
    it('returns error for invalid version', () => {
      const result = trySemVer('v1');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(SemVerInvalidError);
      }
    });

    it('returns error for empty pre-release', () => {
      const result = trySemVer('1.2.3-');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(SemVerInvalidError);
      }
    });

    it('error contains raw input', () => {
      const result = trySemVer('invalid-input');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.details?.raw).toBe('invalid-input');
      }
    });
  });

  describe('never throws', () => {
    it('handles unexpected input gracefully', () => {
      expect(() => trySemVer('anything')).not.toThrow();
    });

    it('handles empty string gracefully', () => {
      expect(() => trySemVer('')).not.toThrow();
    });
  });
});

describe('compareSemVer', () => {
  describe('major version differences', () => {
    it('returns -1 when a.major < b.major', () => {
      const result = compareSemVer(semVer('1.0.0'), semVer('2.0.0'));
      expect(result).toBe(-1);
    });

    it('returns 1 when a.major > b.major', () => {
      const result = compareSemVer(semVer('2.0.0'), semVer('1.0.0'));
      expect(result).toBe(1);
    });
  });

  describe('minor version differences', () => {
    it('returns -1 when a.minor < b.minor (same major)', () => {
      const result = compareSemVer(semVer('1.0.0'), semVer('1.2.0'));
      expect(result).toBe(-1);
    });

    it('returns 1 when a.minor > b.minor (same major)', () => {
      const result = compareSemVer(semVer('1.2.0'), semVer('1.0.0'));
      expect(result).toBe(1);
    });
  });

  describe('patch version differences', () => {
    it('returns -1 when a.patch < b.patch (same major.minor)', () => {
      const result = compareSemVer(semVer('1.0.0'), semVer('1.0.5'));
      expect(result).toBe(-1);
    });

    it('returns 1 when a.patch > b.patch (same major.minor)', () => {
      const result = compareSemVer(semVer('1.0.5'), semVer('1.0.0'));
      expect(result).toBe(1);
    });
  });

  describe('equal versions', () => {
    it('returns 0 for identical versions', () => {
      const result = compareSemVer(semVer('1.0.0'), semVer('1.0.0'));
      expect(result).toBe(0);
    });

    it('returns 0 for identical versions with pre-release', () => {
      const result = compareSemVer(
        semVer('1.0.0-rc.1'),
        semVer('1.0.0-rc.1'),
      );
      expect(result).toBe(0);
    });
  });

  describe('pre-release handling', () => {
    it('returns -1 when a has pre-release and b does not (same base)', () => {
      const result = compareSemVer(semVer('1.0.0-rc.1'), semVer('1.0.0'));
      expect(result).toBe(-1);
    });

    it('returns 1 when a has no pre-release and b does (same base)', () => {
      const result = compareSemVer(semVer('1.0.0'), semVer('1.0.0-rc.1'));
      expect(result).toBe(1);
    });

    it('compares pre-releases lexicographically when base is same', () => {
      const result = compareSemVer(
        semVer('1.0.0-alpha'),
        semVer('1.0.0-beta'),
      );
      expect(result).toBe(-1);
    });

    it('compares rc vs alpha pre-releases', () => {
      const result = compareSemVer(
        semVer('1.0.0-alpha'),
        semVer('1.0.0-rc.1'),
      );
      expect(result).toBe(-1);
    });

    it('handles numeric pre-releases in order', () => {
      const result = compareSemVer(
        semVer('1.0.0-rc.1'),
        semVer('1.0.0-rc.2'),
      );
      expect(result).toBe(-1);
    });
  });

  describe('complex scenarios', () => {
    it('correctly orders multiple versions', () => {
      const v1 = semVer('2.0.0');
      const v2 = semVer('1.0.0');
      const v3 = semVer('1.0.0-rc.1');
      const v4 = semVer('1.0.1');

      expect(compareSemVer(v1, v2)).toBe(1); // 2.0.0 > 1.0.0
      expect(compareSemVer(v3, v2)).toBe(-1); // 1.0.0-rc.1 < 1.0.0
      expect(compareSemVer(v2, v4)).toBe(-1); // 1.0.0 < 1.0.1
    });
  });
});
