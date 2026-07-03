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

  it('never writes through a symlink: backs up the resolved target, unlinks the symlink, and writes a fresh file', async () => {
    const { fs, materializer } = make();
    fs.createFile('/workspace/instructions/default.md', 'canonical body\n');
    await fs.symlink({ target: '/workspace/instructions/default.md', path: '/repos/app/AGENTS.md' });

    const result = await materializer.write({ destination: '/repos/app/AGENTS.md', content: owned('new') });

    expect(result.status).toBe('conflict');
    expect(result.details?.backupPath).toContain('/workspace/_backups/');
    expect(await fs.readFile(result.details!.backupPath!)).toBe('canonical body\n');
    // The destination is now a regular file, not a symlink.
    expect((await fs.lstat('/repos/app/AGENTS.md')).kind).toBe('file');
    expect(await fs.readFile('/repos/app/AGENTS.md')).toBe(owned('new'));
    // The link's original target is untouched — no write-through.
    expect(await fs.readFile('/workspace/instructions/default.md')).toBe('canonical body\n');
  });

  it('replaces a broken symlink with a regular file, producing no backup', async () => {
    const { fs, materializer } = make();
    await fs.symlink({ target: '/workspace/instructions/missing.md', path: '/repos/app/AGENTS.md' });

    const result = await materializer.write({ destination: '/repos/app/AGENTS.md', content: owned('new') });

    expect(result.status).toBe('conflict');
    expect(result.details?.backupPath).toBeUndefined();
    expect((await fs.lstat('/repos/app/AGENTS.md')).kind).toBe('file');
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

  it('never removes a symlink destination, even if the target content looks owned', async () => {
    const { fs, materializer } = make();
    fs.createFile('/workspace/instructions/default.md', owned('canonical'));
    await fs.symlink({ target: '/workspace/instructions/default.md', path: '/repos/app/AGENTS.md' });

    expect(await materializer.removeIfOwned({ destination: '/repos/app/AGENTS.md' })).toEqual({ removed: false });
    expect((await fs.lstat('/repos/app/AGENTS.md')).kind).toBe('symlink');
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

  it('reports a symlink destination as foreign, regardless of target content', async () => {
    const { fs, materializer } = make();
    const content = owned('current');
    fs.createFile('/workspace/instructions/default.md', content);
    await fs.symlink({ target: '/workspace/instructions/default.md', path: '/repos/app/AGENTS.md' });

    expect(await materializer.validate({ destination: '/repos/app/AGENTS.md', content })).toBe('foreign');
  });
});
