import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { SymlinkManager } from '../../../../src/main/application/services/symlink-manager.js';
import { InMemoryFileSystem } from '../../../../src/main/infrastructure/filesystem/in-memory-filesystem.js';
import { FixedClock } from '../../../../src/main/infrastructure/clock/fixed-clock.js';

const WORKSPACE = '/workspace';
const CLOCK = new FixedClock(new Date('2026-05-03T00:00:00Z'));

const setup = () => {
  const fs = new InMemoryFileSystem();
  const sm = new SymlinkManager(fs, CLOCK, WORKSPACE);
  return { fs, sm };
};

describe('SymlinkManager.removeIfPointsToWorkspace — contract (AC#1)', () => {
  it('destination does not exist → "skipped-not-found"', async () => {
    const { sm } = setup();
    const result = await sm.removeIfPointsToWorkspace('/dest/nonexistent', WORKSPACE);
    expect(result).toBe('skipped-not-found');
  });

  it('destination is a real file → "skipped-real-file"', async () => {
    const { fs, sm } = setup();
    fs.createFile('/dest/real-file', 'content');
    const result = await sm.removeIfPointsToWorkspace('/dest/real-file', WORKSPACE);
    expect(result).toBe('skipped-real-file');
  });

  it('destination is symlink pointing inside workspace → "removed"', async () => {
    const { fs, sm } = setup();
    await fs.symlink({ target: join(WORKSPACE, 'skills/foo/SKILL.md'), path: '/dest/link' });
    const result = await sm.removeIfPointsToWorkspace('/dest/link', WORKSPACE);
    expect(result).toBe('removed');
  });

  it('destination is symlink pointing outside workspace → "skipped-out-of-workspace"', async () => {
    const { fs, sm } = setup();
    await fs.symlink({ target: '/tmp/external-target', path: '/dest/external-link' });
    const result = await sm.removeIfPointsToWorkspace('/dest/external-link', WORKSPACE);
    expect(result).toBe('skipped-out-of-workspace');
  });
});
