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
    } catch {
      throw new ManifestInvalidError(
        'Plugin manifest not found — the repository must contain .claude-plugin/plugin.json at its root',
        { path: manifestPath },
      );
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

    // Claude Code auto-discovers artifacts from the directory layout — most
    // plugins (incl. all official ones) don't declare an `artifacts` block in
    // plugin.json. Merge filesystem-discovered artifacts with manifest-declared
    // ones (manifest wins where it provides values).
    const declared = result.data.artifacts;
    const discovered = await this.discoverArtifacts(pluginDir);

    const merged = {
      skills: declared.skills.length > 0 ? declared.skills : discovered.skills,
      agents: declared.agents.length > 0 ? declared.agents : discovered.agents,
      commands: declared.commands.length > 0 ? declared.commands : discovered.commands,
      hooks: declared.hooks > 0 ? declared.hooks : discovered.hooks,
      mcp: declared.mcp || discovered.mcp,
      lsp: declared.lsp || discovered.lsp,
    };

    return { ...result.data, artifacts: merged } as PluginManifest;
  }

  private async discoverArtifacts(pluginDir: string): Promise<PluginManifest['artifacts']> {
    const [skills, agents, commands, hooks, mcp] = await Promise.all([
      this.listSubdirectories(`${pluginDir}/skills`),
      this.listMarkdownNames(`${pluginDir}/agents`),
      this.listMarkdownNames(`${pluginDir}/commands`),
      this.countHookHandlers(pluginDir),
      this.fs.pathExists(`${pluginDir}/.mcp.json`),
    ]);

    return {
      skills,
      agents,
      commands,
      hooks,
      mcp,
      lsp: false,
    };
  }

  private async countHookHandlers(pluginDir: string): Promise<number> {
    for (const path of [`${pluginDir}/hooks/hooks.json`, `${pluginDir}/hooks.json`]) {
      if (!(await this.fs.pathExists(path))) continue;
      try {
        const raw = await this.fs.readFile(path);
        const parsed = JSON.parse(raw) as unknown;
        const root =
          typeof parsed === 'object' && parsed !== null && 'hooks' in parsed
            ? (parsed as { hooks: unknown }).hooks
            : parsed;
        if (typeof root !== 'object' || root === null) return 0;
        let total = 0;
        for (const blocks of Object.values(root as Record<string, unknown>)) {
          if (!Array.isArray(blocks)) continue;
          for (const block of blocks) {
            const handlers = (block as { hooks?: unknown }).hooks;
            if (Array.isArray(handlers)) total += handlers.length;
          }
        }
        return total;
      } catch {
        return 0;
      }
    }
    return 0;
  }

  private async listSubdirectories(dir: string): Promise<string[]> {
    if (!(await this.fs.pathExists(dir))) return [];
    const entries = await this.fs.readdir(dir);
    const dirs: string[] = [];
    await Promise.all(
      entries.map(async (name) => {
        const stat = await this.fs.lstat(`${dir}/${name}`);
        if (stat.kind === 'directory') dirs.push(name);
      }),
    );
    return dirs.sort();
  }

  private async listMarkdownNames(dir: string): Promise<string[]> {
    if (!(await this.fs.pathExists(dir))) return [];
    const entries = await this.fs.readdir(dir);
    return entries
      .filter((n) => n.endsWith('.md'))
      .map((n) => n.slice(0, -'.md'.length))
      .sort();
  }
}
