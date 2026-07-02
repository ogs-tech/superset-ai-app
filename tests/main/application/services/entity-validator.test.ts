import { describe, it, expect } from 'vitest';
import { EntityValidator } from '../../../../src/main/application/services/entity-validator.js';
import { WORKSPACE_SOURCE, type Skill, type Instruction } from '../../../../src/shared/entity.js';

const v = new EntityValidator();
const meta = { version: '0.1.0', createdAt: '', updatedAt: '' };

describe('EntityValidator', () => {
  it('accepts a valid skill', () => {
    const skill: Skill = { urn: 'urn:skill:demo', kind: 'skill', name: 'demo', description: 'd',
      scopes: ['personal'], metadata: meta, source: WORKSPACE_SOURCE, content: 'b' };
    expect(() => v.validate(skill)).not.toThrow();
  });

  it('rejects a bad slug', () => {
    const skill: Skill = { urn: 'urn:skill:Bad', kind: 'skill', name: 'Bad Name', description: 'd',
      scopes: ['personal'], metadata: meta, source: WORKSPACE_SOURCE, content: 'b' };
    expect(() => v.validate(skill)).toThrow();
  });

  it('enforces the instruction singleton (name=default, scopes=[personal])', () => {
    const bad: Instruction = { urn: 'urn:instruction:other', kind: 'instruction', name: 'other',
      description: '', scopes: ['personal'], metadata: meta, source: WORKSPACE_SOURCE, content: 'b', activation: 'always' };
    expect(() => v.validate(bad)).toThrow();
  });
});
