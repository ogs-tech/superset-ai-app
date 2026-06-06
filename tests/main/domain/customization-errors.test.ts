import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../src/main/domain/errors.js';
import {
  SkillIdInvalidError,
  AgentIdInvalidError,
  CommandIdInvalidError,
  HookIdInvalidError,
  GlobalInstructionIdInvalidError,
  MarketplaceIdInvalidError,
} from '../../../src/main/domain/customization-errors.js';

const CASES = [
  ['SkillIdInvalidError', SkillIdInvalidError],
  ['AgentIdInvalidError', AgentIdInvalidError],
  ['CommandIdInvalidError', CommandIdInvalidError],
  ['HookIdInvalidError', HookIdInvalidError],
  ['GlobalInstructionIdInvalidError', GlobalInstructionIdInvalidError],
  ['MarketplaceIdInvalidError', MarketplaceIdInvalidError],
] as const;

describe('customization id errors', () => {
  for (const [name, Ctor] of CASES) {
    it(`${name} is a validation DomainError carrying name + details`, () => {
      const details = { raw: 'Bad' };
      const err = new Ctor('bad id', details);
      expect(err).toBeInstanceOf(DomainError);
      expect(err).toBeInstanceOf(Error);
      expect(err.kind).toBe('validation');
      expect(err.name).toBe(name);
      expect(err.message).toBe('bad id');
      expect(err.details).toEqual(details);
    });

    it(`${name} has undefined details when not provided`, () => {
      const err = new Ctor('bad id');
      expect(err.details).toBeUndefined();
    });
  }
});
