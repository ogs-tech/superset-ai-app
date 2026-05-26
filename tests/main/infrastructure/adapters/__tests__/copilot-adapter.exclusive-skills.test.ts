import { describe, expect, it, vi } from 'vitest';
import { CopilotAdapter } from '../../../../../src/main/infrastructure/adapters/copilot-adapter.js';
import { SettingsService } from '../../../../../src/main/application/services/settings-service.js';
import { InMemorySettingsRepository } from '../../../../../src/main/infrastructure/settings/in-memory-settings-repository.js';
import type { Settings } from '../../../../../src/shared/settings.js';
import type { Customization } from '../../../../../src/shared/customization.js';
import type { CopilotInstructionsGenPort } from '../../../../../src/main/application/ports/copilot-instructions-gen.js';

const HOMEDIR = '/Users/alice';
const WORKSPACE = '/workspace';

const makeGen = (): CopilotInstructionsGenPort => ({
  generate: vi.fn().mockResolvedValue({ path: `${WORKSPACE}/_generated/copilot-instructions.md`, refsIncluded: 1 }),
});

const makeSettings = (overrides: { exclusiveSkillsWithClaude?: boolean; claudeEnabled?: boolean }): Settings => ({
  adapters: {
    claude: { enabled: overrides.claudeEnabled ?? true },
    copilot: { enabled: true, exclusiveSkillsWithClaude: overrides.exclusiveSkillsWithClaude ?? false },
  },
  linkedRepos: [],
  ui: { theme: 'system' },
  language: 'off',
});

const makeSettingsService = (settings: Settings): SettingsService => {
  const repo = new InMemorySettingsRepository();
  void repo.save(settings);
  return new SettingsService(repo);
};

const skillPersonal: Customization = {
  id: 'skill/my-skill',
  frontmatter: {
    name: 'my-skill',
    type: 'skill',
    description: 'a skill',
    scopes: ['personal'],
    version: '1.0.0',
    createdAt: '',
    updatedAt: '',
  },
  body: '',
};

const skillProject: Customization = {
  id: 'skill/my-skill-proj',
  frontmatter: {
    name: 'my-skill-proj',
    type: 'skill',
    description: 'a skill',
    scopes: ['project'],
    version: '1.0.0',
    createdAt: '',
    updatedAt: '',
  },
  body: '',
};

const linkedRepo = { id: 'r1', name: 'repo', path: '/repo1' };

describe('CopilotAdapter — exclusiveSkillsWithClaude flag (AC#2)', () => {
  it('flag=true + claude.enabled=true + skill personal → []', async () => {
    const service = makeSettingsService(makeSettings({ exclusiveSkillsWithClaude: true, claudeEnabled: true }));
    const adapter = new CopilotAdapter({ homedir: HOMEDIR, workspacePath: WORKSPACE, copilotInstructionsGen: makeGen(), settingsService: service });

    const destinations = await adapter.resolveDestinations({ customization: skillPersonal, linkedRepos: [] });

    expect(destinations).toEqual([]);
  });

  it('flag=true + claude.enabled=true + skill project → []', async () => {
    const service = makeSettingsService(makeSettings({ exclusiveSkillsWithClaude: true, claudeEnabled: true }));
    const adapter = new CopilotAdapter({ homedir: HOMEDIR, workspacePath: WORKSPACE, copilotInstructionsGen: makeGen(), settingsService: service });

    const destinations = await adapter.resolveDestinations({ customization: skillProject, linkedRepos: [linkedRepo] });

    expect(destinations).toEqual([]);
  });

  it('flag=true + claude.enabled=false → comportamento normal (AC#3)', async () => {
    const service = makeSettingsService(makeSettings({ exclusiveSkillsWithClaude: true, claudeEnabled: false }));
    const adapter = new CopilotAdapter({ homedir: HOMEDIR, workspacePath: WORKSPACE, copilotInstructionsGen: makeGen(), settingsService: service });

    const destinations = await adapter.resolveDestinations({ customization: skillPersonal, linkedRepos: [] });

    expect(destinations).toHaveLength(1);
    expect(destinations[0]!.destination).toBe(`${HOMEDIR}/.copilot/skills/my-skill`);
  });

  it('flag=false → comportamento normal independente de claude.enabled (AC#3)', async () => {
    const service = makeSettingsService(makeSettings({ exclusiveSkillsWithClaude: false, claudeEnabled: true }));
    const adapter = new CopilotAdapter({ homedir: HOMEDIR, workspacePath: WORKSPACE, copilotInstructionsGen: makeGen(), settingsService: service });

    const destinations = await adapter.resolveDestinations({ customization: skillPersonal, linkedRepos: [] });

    expect(destinations).toHaveLength(1);
    expect(destinations[0]!.destination).toBe(`${HOMEDIR}/.copilot/skills/my-skill`);
  });

  it('sem settingsService injetado → flag assume false (retrocompat)', async () => {
    const adapter = new CopilotAdapter({ homedir: HOMEDIR, workspacePath: WORKSPACE, copilotInstructionsGen: makeGen() });

    const destinations = await adapter.resolveDestinations({ customization: skillPersonal, linkedRepos: [] });

    expect(destinations).toHaveLength(1);
    expect(destinations[0]!.destination).toBe(`${HOMEDIR}/.copilot/skills/my-skill`);
  });
});
