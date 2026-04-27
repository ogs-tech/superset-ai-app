import { describe, expect, it } from 'vitest';
import { setupSymlinkManager, SYNC_WORKSPACE } from './symlink-manager.helpers.js';

describe('SymlinkManager.create — backup', () => {
  it('backs up a real destination file before overwriting', async () => {
    const { fs, manager } = setupSymlinkManager();
    const source = `${SYNC_WORKSPACE}/skills/skill-one/SKILL.md`;
    const destination = `${SYNC_WORKSPACE}/references/foo.md`;
    fs.createFile(source, '# Source content');
    fs.createFile(destination, 'existing destination');

    const result = await manager.create({ source, destination });

    expect(result.status).toBe('conflict');
    expect(result.details?.backupPath).toBeDefined();
    expect(result.details?.action).toBe('overwritten');
    const backupContent = await fs.readFile(result.details!.backupPath!);
    expect(backupContent).toBe('existing destination');
    expect(await fs.readlink(destination)).toBe(source);
  });
});
