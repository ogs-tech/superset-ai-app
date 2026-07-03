import { describe, expect, it } from 'vitest';
import { CursorAdapter } from '../../../../../src/main/infrastructure/adapters/cursor-adapter.js';
import { ClaudeAdapter } from '../../../../../src/main/infrastructure/adapters/claude-adapter.js';
import { AdapterManager } from '../../../../../src/main/application/services/adapter-manager.js';
import { FileMaterializer } from '../../../../../src/main/application/services/file-materializer.js';
import { SymlinkManager } from '../../../../../src/main/application/services/symlink-manager.js';
import { SettingsService } from '../../../../../src/main/application/services/settings-service.js';
import { InMemoryEntityRepository } from '../../../../../src/main/infrastructure/entity/in-memory-entity-repository.js';
import { InMemorySettingsRepository } from '../../../../../src/main/infrastructure/settings/in-memory-settings-repository.js';
import { InMemoryFileSystem } from '../../../../../src/main/infrastructure/filesystem/in-memory-filesystem.js';
import { FixedClock } from '../../../../../src/main/infrastructure/clock/fixed-clock.js';
import { GENERATED_FILE_MARKER } from '../../../../../src/main/application/entity/agents-file.js';
import type { Adapter } from '../../../../../src/main/application/ports/adapter.js';
import type { Settings } from '../../../../../src/shared/settings.js';
import { WORKSPACE_SOURCE, type Entity, type Instruction } from '../../../../../src/shared/entity.js';

const instruction: Instruction = {
  urn: 'urn:instruction:default', kind: 'instruction', name: 'default', description: '',
  scopes: ['personal'], metadata: { version: '1.0.0', createdAt: '', updatedAt: '' },
  source: WORKSPACE_SOURCE, content: 'Reply in pt-BR.', activation: 'always',
};

const settings: Settings = {
  adapters: { claude: { enabled: true }, cursor: { enabled: true } },
  linkedRepos: [{ id: 'r', name: 'app', path: '/repos/app' }],
  ui: { theme: 'system' }, language: 'off',
};

describe('Cursor instruction → AGENTS.md (e2e)', () => {
  it('materializes AGENTS.md on syncAll and removes it on removeAll', async () => {
    const settingsRepo = new InMemorySettingsRepository();
    await settingsRepo.save(settings);
    const settingsService = new SettingsService(settingsRepo);
    const entityRepository = new InMemoryEntityRepository();
    await entityRepository.save(instruction as Entity);
    const fs = new InMemoryFileSystem();
    const clock = new FixedClock(new Date('2026-07-02T10:00:00.000Z'));
    const manager = new AdapterManager({
      settingsService, entityRepository,
      symlinkManager: new SymlinkManager(fs, clock, '/workspace'),
      fileMaterializer: new FileMaterializer(fs, clock, '/workspace'),
      workspacePath: '/workspace',
      adapters: new Map<string, Adapter>([
        ['claude', new ClaudeAdapter({ homedir: '/home/u' })],
        ['cursor', new CursorAdapter({ homedir: '/home/u' })],
      ]),
    });

    await manager.syncAll({ adapterId: 'cursor' });
    expect(await fs.readFile('/repos/app/AGENTS.md')).toBe(`${GENERATED_FILE_MARKER}\n\nReply in pt-BR.\n`);

    await manager.removeAll({ adapterId: 'cursor' });
    expect(await fs.pathExists('/repos/app/AGENTS.md')).toBe(false);
  });
});
