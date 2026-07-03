import type { LinkedRepo } from '../../../shared/settings.js';
import type { Entity } from '../../../shared/entity.js';

export interface AdapterDestination {
  scope: 'personal' | 'project';
  destination: string;
}

export interface Adapter {
  adapterId: string;
  resolveEntityDestinations(args: {
    entity: Entity;
    linkedRepos: LinkedRepo[];
  }): Promise<AdapterDestination[]> | AdapterDestination[];
}
