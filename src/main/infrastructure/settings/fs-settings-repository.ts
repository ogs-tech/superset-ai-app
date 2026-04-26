import { promises as fs } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { basename, dirname, join } from 'node:path';
import type { Settings } from '../../../shared/settings.js';
import type { SettingsRepository } from '../../application/ports/settings-repository.js';

const hasErrnoCode = (err: unknown, code: string): boolean =>
  typeof err === 'object' && err !== null && (err as { code?: unknown }).code === code;

export class FsSettingsRepository implements SettingsRepository {
  constructor(private readonly filePath: string) {}

  async load(): Promise<Settings | null> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      return JSON.parse(raw) as Settings;
    } catch (err) {
      if (hasErrnoCode(err, 'ENOENT')) return null;
      throw err;
    }
  }

  async save(settings: Settings): Promise<void> {
    const dir = dirname(this.filePath);
    const name = basename(this.filePath);
    const tempPath = join(dir, `.${name}.${randomBytes(8).toString('hex')}.tmp`);

    await fs.writeFile(tempPath, JSON.stringify(settings, null, 2), 'utf8');
    try {
      await fs.rename(tempPath, this.filePath);
    } catch (err) {
      await fs.unlink(tempPath).catch(() => undefined);
      throw err;
    }
  }
}
