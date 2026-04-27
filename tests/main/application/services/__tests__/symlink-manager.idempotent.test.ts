import { describe, expect, it, vi } from 'vitest';
import { setupSymlinkManager } from './symlink-manager.helpers.js';

describe('SymlinkManager.create — idempotency', () => {
  it('does not rewrite an existing symlink that already points to the source', async () => {
    const { fs, manager } = setupSymlinkManager();
    const source = '/workspace/skills/keep/SKILL.md';
    const destination = '/workspace/.claude/keep';
    fs.createFile(source, '# Keep content');

    await manager.create({ source, destination });

    const symlinkSpy = vi.spyOn(fs, 'symlink');
    const unlinkSpy = vi.spyOn(fs, 'unlink');

    const result = await manager.create({ source, destination });

    expect(result).toEqual({ status: 'ok' });
    expect(symlinkSpy).not.toHaveBeenCalled();
    expect(unlinkSpy).not.toHaveBeenCalled();
  });
});
