import type { Entity, EntityKind } from '../../../shared/entity.js';

export interface EntityListQuery {
  kind?: EntityKind;
}

export interface EntityRepository {
  list(query?: EntityListQuery): Promise<Entity[]>;
  get(urn: string): Promise<Entity>;
  save(entity: Entity): Promise<Entity>;
  delete(urn: string): Promise<void>;
  exists(urn: string): Promise<boolean>;
}
