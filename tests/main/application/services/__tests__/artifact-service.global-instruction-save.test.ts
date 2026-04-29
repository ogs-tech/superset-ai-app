import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FsArtifactRepository } from '../../../../../src/main/infrastructure/artifact/fs-artifact-repository.js';
import { parseMarkdown } from '../../../../../src/main/infrastructure/markdown/frontmatter.js';
import type {
  Artifact,
  ArtifactFrontmatter,
} from '../../../../../src/shared/artifact.js';

const ISO = '2026-04-26T10:00:00.000Z';

const globalInstructionFrontmatter = (
  name: 'claude' | 'copilot',
): ArtifactFrontmatter => ({
  name,
  type: 'global-instruction',
  description: 'global instruction',
  scopes: ['personal'],
  version: '0.1.0',
  createdAt: ISO,
  updatedAt: ISO,
});

const makeArtifact = (name: 'claude' | 'copilot'): Artifact => ({
  id: `global-instruction/${name}`,
  frontmatter: globalInstructionFrontmatter(name),
  body: `# ${name} global instruction\n`,
});

let workspace: string;

beforeEach(async () => {
  workspace = await mkdtemp(join(tmpdir(), 'sde-014-global-instruction-'));
});

afterEach(async () => {
  await rm(workspace, { recursive: true, force: true });
});

describe('FsArtifactRepository — global-instruction storage path (AC#4)', () => {
  it('save with slug "claude" persists at <workspace>/global-instructions/claude.md', async () => {
    const repo = new FsArtifactRepository(workspace);
    await repo.save({ artifact: makeArtifact('claude') });

    const target = join(workspace, 'global-instructions', 'claude.md');
    const raw = await readFile(target, 'utf8');
    const { frontmatter, body } = parseMarkdown<ArtifactFrontmatter>(raw);

    expect(frontmatter.name).toBe('claude');
    expect(frontmatter.type).toBe('global-instruction');
    expect(body).toContain('# claude global instruction');
  });

  it('save with slug "copilot" persists at <workspace>/global-instructions/copilot.md', async () => {
    const repo = new FsArtifactRepository(workspace);
    await repo.save({ artifact: makeArtifact('copilot') });

    const target = join(workspace, 'global-instructions', 'copilot.md');
    const raw = await readFile(target, 'utf8');
    const { frontmatter, body } = parseMarkdown<ArtifactFrontmatter>(raw);

    expect(frontmatter.name).toBe('copilot');
    expect(frontmatter.type).toBe('global-instruction');
    expect(body).toContain('# copilot global instruction');
  });

  it('list({ type: "global-instruction" }) returns both saved artifacts', async () => {
    const repo = new FsArtifactRepository(workspace);
    await repo.save({ artifact: makeArtifact('claude') });
    await repo.save({ artifact: makeArtifact('copilot') });

    const found = await repo.list({ type: 'global-instruction' });
    const ids = found.map((a) => a.id).sort();
    expect(ids).toEqual([
      'global-instruction/claude',
      'global-instruction/copilot',
    ]);
  });

  it('list() without filter includes global-instructions alongside other types', async () => {
    const repo = new FsArtifactRepository(workspace);
    await repo.save({ artifact: makeArtifact('claude') });

    const found = await repo.list();
    const ids = found.map((a) => a.id);
    expect(ids).toContain('global-instruction/claude');
  });
});
