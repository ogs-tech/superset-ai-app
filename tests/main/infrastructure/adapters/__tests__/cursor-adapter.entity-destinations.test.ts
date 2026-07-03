import { describe, it, expect } from 'vitest';
import { CursorAdapter } from '../../../../../src/main/infrastructure/adapters/cursor-adapter.js';
import {
  WORKSPACE_SOURCE,
  type Agent,
  type Instruction,
  type Skill,
} from '../../../../../src/shared/entity.js';
import type { LinkedRepo } from '../../../../../src/shared/settings.js';
import { GENERATED_FILE_MARKER } from '../../../../../src/main/application/entity/agents-file.js';

const meta = { version: '0.1.0', createdAt: '', updatedAt: '' };
const adapter = new CursorAdapter({ homedir: '/home/u' });

describe('CursorAdapter.resolveEntityDestinations', () => {
  it('routes a personal skill to ~/.cursor/skills/<name> (directory)', () => {
    const skill: Skill = { urn: 'urn:skill:demo', kind: 'skill', name: 'demo', description: 'd',
      scopes: ['personal'], metadata: meta, source: WORKSPACE_SOURCE, content: 'b' };
    expect(adapter.resolveEntityDestinations({ entity: skill, linkedRepos: [] })).toEqual([
      { scope: 'personal', destination: '/home/u/.cursor/skills/demo', strategy: 'symlink' },
    ]);
  });

  it('routes an explicit-only skill (slash-command) to the same skills directory', () => {
    const command: Skill = { urn: 'urn:skill:deploy', kind: 'skill', name: 'deploy', description: 'd',
      scopes: ['personal'], metadata: meta, source: WORKSPACE_SOURCE, content: 'b', explicitOnly: true };
    expect(adapter.resolveEntityDestinations({ entity: command, linkedRepos: [] })).toEqual([
      { scope: 'personal', destination: '/home/u/.cursor/skills/deploy', strategy: 'symlink' },
    ]);
  });

  it('fans a [personal, project] skill out to ~/.cursor and each linked repo', () => {
    const skill: Skill = { urn: 'urn:skill:multi', kind: 'skill', name: 'multi', description: 'd',
      scopes: ['personal', 'project'], metadata: meta, source: WORKSPACE_SOURCE, content: 'b' };
    const linkedRepos: LinkedRepo[] = [
      { id: 'r1', name: 'app', path: '/repos/app' },
      { id: 'r2', name: 'lib', path: '/repos/lib' },
    ];
    expect(adapter.resolveEntityDestinations({ entity: skill, linkedRepos })).toEqual([
      { scope: 'personal', destination: '/home/u/.cursor/skills/multi', strategy: 'symlink' },
      { scope: 'project', destination: '/repos/app/.cursor/skills/multi', strategy: 'symlink' },
      { scope: 'project', destination: '/repos/lib/.cursor/skills/multi', strategy: 'symlink' },
    ]);
  });

  it('routes a project-scoped agent to <repo>/.cursor/agents/<name>.md', () => {
    const agent: Agent = { urn: 'urn:agent:triage', kind: 'agent', name: 'triage', description: 'd',
      scopes: ['project'], metadata: meta, source: WORKSPACE_SOURCE, systemPrompt: 'b' };
    const linkedRepos: LinkedRepo[] = [{ id: 'r', name: 'app', path: '/repos/app' }];
    expect(adapter.resolveEntityDestinations({ entity: agent, linkedRepos })).toEqual([
      { scope: 'project', destination: '/repos/app/.cursor/agents/triage.md', strategy: 'symlink' },
    ]);
  });

  it('routes an instruction to a generated AGENTS.md in each linked repo', () => {
    const ins: Instruction = { urn: 'urn:instruction:default', kind: 'instruction', name: 'default',
      description: '', scopes: ['personal'], metadata: meta, source: WORKSPACE_SOURCE, content: 'Reply in pt-BR.', activation: 'always' };
    const linkedRepos: LinkedRepo[] = [
      { id: 'r1', name: 'app', path: '/repos/app' },
      { id: 'r2', name: 'lib', path: '/repos/lib' },
    ];
    const out = adapter.resolveEntityDestinations({ entity: ins, linkedRepos });
    expect(out).toEqual([
      { scope: 'project', destination: '/repos/app/AGENTS.md', strategy: 'write', content: `${GENERATED_FILE_MARKER}\n\nReply in pt-BR.\n` },
      { scope: 'project', destination: '/repos/lib/AGENTS.md', strategy: 'write', content: `${GENERATED_FILE_MARKER}\n\nReply in pt-BR.\n` },
    ]);
  });

  it('returns [] for an instruction when no repo is linked', () => {
    const ins: Instruction = { urn: 'urn:instruction:default', kind: 'instruction', name: 'default',
      description: '', scopes: ['personal'], metadata: meta, source: WORKSPACE_SOURCE, content: 'x', activation: 'always' };
    expect(adapter.resolveEntityDestinations({ entity: ins, linkedRepos: [] })).toEqual([]);
  });
});
