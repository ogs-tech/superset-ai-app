import { describe, it, expect } from 'vitest';
import { SchemaValidator } from '../../../../../src/main/application/services/schema-validator.js';
import type { CustomizationFrontmatter } from '../../../../../src/shared/customization.js';

const validCommand: CustomizationFrontmatter = {
  name: 'feature-dev',
  type: 'command',
  description: 'A valid slash command description',
  scopes: ['personal'],
  version: '1.0.0',
  createdAt: '2026-05-03T00:00:00.000Z',
  updatedAt: '2026-05-03T00:00:00.000Z',
};

describe('SchemaValidator — command', () => {
  it('valid complete command frontmatter → ok: true', () => {
    const result = new SchemaValidator().validate(validCommand);
    expect(result.ok).toBe(true);
  });

  it('valid command with optional tags → ok: true', () => {
    const result = new SchemaValidator().validate({
      ...validCommand,
      tags: ['workflow', 'dev'],
    } as CustomizationFrontmatter);
    expect(result.ok).toBe(true);
  });

  it('passthrough preserves Claude Code-specific fields (argument-hint, allowed-tools, model)', () => {
    const withExtras = {
      ...validCommand,
      'argument-hint': '<feature description>',
      'allowed-tools': ['Read', 'Edit'],
      model: 'claude-opus-4-7',
    } as unknown as CustomizationFrontmatter;
    const result = new SchemaValidator().validate(withExtras);
    expect(result.ok).toBe(true);
  });
});
