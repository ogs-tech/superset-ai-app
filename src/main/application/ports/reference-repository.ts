import type { Reference } from '../schemas/reference.js';
import type { ReferenceId } from '../../domain/reference-id.js';

export interface ReferenceRepository {
  list(): Promise<Reference[]>;
  get(query: { id: ReferenceId }): Promise<Reference>;
  save(command: { reference: Reference }): Promise<Reference>;
  delete(command: { id: ReferenceId }): Promise<void>;
  exists(query: { id: ReferenceId }): Promise<boolean>;
}
