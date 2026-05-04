import type { Customization } from '../../../shared/customization.js';
import type { LinkedRepo } from '../../../shared/settings.js';

export interface AdapterDestination {
  scope: 'personal' | 'project';
  destination: string;
}

export interface Adapter {
  adapterId: string;
  resolveDestinations(args: {
    customization: Customization;
    linkedRepos: LinkedRepo[];
  }): Promise<AdapterDestination[]> | AdapterDestination[];
}
