import { describe, expect, it } from 'vitest';
import { CopilotAdapter } from '../../../../../src/main/infrastructure/adapters/copilot-adapter.js';
import { DomainError } from '../../../../../src/main/domain/errors.js';

describe('CopilotAdapter — Adapter port contract (AC#8, AC#11)', () => {
  it('exposes adapterId === "copilot"', () => {
    const adapter = new CopilotAdapter({ homedir: '/home/user' });
    expect(adapter.adapterId).toBe('copilot');
  });

  it('exposes a resolveDestinations function', () => {
    const adapter = new CopilotAdapter({ homedir: '/home/user' });
    expect(typeof adapter.resolveDestinations).toBe('function');
  });

  it('throws DomainError(internal, missing-homedir) when homedir is undefined', () => {
    expect(
      () => new CopilotAdapter({ homedir: undefined as unknown as string }),
    ).toThrow(DomainError);
    try {
      new CopilotAdapter({ homedir: undefined as unknown as string });
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      const domainErr = err as DomainError;
      expect(domainErr.kind).toBe('internal');
      expect(domainErr.details).toMatchObject({ reason: 'missing-homedir' });
    }
  });

  it('throws DomainError(internal, missing-homedir) when homedir is null', () => {
    expect(() => new CopilotAdapter({ homedir: null as unknown as string })).toThrow(
      DomainError,
    );
  });

  it('throws DomainError(internal, missing-homedir) when homedir is an empty string', () => {
    expect(() => new CopilotAdapter({ homedir: '' })).toThrow(DomainError);
  });
});
