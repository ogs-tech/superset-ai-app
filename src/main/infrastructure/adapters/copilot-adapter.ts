import { join } from 'node:path';
import type { Adapter, AdapterDestination } from '../../application/ports/adapter.js';
import type { Artifact } from '../../../shared/artifact.js';
import type { LinkedRepo } from '../../../shared/settings.js';
import { DomainError } from '../../domain/errors.js';

export interface CopilotAdapterDeps {
  homedir: string;
}

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
    const { type, name } = args.artifact.frontmatter;

    if (type === 'global-instruction' && name === 'copilot') {
      return [
        {
          scope: 'personal',
          destination: join(this.homedir, '.copilot/instructions/global.instructions.md'),
        },
      ];
    }

    return [];
  }
}
