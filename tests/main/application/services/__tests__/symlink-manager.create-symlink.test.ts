import { describe, expect, it } from 'vitest';
import { setupSymlinkManager } from './symlink-manager.helpers.js';

describe('SymlinkManager.create', () => {
  it('creates a symlink when destination does not exist', async () => {
    const { fs, manager } = setupSymlinkManager();
    const source = '/workspace/skills/first-skill/SKILL.md';
    const destination = '/workspace/.claude/skills/first-skill';
    fs.createFile(source, '# Skill content');

    const result = await manager.create({ source, destination });

    expect(result).toEqual({ status: 'ok' });
    const target = await fs.readlink(destination);
    expect(target).toBe(source);
  });
});
