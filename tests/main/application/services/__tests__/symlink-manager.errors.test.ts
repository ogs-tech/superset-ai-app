import { describe, expect, it } from 'vitest';
import { InMemoryFileSystem } from '../../../../../src/main/infrastructure/filesystem/in-memory-filesystem.js';
import { FixedClock } from '../../../../../src/main/infrastructure/clock/fixed-clock.js';
import { SymlinkManager } from '../../../../../src/main/application/services/symlink-manager.js';

interface FailOnRule {
  op: 'lstat' | 'readlink' | 'symlink' | 'unlink' | 'mkdir' | 'copyFile' | 'readdir' | 'pathExists';
  path: string;
  code: string;
}

const createManager = (failOn: FailOnRule[]) => {
  const fs = new InMemoryFileSystem(failOn);
  const clock = new FixedClock(new Date('2026-04-26T10:00:00.000Z'));
  const manager = new SymlinkManager(fs, clock, '/workspace');
  return { fs, manager };
};

describe('SymlinkManager error handling', () => {
  it('returns io error when symlink creation fails', async () => {
    const { manager } = createManager([{ op: 'symlink' as const, path: '/workspace/.claude/broken', code: 'EACCES' }]);
    await expect(
      manager.create({ source: '/workspace/skills/foo/SKILL.md', destination: '/workspace/.claude/broken' }),
    ).rejects.toMatchObject({ kind: 'io', details: { code: 'EACCES' } });
  });

  it('returns io error when unlink fails during symlink replacement', async () => {
    const { fs, manager } = createManager([{ op: 'unlink' as const, path: '/workspace/.claude/broken', code: 'EACCES' }]);
    await fs.mkdir('/workspace/.claude', { recursive: true });
    await fs.symlink({ target: '/workspace/old.md', path: '/workspace/.claude/broken' });
    await expect(
      manager.create({ source: '/workspace/skills/foo/SKILL.md', destination: '/workspace/.claude/broken' }),
    ).rejects.toMatchObject({ kind: 'io', details: { code: 'EACCES' } });
  });
});
