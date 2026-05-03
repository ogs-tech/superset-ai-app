import { join } from 'node:path';
import type { Adapter, AdapterDestination } from '../../application/ports/adapter.js';
import type { Artifact } from '../../../shared/artifact.js';
import type { LinkedRepo } from '../../../shared/settings.js';
import { DomainError } from '../../domain/errors.js';

export interface CopilotAdapterDeps {
  homedir: string;
}

const PERSONAL_SUBFOLDER: Record<'skill' | 'agent', string> = {
  skill: '.copilot/skills',
  agent: '.copilot/agents',
};

const PROJECT_SUBFOLDER: Record<'skill' | 'agent', string> = {
  skill: '.github/skills',
  agent: '.github/agents',
};

export class CopilotAdapter implements Adapter {
  readonly adapterId = 'copilot';
  private readonly homedir: string;

  constructor(deps: CopilotAdapterDeps) {
    if (deps.homedir === undefined || deps.homedir === null || deps.homedir === '') {
      throw new DomainError(
        'internal',
        'CopilotAdapter requires a non-empty homedir',
        { reason: 'missing-homedir' },
      );
    }
    this.homedir = deps.homedir;
  }

  resolveDestinations(args: {
    artifact: Artifact;
    linkedRepos: LinkedRepo[];
  }): AdapterDestination[] {
    const { type, scopes, name } = args.artifact.frontmatter;

    if (type === 'global-instruction' && name === 'copilot') {
      return [
        {
          scope: 'personal',
          destination: join(this.homedir, '.copilot/instructions/global.instructions.md'),
        },
      ];
    }

    if (type === 'reference') {
      return [];
    }

    if (type !== 'skill' && type !== 'agent') {
      return [];
    }

    const fileName = type === 'skill' ? name : `${name}.agent.md`;
    const out: AdapterDestination[] = [];

    if (scopes.includes('personal')) {
      out.push({
        scope: 'personal',
        destination: join(this.homedir, PERSONAL_SUBFOLDER[type], fileName),
      });
    }

    if (scopes.includes('project')) {
      for (const repo of args.linkedRepos) {
        out.push({
          scope: 'project',
          destination: join(repo.path, PROJECT_SUBFOLDER[type], fileName),
        });
      }
    }

    return out;
  }
}
