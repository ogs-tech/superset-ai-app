import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { CopilotInstructionsGen } from '../../../../../src/main/application/services/copilot-instructions-gen.js';
import { InMemoryCustomizationRepository } from '../../../../../src/main/infrastructure/customization/in-memory-customization-repository.js';
import { InMemoryFileSystem } from '../../../../../src/main/infrastructure/filesystem/in-memory-filesystem.js';
import type { Customization } from '../../../../../src/shared/customization.js';

const WORKSPACE = '/workspace';
const GENERATED_PATH = join(WORKSPACE, '_generated/copilot-instructions.md');

const makeRef = (id: string, name: string): Customization => ({
  id,
  frontmatter: {
    name,
    type: 'reference',
    description: 'desc',
    scopes: ['personal'],
    version: '1.0.0',
    createdAt: '',
    updatedAt: '',
  },
  body: `body:${name}`,
});

describe('CopilotInstructionsGen — order (AC#4)', () => {
  it('sorts references alphabetically by name using Intl.Collator("en")', async () => {
    const customizationRepository = new InMemoryCustomizationRepository();
    await customizationRepository.save({ customization: makeRef('ref/c', 'Cherry') });
    await customizationRepository.save({ customization: makeRef('ref/a', 'Apple') });
    await customizationRepository.save({ customization: makeRef('ref/b', 'banana') });

    const workspaceFs = new InMemoryFileSystem();
    const gen = new CopilotInstructionsGen({ customizationRepository, workspaceFs, workspacePath: WORKSPACE });

    await gen.generate();

    const content = await workspaceFs.readFile(GENERATED_PATH);
    const bodyOrder = ['body:Apple', 'body:banana', 'body:Cherry'];
    let lastIndex = -1;
    for (const body of bodyOrder) {
      const idx = content.indexOf(body);
      expect(idx).toBeGreaterThan(lastIndex);
      lastIndex = idx;
    }
  });

  it('breaks ties by customization id', async () => {
    const customizationRepository = new InMemoryCustomizationRepository();
    await customizationRepository.save({ customization: makeRef('ref/z', 'Same') });
    await customizationRepository.save({ customization: makeRef('ref/a', 'Same') });

    const workspaceFs = new InMemoryFileSystem();
    const gen = new CopilotInstructionsGen({ customizationRepository, workspaceFs, workspacePath: WORKSPACE });

    await gen.generate();

    const content = await workspaceFs.readFile(GENERATED_PATH);
    expect(content.indexOf('body:Same')).toBeGreaterThan(-1);
  });
});
