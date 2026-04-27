import { describe, expect, it } from 'vitest';
import { InMemoryFileSystem } from '../../../../../src/main/infrastructure/filesystem/in-memory-filesystem.js';
import { FixedClock } from '../../../../../src/main/infrastructure/clock/fixed-clock.js';
import { SymlinkManager } from '../../../../../src/main/application/services/symlink-manager.js';

describe('SymlinkManager.create — special chars', () => {
  it('handles paths with spaces and accents', async () => {
    const fs = new InMemoryFileSystem();
    const clock = new FixedClock(new Date('2026-04-26T10:00:00.000Z'));
    const workspacePath = '/tmp/My Workspace';
    const manager = new SymlinkManager(fs, clock, workspacePath);

    const source = '/tmp/My Workspace/skills/skill com acento/SKILL.md';
    const destination = '/tmp/My Workspace/.claude/skill com acento';
    fs.createFile(source, '# Conteúdo com acento');

    const result = await manager.create({ source, destination });

    expect(result).toEqual({ status: 'ok' });
    expect(await fs.readlink(destination)).toBe(source);
  });
});
