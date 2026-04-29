import type { Adapter, AdapterDestination } from '../../ports/adapter.js';
import type { Artifact } from '../../../../shared/artifact.js';
import type { LinkedRepo } from '../../../../shared/settings.js';

export class FakeAdapter implements Adapter {
  constructor(
    public readonly adapterId: string,
    private readonly personalDestination: string,
    private readonly projectDestinationTemplate: (repoPath: string) => string = (repoPath) => `${repoPath}/.fake-adapter`,
  ) {}

  resolveDestinations(args: {
    artifact: Artifact;
    linkedRepos: LinkedRepo[];
  }): AdapterDestination[] {
    const { scopes } = args.artifact.frontmatter;
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
