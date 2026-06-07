import { describe, it, expect, vi } from 'vitest';
import { SkillService } from '../../../../src/main/application/services/skill-service.js';
import { CustomizationService } from '../../../../src/main/application/services/customization-service.js';
import { PluginProvenanceService } from '../../../../src/main/application/services/plugin-provenance.js';
import { InMemoryCustomizationRepository } from '../../../../src/main/infrastructure/customization/in-memory-customization-repository.js';
import { InMemoryFileSystem } from '../../../../src/main/infrastructure/filesystem/in-memory-filesystem.js';
import { FixedClock } from '../../../../src/main/infrastructure/clock/fixed-clock.js';
import { FakePluginCachePort } from '../../../../src/main/application/services/__fixtures__/fake-plugin-cache-port.js';
import { pluginId } from '../../../../src/main/domain/plugin-id.js';
import type { AdapterManager } from '../../../../src/main/application/services/adapter-manager.js';
import type { ClaudeCodePluginRegistryPort } from '../../../../src/main/application/ports/claude-code-plugin-registry-port.js';

const FROZEN = new Date('2026-06-07T10:00:00.000Z');

const fakeAdapterManager = () =>
  ({ syncOne: vi.fn().mockResolvedValue([]), syncAll: vi.fn().mockResolvedValue([]) }) as unknown as AdapterManager;

const skillFile = (name: string) =>
  `---\nname: ${name}\ntype: skill\ndescription: cc skill\nscopes:\n  - personal\nversion: 1.0.0\ncreatedAt: ${FROZEN.toISOString()}\nupdatedAt: ${FROZEN.toISOString()}\n---\ncc skill body\n`;

const registry = (installPath: string): ClaudeCodePluginRegistryPort => ({
  list: async () => [
    { pluginId: pluginId('feature-dev'), marketplace: 'mp', installPath, version: '1', scope: 'user' },
  ],
});

const makeSkillService = (fs: InMemoryFileSystem, claudeCodeRegistry: ClaudeCodePluginRegistryPort) => {
  const cache = new FakePluginCachePort();
  const base = new CustomizationService(
    new InMemoryCustomizationRepository(),
    new FixedClock(FROZEN),
    fakeAdapterManager(),
  );
  const provenance = new PluginProvenanceService({ cache, fs, claudeCodeRegistry });
  return new SkillService(base, { provenance, cache, fs });
};

describe('SkillService — Claude Code discovery', () => {
  it('lists a Claude Code skill, read-only, tagged claude-code', async () => {
    const fs = new InMemoryFileSystem();
    fs.createFile('/cc/feature-dev/skills/research/SKILL.md', skillFile('research'));
    const skills = makeSkillService(fs, registry('/cc/feature-dev'));

    const listed = await skills.list('personal');
    const research = listed.find((s) => s.id === 'research');
    expect(research?.source).toEqual({
      kind: 'plugin',
      pluginId: 'feature-dev',
      provenance: 'claude-code',
    });
  });
});
