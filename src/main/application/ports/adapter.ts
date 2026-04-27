import type { Artifact } from '../../../shared/artifact.js';
import type { LinkedRepo } from '../../../shared/settings.js';

export interface AdapterDestination {
  scope: 'personal' | 'project';
  destination: string;
}

export interface Adapter {
  adapterId: string;
  resolveDestinations(args: {
    artifact: Artifact;
    linkedRepos: LinkedRepo[];
  }): AdapterDestination[];
}
