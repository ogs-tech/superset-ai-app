import { describe, expect, it } from 'vitest';
import { FileMaterializer } from '../../../../src/main/application/services/file-materializer.js';
import { GENERATED_FILE_MARKER } from '../../../../src/main/application/entity/agents-file.js';
import { InMemoryFileSystem } from '../../../../src/main/infrastructure/filesystem/in-memory-filesystem.js';
import { FixedClock } from '../../../../src/main/infrastructure/clock/fixed-clock.js';

const WS = '/workspace';
const owned = (body: string) => `${GENERATED_FILE_MARKER}\n\n${body}\n`;

const make = () => {
  const fs = new InMemoryFileSystem();
  const materializer = new FileMaterializer(fs, new FixedClock(new Date('2026-07-02T10:00:00.000Z')), WS);
  return { fs, materializer };
};

describe('FileMaterializer.write', () => {
  it('creates a new file when the destination is empty', async () => {
    const { fs, materializer } = make();
    const result = await materializer.write({ destination: '/repos/app/AGENTS.md', content: owned('hi') });
    expect(result.status).toBe('ok');
    expect(await fs.readFile('/repos/app/AGENTS.md')).toBe(owned('hi'));
  });

  it('overwrites an app-owned file without a backup', async () => {
    const { fs, materializer } = make();
    fs.createFile('/repos/app/AGENTS.md', owned('old'));
    const result = await materializer.write({ destination: '/repos/app/AGENTS.md', content: owned('new') });
    expect(result.status).toBe('ok');
    expect(result.details?.backupPath).toBeUndefined();
    expect(await fs.readFile('/repos/app/AGENTS.md')).toBe(owned('new'));
  });

  it('backs up a foreign file before overwriting, reporting conflict', async () => {
    const { fs, materializer } = make();
    fs.createFile('/repos/app/AGENTS.md', 'user hand-written content\n');
    const result = await materializer.write({ destination: '/repos/app/AGENTS.md', content: owned('new') });
    expect(result.status).toBe('conflict');
    expect(result.details?.backupPath).toContain('/workspace/_backups/');
    expect(await fs.readFile(result.details!.backupPath!)).toBe('user hand-written content\n');
    expect(await fs.readFile('/repos/app/AGENTS.md')).toBe(owned('new'));
  });
});

describe('FileMaterializer.removeIfOwned', () => {
  it('removes an owned file', async () => {
    const { fs, materializer } = make();
    fs.createFile('/repos/app/AGENTS.md', owned('x'));
    expect(await materializer.removeIfOwned({ destination: '/repos/app/AGENTS.md' })).toEqual({ removed: true });
    expect(await fs.pathExists('/repos/app/AGENTS.md')).toBe(false);
  });

  it('leaves a foreign file untouched', async () => {
    const { fs, materializer } = make();
    fs.createFile('/repos/app/AGENTS.md', 'not ours\n');
    expect(await materializer.removeIfOwned({ destination: '/repos/app/AGENTS.md' })).toEqual({ removed: false });
    expect(await fs.pathExists('/repos/app/AGENTS.md')).toBe(true);
  });

  it('is a no-op when the file is absent', async () => {
    const { materializer } = make();
    expect(await materializer.removeIfOwned({ destination: '/nope/AGENTS.md' })).toEqual({ removed: false });
  });
});

describe('FileMaterializer.validate', () => {
  it('returns ok / drift / missing / foreign', async () => {
    const { fs, materializer } = make();
    const content = owned('current');
    expect(await materializer.validate({ destination: '/a/AGENTS.md', content })).toBe('missing');
    fs.createFile('/a/AGENTS.md', content);
    expect(await materializer.validate({ destination: '/a/AGENTS.md', content })).toBe('ok');
    fs.createFile('/b/AGENTS.md', owned('stale'));
    expect(await materializer.validate({ destination: '/b/AGENTS.md', content })).toBe('drift');
    fs.createFile('/c/AGENTS.md', 'foreign\n');
    expect(await materializer.validate({ destination: '/c/AGENTS.md', content })).toBe('foreign');
  });
});
