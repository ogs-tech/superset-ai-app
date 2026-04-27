import { describe, expect, it } from 'vitest';
import { InMemoryFileSystem } from '../../../../../src/main/infrastructure/filesystem/in-memory-filesystem.js';
import { FixedClock } from '../../../../../src/main/infrastructure/clock/fixed-clock.js';
import { SymlinkManager } from '../../../../../src/main/application/services/symlink-manager.js';

describe('SymlinkManager.scanByTarget', () => {
  it('recursively finds symlinks whose targets are inside the workspace', async () => {
    const fs = new InMemoryFileSystem();
    const clock = new FixedClock(new Date('2026-04-26T10:00:00.000Z'));
    const manager = new SymlinkManager(fs, clock, '/workspace');

    await fs.mkdir('/workspace/scan', { recursive: true });
    await fs.mkdir('/workspace/other', { recursive: true });
    await fs.symlink({ target: '/workspace/skills/a/SKILL.md', path: '/workspace/scan/a-link' });
    await fs.symlink({ target: '/other/outside.md', path: '/workspace/scan/outside-link' });
    await fs.mkdir('/workspace/scan/sub', { recursive: true });
    await fs.symlink({ target: '/workspace/references/foo.md', path: '/workspace/scan/sub/foo-link' });

    const result = await manager.scanByTarget({ rootPath: '/workspace/scan', workspacePath: '/workspace' });

    expect(result.map((item) => item.path).sort()).toEqual([
      '/workspace/scan/a-link',
      '/workspace/scan/sub/foo-link',
    ]);
  });
});
