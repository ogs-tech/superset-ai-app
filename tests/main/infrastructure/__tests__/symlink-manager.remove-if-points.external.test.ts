import { describe, it, expect } from 'vitest';
import { SymlinkManager } from '../../../../src/main/application/services/symlink-manager.js';
import { InMemoryFileSystem } from '../../../../src/main/infrastructure/filesystem/in-memory-filesystem.js';
import { FixedClock } from '../../../../src/main/infrastructure/clock/fixed-clock.js';

const WORKSPACE = '/workspace';

describe('SymlinkManager.removeIfPointsToWorkspace — external symlink (AC#3)', () => {
  it('returns "skipped-out-of-workspace" and leaves symlink intact', async () => {
    const fs = new InMemoryFileSystem();
    await fs.symlink({ target: '/tmp/external-target', path: '/dest/link' });
    const sm = new SymlinkManager(fs, new FixedClock(new Date()), WORKSPACE);

    const result = await sm.removeIfPointsToWorkspace('/dest/link', WORKSPACE);

    expect(result).toBe('skipped-out-of-workspace');
    const entry = await fs.lstat('/dest/link');
    expect(entry.kind).toBe('symlink');
  });
});
