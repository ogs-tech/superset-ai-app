import { describe, expect, it, vi } from 'vitest';
import { CopilotAdapter } from '../../../../../src/main/infrastructure/adapters/copilot-adapter.js';
import { DomainError } from '../../../../../src/main/domain/errors.js';
import type { CopilotInstructionsGenPort } from '../../../../../src/main/application/ports/copilot-instructions-gen.js';

const makeGen = (): CopilotInstructionsGenPort => ({
  generate: vi.fn().mockResolvedValue({ path: '/w/_generated/copilot-instructions.md', refsIncluded: 0 }),
});

describe('CopilotAdapter — Adapter port contract (AC#8, AC#11)', () => {
  it('exposes adapterId === "copilot"', () => {
    const adapter = new CopilotAdapter({ homedir: '/home/user', workspacePath: '/w', copilotInstructionsGen: makeGen() });
    expect(adapter.adapterId).toBe('copilot');
  });

  it('exposes a resolveDestinations function', () => {
    const adapter = new CopilotAdapter({ homedir: '/home/user', workspacePath: '/w', copilotInstructionsGen: makeGen() });
    expect(typeof adapter.resolveDestinations).toBe('function');
  });

  it('throws DomainError(internal, missing-homedir) when homedir is undefined', () => {
    expect(
      () => new CopilotAdapter({ homedir: undefined as unknown as string, workspacePath: '/w', copilotInstructionsGen: makeGen() }),
    ).toThrow(DomainError);
    try {
      new CopilotAdapter({ homedir: undefined as unknown as string, workspacePath: '/w', copilotInstructionsGen: makeGen() });
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      const domainErr = err as DomainError;
      expect(domainErr.kind).toBe('internal');
      expect(domainErr.details).toMatchObject({ reason: 'missing-homedir' });
    }
  });

  it('throws DomainError(internal, missing-homedir) when homedir is null', () => {
    expect(() => new CopilotAdapter({ homedir: null as unknown as string, workspacePath: '/w', copilotInstructionsGen: makeGen() })).toThrow(
      DomainError,
    );
  });

  it('throws DomainError(internal, missing-homedir) when homedir is an empty string', () => {
    expect(() => new CopilotAdapter({ homedir: '', workspacePath: '/w', copilotInstructionsGen: makeGen() })).toThrow(DomainError);
  });
});
