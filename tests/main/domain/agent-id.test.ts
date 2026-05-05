import { describe, it, expect } from 'vitest';
import {
  agentId,
  tryAgentId,
  isValidAgentId,
  AgentIdInvalidError,
} from '../../../src/main/domain/agent-id.js';

describe('AgentId', () => {
  describe('agentId()', () => {
    it('accepts valid IDs', () => {
      ['foo', 'a', 'reviewer', 'code-checker', '1agent'].forEach((id) =>
        expect(agentId(id)).toBe(id),
      );
    });

    it('rejects empty string', () => {
      expect(() => agentId('')).toThrow(AgentIdInvalidError);
    });

    it('rejects uppercase', () => {
      expect(() => agentId('Foo')).toThrow(AgentIdInvalidError);
    });

    it('rejects trailing hyphen', () => {
      expect(() => agentId('foo-')).toThrow(AgentIdInvalidError);
    });

    it('rejects strings longer than 64 chars', () => {
      const id65 = 'a' + 'b'.repeat(64);
      expect(() => agentId(id65)).toThrow(AgentIdInvalidError);
    });
  });

  describe('tryAgentId()', () => {
    it('returns ok for valid IDs', () => {
      const r = tryAgentId('reviewer');
      expect(r.ok).toBe(true);
    });

    it('returns error for invalid', () => {
      const r = tryAgentId('Bad');
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toBeInstanceOf(AgentIdInvalidError);
    });

    it('never throws', () => {
      expect(() => tryAgentId('')).not.toThrow();
    });
  });

  describe('isValidAgentId()', () => {
    it('discriminates valid/invalid', () => {
      expect(isValidAgentId('foo')).toBe(true);
      expect(isValidAgentId('Foo')).toBe(false);
      expect(isValidAgentId(null)).toBe(false);
    });
  });
});
