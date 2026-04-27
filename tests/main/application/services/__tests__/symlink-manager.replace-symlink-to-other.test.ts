import { describe, expect, it } from 'vitest';
import { setupSymlinkManager } from './symlink-manager.helpers.js';

describe('SymlinkManager.create — replace symlink target', () => {
  it('replaces a symlink that points to another target', async () => {
    const { fs, manager } = setupSymlinkManager();
    const source = '/workspace/skills/new/SKILL.md';
    const destination = '/workspace/.claude/conflict';
    fs.createFile(source, '# New content');
    await fs.mkdir('/workspace/.claude', { recursive: true });
    await fs.symlink({ target: '/workspace/old/old.md', path: destination });

    const result = await manager.create({ source, destination });

    expect(result.status).toBe('ok');
    expect(result.details?.replacedTarget).toBe('/workspace/old/old.md');
    expect(await fs.readlink(destination)).toBe(source);
  });
});
