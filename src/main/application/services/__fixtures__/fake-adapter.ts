import type { Adapter, AdapterDestination } from '../../ports/adapter.js';
import type { Entity } from '../../../../shared/entity.js';
import type { LinkedRepo } from '../../../../shared/settings.js';

export class FakeAdapter implements Adapter {
  constructor(
    public readonly adapterId: string,
    private readonly personalDestination: string,
    private readonly projectDestinationTemplate: (repoPath: string) => string = (repoPath) => `${repoPath}/.fake-adapter`,
  ) {}

  resolveEntityDestinations(args: {
    entity: Entity;
    linkedRepos: LinkedRepo[];
  }): AdapterDestination[] {
    const { scopes } = args.entity;
    const out: AdapterDestination[] = [];

    if (scopes.includes('personal')) {
      out.push({ scope: 'personal', destination: this.personalDestination });
    }

    if (scopes.includes('project')) {
      for (const repo of args.linkedRepos) {
        out.push({
          scope: 'project',
          destination: this.projectDestinationTemplate(repo.path),
        });
      }
    }

    return out;
  }
}
