import type { FileSystemPort } from '../ports/filesystem-port.js';
import type { MarketplaceManifest } from '../../domain/marketplace-manifest.js';
import { marketplaceManifestSchema } from '../schemas/marketplace-manifest.schema.js';

export interface MarketplaceParserLike {
  parse(dir: string): Promise<MarketplaceManifest>;
}

export class MarketplaceParser implements MarketplaceParserLike {
  constructor(private readonly fs: FileSystemPort) {}

  async parse(pluginDir: string): Promise<MarketplaceManifest> {
    const candidates = [
      `${pluginDir}/.claude-plugin/marketplace.json`,
      `${pluginDir}/marketplace.json`,
    ];

    let content: string | undefined;
    for (const p of candidates) {
      try {
        content = await this.fs.readFile(p);
        break;
      } catch {
        // try next
      }
    }

    if (content == null) {
      throw new Error(`Marketplace manifest not found (tried: ${candidates.join(', ')})`);
    }

    let data: unknown;
    try {
      data = JSON.parse(content);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(`Invalid JSON in marketplace manifest: ${reason}`);
    }

    const result = marketplaceManifestSchema.safeParse(data);
    if (!result.success) {
      throw new Error(`Invalid marketplace manifest schema: ${result.error.message}`);
    }

    return result.data as MarketplaceManifest;
  }
}
