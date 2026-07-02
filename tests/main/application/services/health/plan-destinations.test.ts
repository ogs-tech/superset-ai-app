import { describe, expect, it } from 'vitest';
import { AdapterManager } from '../../../../../src/main/application/services/adapter-manager.js';
import type { SettingsService } from '../../../../../src/main/application/services/settings-service.js';
import type { SymlinkManager } from '../../../../../src/main/application/services/symlink-manager.js';
import type { Adapter } from '../../../../../src/main/application/ports/adapter.js';
import { InMemoryCustomizationRepository } from '../../../../../src/main/infrastructure/customization/in-memory-customization-repository.js';
import { InMemoryEntityRepository } from '../../../../../src/main/infrastructure/entity/in-memory-entity-repository.js';
import { FakeAdapter } from '../../../../../src/main/application/services/__fixtures__/fake-adapter.js';
import { getDefaults, type Settings } from '../../../../../src/shared/settings.js';
import { WORKSPACE_SOURCE, type Skill } from '../../../../../src/shared/entity.js';

const FROZEN = '2026-06-05T10:00:00.000Z';

const skill = (name: string): Skill => ({
  urn: `urn:skill:${name}`,
  kind: 'skill',
  name,
  description: name,
  scopes: ['personal'],
  metadata: { version: '1.0.0', createdAt: FROZEN, updatedAt: FROZEN },
  source: WORKSPACE_SOURCE,
  content: 'body',
});

const settingsWith = (over: Partial<Settings> = {}): Settings => ({
  ...getDefaults(),
  adapters: { claude: { enabled: true } },
  ...over,
});

const setup = async () => {
  const repo = new InMemoryCustomizationRepository();
  const entityRepository = new InMemoryEntityRepository();
  await entityRepository.save(skill('alpha'));

  const settings = settingsWith();
  const settingsService = {
    load: () => Promise.resolve(settings),
    getDefaults: () => getDefaults(),
  } as unknown as SettingsService;

  const adapter: Adapter = new FakeAdapter('claude', '/home/.claude/skills/alpha');

  const manager = new AdapterManager({
    settingsService,
    customizationRepository: repo,
    entityRepository,
    symlinkManager: {} as SymlinkManager,
    adapters: new Map<string, Adapter>([['claude', adapter]]),
    workspacePath: '/ws',
  });
  return { manager };
};

describe('AdapterManager.planDestinations', () => {
  it('resolves expected (source, destination) pairs for enabled adapters', async () => {
    const { manager } = await setup();
    const plan = await manager.planDestinations();

    expect(plan).toEqual([
      {
        adapterId: 'claude',
        source: '/ws/skills/alpha',
        destination: '/home/.claude/skills/alpha',
        scope: 'personal',
      },
    ]);
  });
});
