import type { Scope } from '../ports/scope.js';
import type { MarketplaceService } from './marketplace-service.js';

export const OFFICIAL_MARKETPLACE_REPO = 'anthropics/claude-plugins-official';
export const OFFICIAL_MARKETPLACE_URL = `https://github.com/${OFFICIAL_MARKETPLACE_REPO}`;

export interface MarketplaceSeederDeps {
  marketplaceService: Pick<MarketplaceService, 'list' | 'addFromUrl' | 'refresh'>;
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

    const official = existing.find((m) => isOfficialMarketplace(m.source));
    if (official) {
      // Registered, but if its manifest didn't load the clone cache is gone or
      // unreadable (e.g. a factory reset wiped the workspace yet left the
      // settings registration). Re-clone so the starter pack can list plugins
      // again instead of falling back to the empty state.
      if (official.manifest == null) {
        try {
          await marketplaceService.refresh(scope, official.id);
          log('info', `marketplace-seeder: repaired cache for ${OFFICIAL_MARKETPLACE_REPO}`);
        } catch (err) {
          log('warn', `marketplace-seeder: failed to repair ${OFFICIAL_MARKETPLACE_REPO}`, err);
        }
      }
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
