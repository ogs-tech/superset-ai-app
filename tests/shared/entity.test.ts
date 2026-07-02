import { describe, it, expect } from 'vitest';
import {
  entityUrn,
  parseUrn,
  isPluginSource,
  isWorkspaceSource,
  WORKSPACE_SOURCE,
  type Skill,
} from '../../src/shared/entity.js';

describe('entityUrn', () => {
  it('derives urn:{kind}:{name}', () => {
    expect(entityUrn('skill', 'code-review')).toBe('urn:skill:code-review');
    expect(entityUrn('instruction', 'default')).toBe('urn:instruction:default');
  });
});

describe('parseUrn', () => {
  it('round-trips a urn back to kind + name', () => {
    expect(parseUrn('urn:mcp:figma')).toEqual({ kind: 'mcp', name: 'figma' });
  });

  it('keeps colons that appear in the name segment', () => {
    expect(parseUrn('urn:hook:pre:commit')).toEqual({ kind: 'hook', name: 'pre:commit' });
  });

  it('throws on a malformed urn', () => {
    expect(() => parseUrn('not-a-urn')).toThrow(/Invalid URN/);
  });
});

describe('source guards', () => {
  it('classifies workspace and plugin sources', () => {
    expect(isWorkspaceSource(WORKSPACE_SOURCE)).toBe(true);
    expect(isPluginSource({ kind: 'plugin', pluginId: 'p', provenance: 'workspace-managed' })).toBe(true);
  });
});

describe('Skill type', () => {
  it('is assignable with the canonical shape', () => {
    const skill: Skill = {
      urn: 'urn:skill:demo',
      kind: 'skill',
      name: 'demo',
      description: 'a demo skill',
      scopes: ['personal'],
      metadata: { version: '0.1.0', createdAt: '', updatedAt: '' },
      source: WORKSPACE_SOURCE,
      content: '# Demo\n',
    };
    expect(skill.kind).toBe('skill');
  });
});
