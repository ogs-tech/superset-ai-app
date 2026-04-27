import { describe, expect, it } from 'vitest';
import { setupSymlinkManager } from './symlink-manager.helpers.js';

describe('SymlinkManager.remove', () => {
  it('removes a symlink destination', async () => {
    const { fs, manager } = setupSymlinkManager();
    const destination = '/workspace/.claude/remove-me';
    await fs.mkdir('/workspace/.claude', { recursive: true });
    await fs.symlink({ target: '/workspace/skills/one/SKILL.md', path: destination });

    await manager.remove({ destination });

    const stat = await fs.lstat(destination);
    expect(stat.kind).toBe('none');
  });

  it('rejects when destination is a real file', async () => {
    const { fs, manager } = setupSymlinkManager();
    const destination = '/workspace/.claude/real-file.md';
    fs.createFile(destination, 'real');

    await expect(manager.remove({ destination })).rejects.toMatchObject({
      kind: 'io',
      details: { reason: 'not-a-symlink' },
    });
  });
});
