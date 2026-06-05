import { describe, expect, it } from 'vitest';
import { FakeAdapter } from '../../../../../src/main/application/services/__fixtures__/fake-adapter.js';
import { setupAdapterManager } from './adapter-manager.helpers.js';

describe('AdapterManager sync granularity by customization type', () => {
  it('creates a directory symlink for skill customizations and file symlinks for agent customizations', async () => {
    const skillAdapter = new FakeAdapter('claude', '/workspace/personal/claude-skill');
    const { manager: skillManager, fs: skillFs, registerCustomization: registerSkill } =
      await setupAdapterManager([skillAdapter]);

    const skillCustomization = {
      id: 'skill/alpha',
      frontmatter: {
        name: 'alpha',
        type: 'skill' as const,
        description: 'skill customization',
        scopes: ['personal' as const],
        version: '1.0.0',
        createdAt: '',
        updatedAt: '',
      },
      body: '# alpha',
    };
    await registerSkill(skillCustomization);
    skillFs.createFile('/workspace/skills/alpha/SKILL.md', '# alpha');

    const skillResult = await skillManager.syncOne({ customization: skillCustomization });
    expect(skillResult).toHaveLength(1);
    expect(skillResult.every((entry) => entry.status === 'ok')).toBe(true);
    const skillTarget = await skillFs.readlink('/workspace/personal/claude-skill');
    expect(skillTarget).toBe('/workspace/skills/alpha');
    expect((await skillFs.lstat(skillTarget)).kind).toBe('directory');

    const agentAdapter = new FakeAdapter('claude', '/workspace/personal/claude-agent');
    const { manager: agentManager, fs: agentFs, registerCustomization: registerAgent } =
      await setupAdapterManager([agentAdapter]);

    const agentCustomization = {
      id: 'agent/beta',
      frontmatter: {
        name: 'beta',
        type: 'agent' as const,
        description: 'agent customization',
        scopes: ['personal' as const],
        version: '1.0.0',
        createdAt: '',
        updatedAt: '',
      },
      body: '# beta',
    };
    await registerAgent(agentCustomization);
    agentFs.createFile('/workspace/agents/beta.md', '# beta');

    const agentResult = await agentManager.syncOne({ customization: agentCustomization });
    expect(agentResult).toHaveLength(1);
    expect(agentResult.every((entry) => entry.status === 'ok')).toBe(true);
    const agentTarget = await agentFs.readlink('/workspace/personal/claude-agent');
    expect(agentTarget).toBe('/workspace/agents/beta.md');
    expect((await agentFs.lstat(agentTarget)).kind).toBe('file');
  });
});
