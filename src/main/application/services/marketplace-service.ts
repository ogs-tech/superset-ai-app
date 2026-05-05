import type {
  MarketplaceRecord,
  MarketplaceRepository,
} from '../ports/marketplace-repository.js';
import type { Scope } from '../ports/scope.js';
import type { MarketplaceId } from '../../domain/marketplace-id.js';
import type { MarketplaceManifest } from '../../domain/marketplace-manifest.js';

export interface MarketplaceSummary extends MarketplaceRecord {
  manifest?: MarketplaceManifest;
}

export interface MarketplaceParserLike {
  parse(dir: string): Promise<MarketplaceManifest>;
}

export interface MarketplaceServiceDeps {
  repository: MarketplaceRepository;
  parser?: MarketplaceParserLike;
}

export class MarketplaceService {
  constructor(private readonly deps: MarketplaceServiceDeps) {}

  async list(scope: Scope): Promise<MarketplaceSummary[]> {
    const records = await this.deps.repository.list(scope);
    if (!this.deps.parser) {
      return records.map((r) => ({ ...r }));
    }
    const summaries: MarketplaceSummary[] = [];
    for (const record of records) {
      try {
        const manifest = await this.deps.parser.parse(record.source.path);
        summaries.push({ ...record, manifest });
      } catch {
        summaries.push({ ...record });
      }
    }
    return summaries;
  }

  async get(scope: Scope, id: MarketplaceId): Promise<MarketplaceSummary | null> {
    const record = await this.deps.repository.get(scope, id);
    if (!record) return null;
    if (!this.deps.parser) return { ...record };
    try {
      const manifest = await this.deps.parser.parse(record.source.path);
      return { ...record, manifest };
    } catch {
      return { ...record };
    }
  }

  async add(scope: Scope, record: MarketplaceRecord): Promise<void> {
    await this.deps.repository.add(scope, record);
  }

  async remove(scope: Scope, id: MarketplaceId): Promise<void> {
    await this.deps.repository.remove(scope, id);
  }

  async refresh(scope: Scope, id: MarketplaceId): Promise<MarketplaceSummary | null> {
    return this.get(scope, id);
  }
}
