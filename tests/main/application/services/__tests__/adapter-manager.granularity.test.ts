import { describe, expect, it } from 'vitest';
import { FakeAdapter } from '../../../../../src/main/application/services/__fixtures__/fake-adapter.js';
import { setupAdapterManager } from './adapter-manager.helpers.js';

describe('AdapterManager sync granularity by customization type', () => {
  it('creates a directory symlink for skill customizations and file symlinks for reference customizations', async () => {
    const adapters = [
      new FakeAdapter('claude', '/workspace/personal/claude-skill'),
      new FakeAdapter('copilot', '/workspace/personal/claude-ref'),
    ];
    const { manager, fs, registerCustomization } = await setupAdapterManager(adapters);

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
    await registerCustomization(skillCustomization);
    fs.createFile('/workspace/skills/alpha/SKILL.md', '# alpha');

    const referenceCustomization = {
      id: 'reference/beta',
      frontmatter: {
        name: 'beta',
        type: 'reference' as const,
        description: 'reference customization',
        scopes: ['personal' as const],
        version: '1.0.0',
        createdAt: '',
        updatedAt: '',
      },
      body: '# beta',
    };
    await registerCustomization(referenceCustomization);
    fs.createFile('/workspace/references/beta.md', '# beta');

    const skillResult = await manager.syncOne({ customization: skillCustomization });
    expect(skillResult).toHaveLength(2);
    expect(skillResult.every((entry) => entry.status === 'ok')).toBe(true);
    const skillTarget = await fs.readlink('/workspace/personal/claude-skill');
    expect(skillTarget).toBe('/workspace/skills/alpha');
    expect((await fs.lstat(skillTarget)).kind).toBe('directory');

    const referenceResult = await manager.syncOne({ customization: referenceCustomization });
    expect(referenceResult).toHaveLength(2);
    expect(referenceResult.every((entry) => entry.status === 'ok')).toBe(true);
    const referenceTarget = await fs.readlink('/workspace/personal/claude-ref');
    expect(referenceTarget).toBe('/workspace/references/beta.md');
    expect((await fs.lstat(referenceTarget)).kind).toBe('file');
  });
});
