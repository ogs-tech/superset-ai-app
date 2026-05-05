import { describe, it, expect } from 'vitest';
import type { Skill, SkillSummary } from '../../../../src/main/application/schemas/skill.js';
import type { Agent, AgentSummary } from '../../../../src/main/application/schemas/agent.js';
import type { Reference, ReferenceSummary } from '../../../../src/main/application/schemas/reference.js';
import type {
  GlobalInstruction,
  GlobalInstructionSummary,
} from '../../../../src/main/application/schemas/global-instruction.js';
import { skillId } from '../../../../src/main/domain/skill-id.js';
import { agentId } from '../../../../src/main/domain/agent-id.js';
import { referenceId } from '../../../../src/main/domain/reference-id.js';
import { globalInstructionId } from '../../../../src/main/domain/global-instruction-id.js';
import { pluginId } from '../../../../src/main/domain/plugin-id.js';
import {
  WORKSPACE_SOURCE,
  pluginSource,
} from '../../../../src/main/domain/customization-source.js';

const isoNow = () => new Date().toISOString();

describe('Customization summary types', () => {
  it('SkillSummary builds with workspace source', () => {
    const s: SkillSummary = {
      id: skillId('foo'),
      source: WORKSPACE_SOURCE,
      frontmatter: {
        name: 'foo',
        type: 'skill',
        description: 'a skill',
        scopes: ['personal'],
        version: '1.0.0',
        createdAt: isoNow(),
        updatedAt: isoNow(),
      },
    };
    expect(s.id).toBe('foo');
    expect(s.source.kind).toBe('workspace');
  });

  it('Skill extends SkillSummary with body', () => {
    const skill: Skill = {
      id: skillId('foo'),
      source: pluginSource(pluginId('superpowers')),
      frontmatter: {
        name: 'foo',
        type: 'skill',
        description: 'a skill',
        scopes: ['personal'],
        version: '1.0.0',
        createdAt: isoNow(),
        updatedAt: isoNow(),
      },
      body: '# Skill body',
    };
    expect(skill.body).toBe('# Skill body');
    if (skill.source.kind === 'plugin') {
      expect(skill.source.pluginId).toBe('superpowers');
    }
  });

  it('AgentSummary and Agent build', () => {
    const summary: AgentSummary = {
      id: agentId('reviewer'),
      source: WORKSPACE_SOURCE,
      frontmatter: {
        name: 'reviewer',
        type: 'agent',
        description: 'reviewer agent',
        scopes: ['project'],
        version: '0.1.0',
        createdAt: isoNow(),
        updatedAt: isoNow(),
      },
    };
    const full: Agent = { ...summary, body: 'instructions' };
    expect(full.id).toBe('reviewer');
    expect(full.body).toBe('instructions');
  });

  it('ReferenceSummary and Reference build', () => {
    const summary: ReferenceSummary = {
      id: referenceId('style-guide'),
      source: WORKSPACE_SOURCE,
      frontmatter: {
        name: 'style-guide',
        type: 'reference',
        description: 'styling docs',
        scopes: ['project'],
        version: '1.0.0',
        createdAt: isoNow(),
        updatedAt: isoNow(),
      },
    };
    const full: Reference = { ...summary, body: 'reference body' };
    expect(full.id).toBe('style-guide');
  });

  it('GlobalInstructionSummary and GlobalInstruction build with default id', () => {
    const summary: GlobalInstructionSummary = {
      id: globalInstructionId('default'),
      source: WORKSPACE_SOURCE,
      frontmatter: {
        name: 'default',
        type: 'global-instruction',
        description: 'global rules',
        scopes: ['personal'],
        version: '1.0.0',
        createdAt: isoNow(),
        updatedAt: isoNow(),
      },
    };
    const full: GlobalInstruction = { ...summary, body: 'rules' };
    expect(full.id).toBe('default');
  });
});
