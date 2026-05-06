import type { Scope } from '../ports/scope.js';
import type { MarketplaceService } from './marketplace-service.js';

export const OFFICIAL_MARKETPLACE_REPO = 'anthropics/claude-plugins-official';
export const OFFICIAL_MARKETPLACE_URL = `https://github.com/${OFFICIAL_MARKETPLACE_REPO}`;

export interface MarketplaceSeederDeps {
  marketplaceService: Pick<MarketplaceService, 'list' | 'addFromUrl'>;
  log?: (level: 'info' | 'warn', message: string, error?: unknown) => void;
}

export class MarketplaceSeeder {
  constructor(private readonly deps: MarketplaceSeederDeps) {}

  async seedDefaultsIfMissing(scope: Scope): Promise<void> {
    const { marketplaceService } = this.deps;
    const log = this.deps.log ?? defaultLog;

    let existing;
    try {
      existing = await marketplaceService.list(scope);
    } catch (err) {
      log('warn', 'marketplace-seeder: failed to list marketplaces; skipping seed', err);
      return;
    }

    const alreadyPresent = existing.some((m) => isOfficialMarketplace(m.source));
    if (alreadyPresent) {
      return;
    }

    try {
      await marketplaceService.addFromUrl(scope, OFFICIAL_MARKETPLACE_URL);
      log('info', `marketplace-seeder: seeded ${OFFICIAL_MARKETPLACE_REPO}`);
    } catch (err) {
      log('warn', `marketplace-seeder: failed to seed ${OFFICIAL_MARKETPLACE_REPO}`, err);
    }
  }
}

export function isOfficialMarketplace(source: { kind: string; repo?: string; url?: string }): boolean {
  if (source.kind === 'github' && source.repo === OFFICIAL_MARKETPLACE_REPO) {
    return true;
  }
  if (source.kind === 'git' && typeof source.url === 'string') {
    return source.url.includes(OFFICIAL_MARKETPLACE_REPO);
  }
  return false;
}

function defaultLog(level: 'info' | 'warn', message: string, error?: unknown): void {
  if (level === 'warn') {
    console.warn(message, error ?? '');
  } else {
    console.log(message);
  }
}
