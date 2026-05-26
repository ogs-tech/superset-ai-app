import { describe, it, expect, vi } from 'vitest';
import { buildHandlers, type IpcDeps } from '../../../src/main/ipc/registry.js';
import { createDispatcher } from '../../../src/main/ipc/dispatcher.js';
import { getDefaults, type Settings } from '../../../src/shared/settings.js';
import type { GlobalInstruction } from '../../../src/main/application/schemas/global-instruction.js';
import type { SyncResult } from '../../../src/shared/customization.js';

const makeGlobalInstruction = (body: string): GlobalInstruction => ({
  id: 'default' as GlobalInstruction['id'],
  frontmatter: {
    name: 'default',
    type: 'global-instruction',
    description: 'test',
    scopes: ['personal'],
    version: '0.1.0',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  source: { kind: 'workspace' },
  body,
});

const baseDeps = (): IpcDeps => {
  const settings: Settings = { ...getDefaults() };
  const gi = makeGlobalInstruction('# Global instructions\n\nSome content.\n');

  return {
    settingsService: {
      load: vi.fn().mockResolvedValue(settings),
      save: vi.fn().mockResolvedValue(undefined),
      merge: vi.fn().mockImplementation(async (partial) => ({ ...settings, ...partial })),
      getDefaults: vi.fn().mockReturnValue(getDefaults()),
    } as unknown as IpcDeps['settingsService'],
    globalInstructionService: {
      get: vi.fn().mockResolvedValue(gi),
      save: vi.fn().mockResolvedValue({ globalInstruction: gi, syncReport: [] }),
    } as unknown as IpcDeps['globalInstructionService'],
    repoService: {} as IpcDeps['repoService'],
    templateService: {} as IpcDeps['templateService'],
    adapterManager: {} as IpcDeps['adapterManager'],
    dialogPort: {} as IpcDeps['dialogPort'],
    pluginService: {} as IpcDeps['pluginService'],
    credentialStore: {} as IpcDeps['credentialStore'],
    skillService: {} as IpcDeps['skillService'],
    agentService: {} as IpcDeps['agentService'],
    commandService: {} as IpcDeps['commandService'],
    hookService: {} as IpcDeps['hookService'],
    referenceService: {} as IpcDeps['referenceService'],
    marketplaceService: {} as IpcDeps['marketplaceService'],
    appQuit: vi.fn(),
  };
};

describe('settings.setLanguage', () => {
  it('updates settings and injects language block into global instruction', async () => {
    const deps = baseDeps();
    const dispatch = createDispatcher(buildHandlers(deps));

    const result = await dispatch('settings.setLanguage', { language: 'pt-BR' });

    expect(result.ok).toBe(true);

    expect(deps.settingsService.merge).toHaveBeenCalledWith({ language: 'pt-BR' });
    expect(deps.globalInstructionService.save).toHaveBeenCalledWith(
      expect.objectContaining({
        globalInstruction: expect.objectContaining({
          body: expect.stringContaining('<language>'),
        }),
      }),
    );
  });

  it('removes language block when set to off', async () => {
    const deps = baseDeps();
    const giWithBlock = makeGlobalInstruction(
      '# Global instructions\n\n<language>\nReply in pt-BR.\n</language>\n',
    );
    (deps.globalInstructionService.get as ReturnType<typeof vi.fn>).mockResolvedValue(giWithBlock);
    const dispatch = createDispatcher(buildHandlers(deps));

    const result = await dispatch('settings.setLanguage', { language: 'off' });

    expect(result.ok).toBe(true);
    expect(deps.globalInstructionService.save).toHaveBeenCalledWith(
      expect.objectContaining({
        globalInstruction: expect.objectContaining({
          body: expect.not.stringContaining('<language>'),
        }),
      }),
    );
  });

  it('rejects invalid language value', async () => {
    const deps = baseDeps();
    const dispatch = createDispatcher(buildHandlers(deps));

    const result = await dispatch('settings.setLanguage', { language: 'klingon' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('validation');
    }
  });
});
