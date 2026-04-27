import { FixedClock } from '../../../../../src/main/infrastructure/clock/fixed-clock.js';
import { InMemoryFileSystem } from '../../../../../src/main/infrastructure/filesystem/in-memory-filesystem.js';
import { SymlinkManager } from '../../../../../src/main/application/services/symlink-manager.js';

export const SYNC_WORKSPACE = '/workspace';

export const setupSymlinkManager = () => {
  const fs = new InMemoryFileSystem();
  const clock = new FixedClock(new Date('2026-04-26T10:00:00.000Z'));
  const manager = new SymlinkManager(fs, clock, SYNC_WORKSPACE);
  return { fs, clock, manager };
};
