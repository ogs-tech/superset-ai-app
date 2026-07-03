import type { LinkedRepo } from '../../../shared/settings.js';
import type { Entity } from '../../../shared/entity.js';

export type AdapterDestination =
  | { scope: 'personal' | 'project'; destination: string; strategy: 'symlink' }
  | { scope: 'personal' | 'project'; destination: string; strategy: 'write'; content: string };

export interface Adapter {
  adapterId: string;
  resolveEntityDestinations(args: {
    entity: Entity;
    linkedRepos: LinkedRepo[];
  }): Promise<AdapterDestination[]> | AdapterDestination[];
}
