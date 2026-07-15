import { describe, it, expect } from 'vitest';
import {
  personalInstructionId,
  tryPersonalInstructionId,
  isPersonalInstructionId,
  projectInstructionSlug,
  tryProjectInstructionSlug,
  isProjectInstructionSlug,
  InstructionIdInvalidError,
} from '../../../src/main/domain/instruction-id.js';

describe('PersonalInstructionId', () => {
  describe('personalInstructionId()', () => {
    it('accepts "default"', () => {
      expect(personalInstructionId('default')).toBe('default');
    });

    it('rejects any other slug', () => {
      ['foo', '', 'Default', 'main', 'global'].forEach((id) =>
        expect(() => personalInstructionId(id)).toThrow(InstructionIdInvalidError),
      );
    });

    it("error message mentions 'default'", () => {
      expect(() => personalInstructionId('other')).toThrow(/must be 'default'/);
    });
  });

  describe('tryPersonalInstructionId()', () => {
    it('returns ok for "default"', () => {
      const r = tryPersonalInstructionId('default');
      expect(r.ok).toBe(true);
    });

    it('returns error for non-allowed slugs', () => {
      const r = tryPersonalInstructionId('other');
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toBeInstanceOf(InstructionIdInvalidError);
    });

    it('never throws', () => {
      expect(() => tryPersonalInstructionId('foo')).not.toThrow();
    });
  });

  describe('isPersonalInstructionId()', () => {
    it('returns true only for "default"', () => {
      expect(isPersonalInstructionId('default')).toBe(true);
      expect(isPersonalInstructionId('other')).toBe(false);
      expect(isPersonalInstructionId(null)).toBe(false);
    });
  });
});

describe('ProjectInstructionSlug', () => {
  describe('projectInstructionSlug()', () => {
    it('accepts slug-shaped names', () => {
      expect(projectInstructionSlug('my-app')).toBe('my-app');
      expect(projectInstructionSlug('acme-2026')).toBe('acme-2026');
    });

    it('rejects the reserved slug "default"', () => {
      expect(() => projectInstructionSlug('default')).toThrow(/reserved/);
    });

    it('rejects invalid slug shapes', () => {
      ['', 'Bad', '-leading', 'has space', 'UPPER'].forEach((id) =>
        expect(() => projectInstructionSlug(id)).toThrow(InstructionIdInvalidError),
      );
    });
  });

  describe('tryProjectInstructionSlug()', () => {
    it('returns ok for valid slugs', () => {
      expect(tryProjectInstructionSlug('foo').ok).toBe(true);
    });

    it('returns error for reserved and invalid', () => {
      expect(tryProjectInstructionSlug('default').ok).toBe(false);
      expect(tryProjectInstructionSlug('Bad').ok).toBe(false);
    });

    it('never throws', () => {
      expect(() => tryProjectInstructionSlug('anything')).not.toThrow();
    });
  });

  describe('isProjectInstructionSlug()', () => {
    it('accepts non-reserved slug-shaped strings', () => {
      expect(isProjectInstructionSlug('my-app')).toBe(true);
      expect(isProjectInstructionSlug('default')).toBe(false);
      expect(isProjectInstructionSlug('UPPER')).toBe(false);
      expect(isProjectInstructionSlug(42)).toBe(false);
    });
  });
});
