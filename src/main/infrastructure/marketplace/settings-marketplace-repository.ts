import type { ClaudeSettingsPort } from '../../application/ports/claude-settings-port.js';
import type {
  MarketplaceRecord,
  MarketplaceRepository,
  MarketplaceSourceRecord,
} from '../../application/ports/marketplace-repository.js';
import type { Scope } from '../../application/ports/scope.js';
import { marketplaceId, type MarketplaceId } from '../../domain/marketplace-id.js';

export class SettingsMarketplaceRepository implements MarketplaceRepository {
  constructor(private readonly settings: ClaudeSettingsPort) {}

  async list(scope: Scope): Promise<MarketplaceRecord[]> {
    const s = await this.settings.read(scope);
    return Object.entries(s.extraKnownMarketplaces).map(([id, entry]) => ({
      id: marketplaceId(id),
      source: toSource(entry.source),
    }));
  }

  async get(scope: Scope, id: MarketplaceId): Promise<MarketplaceRecord | null> {
    const s = await this.settings.read(scope);
    const entry = s.extraKnownMarketplaces[id];
    if (entry == null) return null;
    return { id, source: toSource(entry.source) };
  }

  async add(scope: Scope, record: MarketplaceRecord): Promise<void> {
    await this.settings.mutate(scope, (s) => ({
      ...s,
      extraKnownMarketplaces: {
        ...s.extraKnownMarketplaces,
        [record.id]: { source: { source: 'directory', path: record.source.path } },
      },
    }));
  }

  async remove(scope: Scope, id: MarketplaceId): Promise<void> {
    await this.settings.mutate(scope, (s) => {
      const next = { ...s.extraKnownMarketplaces };
      delete next[id];
      return { ...s, extraKnownMarketplaces: next };
    });
  }
}

function toSource(raw: { source: string; path?: string } | unknown): MarketplaceSourceRecord {
  const obj = raw as { source?: string; path?: string };
  if (obj?.source !== 'directory' || typeof obj.path !== 'string') {
    throw new Error(`Unsupported marketplace source: ${JSON.stringify(raw)}`);
  }
  return { kind: 'directory', path: obj.path };
}
