import type { FileSystemPort } from '../ports/filesystem-port.js';
import type { PluginManifest } from '../../domain/plugin-manifest.js';
import { ManifestInvalidError } from '../../domain/plugin-errors.js';
import { pluginManifestSchema } from '../schemas/plugin-manifest.schema.js';

export class PluginManifestParser {
  constructor(private readonly fs: FileSystemPort) {}

  async parse(pluginDir: string): Promise<PluginManifest> {
    const manifestPath = `${pluginDir}/.claude-plugin/plugin.json`;

    // Read file
    let content: string;
    try {
      content = await this.fs.readFile(manifestPath);
    } catch (err) {
      throw new ManifestInvalidError('Manifest not found', { path: manifestPath });
    }

    // Parse JSON
    let data: unknown;
    try {
      data = JSON.parse(content);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new ManifestInvalidError('Invalid JSON in manifest', { path: manifestPath, reason });
    }

    // Validate with schema
    const result = pluginManifestSchema.safeParse(data);
    if (!result.success) {
      throw new ManifestInvalidError('Invalid manifest schema', {
        path: manifestPath,
        reason: result.error.message,
      });
    }

    return result.data as PluginManifest;
  }
}
