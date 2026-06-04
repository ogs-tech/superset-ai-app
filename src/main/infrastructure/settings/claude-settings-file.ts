import fs from 'node:fs/promises';
import path from 'node:path';
import lockfile from 'proper-lockfile';
import type { ClaudeSettingsPort } from '../../application/ports/claude-settings-port.js';
import type { Scope } from '../../application/ports/scope.js';
import type { PluginId } from '../../domain/plugin-id.js';
import type { ClaudeSettings } from '../../application/schemas/claude-settings.schema.js';
import { claudeSettingsSchema } from '../../application/schemas/claude-settings.schema.js';
import { SettingsLockTimeoutError } from '../../domain/plugin-errors.js';

export class ClaudeSettingsFile implements ClaudeSettingsPort {
  constructor(
    private readonly config: {
      // Returns the path to settings.json for the given scope
      // personal → ~/.claude/settings.json
      // project → <cwd>/.claude/settings.json
      settingsPath(scope: Scope): string;
      // Returns the path to the symlink target dir for the given scope
      // personal → ~/.claude/plugins/cache/local/<id>
      // project → <cwd>/.claude/plugins/cache/local/<id>
      symlinkPath(scope: Scope, id: PluginId): string;
    },
  ) {}

  async mutate(scope: Scope, mutator: (s: ClaudeSettings) => ClaudeSettings): Promise<void> {
    const filePath = this.config.settingsPath(scope);
    // Ensure the file exists (create empty if needed) before locking
    await this.ensureFile(filePath);

    let release: (() => Promise<void>) | undefined;
    try {
      release = await lockfile.lock(filePath, {
        retries: { retries: 5, minTimeout: 100 },
        stale: 10000,
      });
    } catch {
      throw new SettingsLockTimeoutError(`Could not acquire lock on ${filePath}`, {
        path: filePath,
      });
    }

    try {
      const raw = await fs.readFile(filePath, 'utf8').catch(() => '{}');
      const json = JSON.parse(raw) as unknown;
      const settings = claudeSettingsSchema.parse(json);

      // Backup
      await fs.writeFile(filePath + '.bak', raw, 'utf8');

      // Apply mutator
      const updated = mutator(settings);

      // Atomic write: write to tmp + rename
      const tmpPath = filePath + '.tmp';
      await fs.writeFile(tmpPath, JSON.stringify(updated, null, 2), 'utf8');
      await fs.rename(tmpPath, filePath);
    } finally {
      await release?.();
    }
  }

  async read(scope: Scope): Promise<ClaudeSettings> {
    const filePath = this.config.settingsPath(scope);
    const raw = await fs.readFile(filePath, 'utf8').catch(() => '{}');
    const json = JSON.parse(raw) as unknown;
    return claudeSettingsSchema.parse(json);
  }

  async symlink(scope: Scope, id: PluginId, target: string): Promise<void> {
    const linkPath = this.config.symlinkPath(scope, id);
    await fs.mkdir(path.dirname(linkPath), { recursive: true });
    // Remove existing symlink if present
    await fs.unlink(linkPath).catch(() => {});
    await fs.symlink(target, linkPath);
  }

  async unlink(scope: Scope, id: PluginId): Promise<void> {
    const linkPath = this.config.symlinkPath(scope, id);
    await fs.unlink(linkPath).catch(() => {});
  }

  private async ensureFile(filePath: string): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    try {
      await fs.access(filePath);
    } catch {
      await fs.writeFile(filePath, '{}', 'utf8');
    }
  }
}
