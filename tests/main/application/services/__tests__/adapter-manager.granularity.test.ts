import { describe, expect, it } from 'vitest';
import { FakeAdapter } from '../../../../../src/main/application/services/__fixtures__/fake-adapter.js';
import { setupAdapterManager } from './adapter-manager.helpers.js';

describe('AdapterManager sync granularity by artifact type', () => {
  it('creates a directory symlink for skill artifacts and file symlinks for reference artifacts', async () => {
    const adapters = [
      new FakeAdapter('claude', '/workspace/personal/claude-skill'),
      new FakeAdapter('copilot', '/workspace/personal/claude-ref'),
    ];
    const { manager, fs, registerArtifact } = await setupAdapterManager(adapters);

    const skillArtifact = {
      id: 'skill/alpha',
      frontmatter: {
        slug: 'alpha',
        name: 'Alpha',
        type: 'skill' as const,
        description: 'skill artifact',
        scope: 'personal' as const,
        version: '1.0.0',
        createdAt: '',
        updatedAt: '',
      },
      body: '# alpha',
    };
    await registerArtifact(skillArtifact);
    fs.createFile('/workspace/skills/alpha/SKILL.md', '# alpha');

    const referenceArtifact = {
      id: 'reference/beta',
      frontmatter: {
        slug: 'beta',
        name: 'Beta',
        type: 'reference' as const,
        description: 'reference artifact',
        scope: 'personal' as const,
        version: '1.0.0',
        createdAt: '',
        updatedAt: '',
      },
      body: '# beta',
    };
    await registerArtifact(referenceArtifact);
    fs.createFile('/workspace/references/beta.md', '# beta');

    const skillResult = await manager.syncOne({ artifact: skillArtifact });
    expect(skillResult).toHaveLength(2);
    expect(skillResult.every((entry) => entry.status === 'ok')).toBe(true);
    const skillTarget = await fs.readlink('/workspace/personal/claude-skill');
    expect(skillTarget).toBe('/workspace/skills/alpha');
    expect((await fs.lstat(skillTarget)).kind).toBe('directory');

    const referenceResult = await manager.syncOne({ artifact: referenceArtifact });
    expect(referenceResult).toHaveLength(2);
    expect(referenceResult.every((entry) => entry.status === 'ok')).toBe(true);
    const referenceTarget = await fs.readlink('/workspace/personal/claude-ref');
    expect(referenceTarget).toBe('/workspace/references/beta.md');
    expect((await fs.lstat(referenceTarget)).kind).toBe('file');
  });
});
