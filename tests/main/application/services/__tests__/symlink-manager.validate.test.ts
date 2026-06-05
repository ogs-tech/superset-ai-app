import { describe, expect, it } from 'vitest';
import { setupSymlinkManager } from './symlink-manager.helpers.js';

describe('SymlinkManager.validate', () => {
  it('returns none for a missing destination', async () => {
    const { manager } = setupSymlinkManager();
    const state = await manager.validate({ destination: '/workspace/missing' });
    expect(state).toBe('none');
  });

  it('returns symlink-to-source when the symlink points to the provided source', async () => {
    const { fs, manager } = setupSymlinkManager();
    const source = '/workspace/skills/source/SKILL.md';
    const destination = '/workspace/.claude/source';
    fs.createFile(source, '# source');
    await fs.mkdir('/workspace/.claude', { recursive: true });
    await fs.symlink({ target: source, path: destination });

    const state = await manager.validate({ destination, source });
    expect(state).toBe('symlink-to-source');
  });

  it('returns symlink-to-other when the symlink points elsewhere', async () => {
    const { fs, manager } = setupSymlinkManager();
    const destination = '/workspace/.claude/other';
    await fs.mkdir('/workspace/.claude', { recursive: true });
    await fs.symlink({ target: '/workspace/elsewhere/file.md', path: destination });

    const state = await manager.validate({
      destination,
      source: '/workspace/skills/source/SKILL.md',
    });
    expect(state).toBe('symlink-to-other');
  });

  it('returns real-file when the destination is a regular file', async () => {
    const { fs, manager } = setupSymlinkManager();
    const destination = '/workspace/.claude/real-file.md';
    fs.createFile(destination, 'plain file');

    const state = await manager.validate({ destination });
    expect(state).toBe('real-file');
  });
});
