import fs from 'node:fs/promises';
import path from 'node:path';
import type { McpServerDef } from '../../application/schemas/mcp.js';

export interface McpDisabledStashPaths {
  stashPath: string;
}

export interface StashedServer {
  id: string;
  def: McpServerDef;
}

export class McpDisabledStash {
  constructor(private readonly paths: McpDisabledStashPaths) {}

  async list(): Promise<StashedServer[]> {
    const map = await this.read();
    return Object.entries(map).map(([id, def]) => ({ id, def }));
  }

  async park(id: string, def: McpServerDef): Promise<void> {
    const map = await this.read();
    map[id] = def;
    await this.write(map);
  }

  async take(id: string): Promise<McpServerDef | undefined> {
    const map = await this.read();
    const def = map[id];
    if (def === undefined) return undefined;
    delete map[id];
    await this.write(map);
    return def;
  }

  private async read(): Promise<Record<string, McpServerDef>> {
    const raw = await fs.readFile(this.paths.stashPath, 'utf8').catch((err: unknown) => {
      if (typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 'ENOENT') {
        return undefined;
      }
      throw err;
    });
    if (raw === undefined) return {};
    return JSON.parse(raw) as Record<string, McpServerDef>;
  }

  private async write(map: Record<string, McpServerDef>): Promise<void> {
    await fs.mkdir(path.dirname(this.paths.stashPath), { recursive: true });
    const tmpPath = this.paths.stashPath + '.tmp';
    await fs.writeFile(tmpPath, JSON.stringify(map, null, 2), 'utf8');
    await fs.rename(tmpPath, this.paths.stashPath);
  }
}
