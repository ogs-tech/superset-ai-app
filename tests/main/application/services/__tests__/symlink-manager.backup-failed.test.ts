import { describe, expect, it } from 'vitest';
import { InMemoryFileSystem } from '../../../../../src/main/infrastructure/filesystem/in-memory-filesystem.js';
import { FixedClock } from '../../../../../src/main/infrastructure/clock/fixed-clock.js';
import { SymlinkManager } from '../../../../../src/main/application/services/symlink-manager.js';

describe('SymlinkManager.backup-failed-aborts', () => {
  it('propagates backup failure and does not overwrite the destination', async () => {
    const fs = new InMemoryFileSystem([
      {
        op: 'copyFile',
        path: '/workspace/_backups/20260426T100000/references/foo.md',
        code: 'ENOSPC',
      },
    ]);
    const clock = new FixedClock(new Date('2026-04-26T10:00:00.000Z'));
    const manager = new SymlinkManager(fs, clock, '/workspace');
    const source = '/workspace/skills/foo/SKILL.md';
    const destination = '/workspace/references/foo.md';
    fs.createFile(source, '# Source');
    fs.createFile(destination, 'destination content');

    await expect(manager.create({ source, destination })).rejects.toMatchObject({
      kind: 'io',
      details: { reason: 'backup-failed' },
    });

    const stat = await fs.lstat(destination);
    expect(stat.kind).toBe('file');
  });
});
