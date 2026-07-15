import { join } from 'node:path';
import type { Adapter, AdapterDestination } from '../../application/ports/adapter.js';
import type { Entity, Instruction, ProjectInstruction } from '../../../shared/entity.js';
import { DomainError } from '../../domain/errors.js';

export interface ClaudeAdapterDeps {
  homedir: string;
}

export class ClaudeAdapter implements Adapter {
  readonly adapterId = 'claude';
  private readonly homedir: string;

  constructor(deps: ClaudeAdapterDeps) {
    if (deps.homedir === undefined || deps.homedir === null || deps.homedir === '') {
      throw new DomainError(
        'internal',
        'ClaudeAdapter requires a non-empty homedir',
        { reason: 'missing-homedir' },
      );
    }
    this.homedir = deps.homedir;
  }

  resolveEntityDestinations(args: { entity: Entity }): AdapterDestination[] {
    const { kind, name, scopes } = args.entity;

    if (kind === 'instruction') {
      const instruction = args.entity as Instruction;
      if (instruction.scopes[0] === 'personal') {
        return [
          { scope: 'personal', destination: join(this.homedir, '.claude/CLAUDE.md'), strategy: 'symlink' },
          { scope: 'personal', destination: join(this.homedir, 'AGENTS.md'), strategy: 'symlink' },
        ];
      }
      const project = instruction as ProjectInstruction;
      return [
        { scope: 'project', destination: join(project.repoPath, '.claude/CLAUDE.md'), strategy: 'symlink' },
        { scope: 'project', destination: join(project.repoPath, 'AGENTS.md'), strategy: 'symlink' },
      ];
    }

    if (kind !== 'skill' && kind !== 'agent') {
      return [];
    }

    // TODO(follow-up): skill/agent scope 'project' is temporarily blocked at
    // the schema level while linkedRepos is removed. When we introduce a
    // per-entity repoPath for skill/agent, re-add project destinations here.
    const subfolder = kind === 'skill' ? '.claude/skills' : '.claude/agents';
    const fileName = kind === 'skill' ? name : `${name}.md`;
    const out: AdapterDestination[] = [];

    if (scopes.includes('personal')) {
      out.push({ scope: 'personal', destination: join(this.homedir, subfolder, fileName), strategy: 'symlink' });
    }
    return out;
  }
}
