import type { MarketplaceId } from '../../domain/marketplace-id.js';
import type { Scope } from './scope.js';

export type MarketplaceSourceRecord =
  | { kind: 'directory'; path: string }
  | { kind: 'github'; repo: string; cachePath?: string }
  | { kind: 'git'; url: string; ref?: string; cachePath?: string }
  | { kind: 'url'; url: string; cachePath?: string };

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
