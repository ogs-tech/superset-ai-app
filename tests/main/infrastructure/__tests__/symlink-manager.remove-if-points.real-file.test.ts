import { describe, it, expect, vi } from 'vitest';
import { SymlinkManager } from '../../../../src/main/application/services/symlink-manager.js';
import { InMemoryFileSystem } from '../../../../src/main/infrastructure/filesystem/in-memory-filesystem.js';
import { FixedClock } from '../../../../src/main/infrastructure/clock/fixed-clock.js';

const WORKSPACE = '/workspace';

describe('SymlinkManager.removeIfPointsToWorkspace — real file (AC#2)', () => {
  it('does not call unlink on real file and returns "skipped-real-file"', async () => {
    const fs = new InMemoryFileSystem();
    fs.createFile('/dest/real', 'content');
    const unlinkSpy = vi.spyOn(fs, 'unlink');
    const sm = new SymlinkManager(fs, new FixedClock(new Date()), WORKSPACE);

    const result = await sm.removeIfPointsToWorkspace('/dest/real', WORKSPACE);

    expect(result).toBe('skipped-real-file');
    expect(unlinkSpy).not.toHaveBeenCalled();
  });
});
