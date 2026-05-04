import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { SymlinkManager } from '../../../../src/main/application/services/symlink-manager.js';
import { InMemoryFileSystem } from '../../../../src/main/infrastructure/filesystem/in-memory-filesystem.js';
import { FixedClock } from '../../../../src/main/infrastructure/clock/fixed-clock.js';

const WORKSPACE = '/workspace';

describe('SymlinkManager.removeIfPointsToWorkspace — removed (AC#1)', () => {
  it('returns "removed" and destination becomes nonexistent', async () => {
    const fs = new InMemoryFileSystem();
    await fs.symlink({ target: join(WORKSPACE, 'skills/foo/SKILL.md'), path: '/dest/link' });
    const sm = new SymlinkManager(fs, new FixedClock(new Date()), WORKSPACE);

    const result = await sm.removeIfPointsToWorkspace('/dest/link', WORKSPACE);

    expect(result).toBe('removed');
    const entry = await fs.lstat('/dest/link');
    expect(entry.kind).toBe('none');
  });
});
