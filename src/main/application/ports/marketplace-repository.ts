import type { MarketplaceId } from '../../domain/marketplace-id.js';
import type { Scope } from './scope.js';

export interface MarketplaceSourceRecord {
  kind: 'directory';
  path: string;
}

export interface MarketplaceRecord {
  id: MarketplaceId;
  source: MarketplaceSourceRecord;
}

export interface MarketplaceRepository {
  list(scope: Scope): Promise<MarketplaceRecord[]>;
  get(scope: Scope, id: MarketplaceId): Promise<MarketplaceRecord | null>;
  add(scope: Scope, record: MarketplaceRecord): Promise<void>;
  remove(scope: Scope, id: MarketplaceId): Promise<void>;
}
