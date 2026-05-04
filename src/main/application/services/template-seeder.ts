import { promises as fs } from 'node:fs';
import { join } from 'node:path';

const TEMPLATES_FOLDER = 'templates';

const hasErrnoCode = (err: unknown, code: string): boolean =>
  typeof err === 'object' && err !== null && (err as { code?: unknown }).code === code;

export interface TemplateSeederOptions {
  sourceDir: string;
}

export interface SeedResult {
  seeded: number;
}

export class TemplateSeeder {
  constructor(private readonly options: TemplateSeederOptions) {}

  async seedIfMissing(workspacePath: string): Promise<SeedResult> {
    const target = join(workspacePath, TEMPLATES_FOLDER);
    try {
      await fs.access(target);
      return { seeded: 0 };
    } catch (err) {
      if (!hasErrnoCode(err, 'ENOENT')) throw err;
    }

    await fs.mkdir(target, { recursive: true });
    const entries = await fs.readdir(this.options.sourceDir, { withFileTypes: true });
    let count = 0;
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith('.md')) continue;
      await fs.copyFile(join(this.options.sourceDir, entry.name), join(target, entry.name));
      count++;
    }
    return { seeded: count };
  }
}
