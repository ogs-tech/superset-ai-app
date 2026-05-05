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
        [record.id]: { source: fromSource(record.source) },
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

function toSource(raw: unknown): MarketplaceSourceRecord {
  const obj = raw as {
    source?: string;
    path?: string;
    repo?: string;
    url?: string;
    ref?: string;
    cachePath?: string;
  };
  if (obj?.source === 'directory' && typeof obj.path === 'string') {
    return { kind: 'directory', path: obj.path };
  }
  if (obj?.source === 'github' && typeof obj.repo === 'string') {
    const out: { kind: 'github'; repo: string; cachePath?: string } = {
      kind: 'github',
      repo: obj.repo,
    };
    if (typeof obj.cachePath === 'string') out.cachePath = obj.cachePath;
    return out;
  }
  if (obj?.source === 'git' && typeof obj.url === 'string') {
    const out: { kind: 'git'; url: string; ref?: string; cachePath?: string } = {
      kind: 'git',
      url: obj.url,
    };
    if (typeof obj.ref === 'string') out.ref = obj.ref;
    if (typeof obj.cachePath === 'string') out.cachePath = obj.cachePath;
    return out;
  }
  if (obj?.source === 'url' && typeof obj.url === 'string') {
    const out: { kind: 'url'; url: string; cachePath?: string } = {
      kind: 'url',
      url: obj.url,
    };
    if (typeof obj.cachePath === 'string') out.cachePath = obj.cachePath;
    return out;
  }
  throw new Error(`Unsupported marketplace source: ${JSON.stringify(raw)}`);
}

type StoredSource =
  | { source: 'directory'; path: string }
  | { source: 'github'; repo: string; cachePath?: string }
  | { source: 'git'; url: string; ref?: string; cachePath?: string }
  | { source: 'url'; url: string; cachePath?: string };

function fromSource(source: MarketplaceSourceRecord): StoredSource {
  if (source.kind === 'directory') {
    return { source: 'directory', path: source.path };
  }
  if (source.kind === 'github') {
    return source.cachePath != null
      ? { source: 'github', repo: source.repo, cachePath: source.cachePath }
      : { source: 'github', repo: source.repo };
  }
  if (source.kind === 'git') {
    const out: { source: 'git'; url: string; ref?: string; cachePath?: string } = {
      source: 'git',
      url: source.url,
    };
    if (source.ref != null) out.ref = source.ref;
    if (source.cachePath != null) out.cachePath = source.cachePath;
    return out;
  }
  return source.cachePath != null
    ? { source: 'url', url: source.url, cachePath: source.cachePath }
    : { source: 'url', url: source.url };
}
