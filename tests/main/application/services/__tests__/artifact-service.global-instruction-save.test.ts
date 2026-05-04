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

const globalInstructionFrontmatter = (): ArtifactFrontmatter => ({
  name: 'default',
  type: 'global-instruction',
  description: 'global instruction',
  scopes: ['personal'],
  version: '0.1.0',
  createdAt: ISO,
  updatedAt: ISO,
});

const makeArtifact = (): Artifact => ({
  id: 'global-instruction/default',
  frontmatter: globalInstructionFrontmatter(),
  body: `# default global instruction\n`,
});

let workspace: string;

beforeEach(async () => {
  workspace = await mkdtemp(join(tmpdir(), 'sde-014-global-instruction-'));
});

afterEach(async () => {
  await rm(workspace, { recursive: true, force: true });
});

describe('FsArtifactRepository — global-instruction storage path', () => {
  it('save persists at <workspace>/global-instructions/default.md', async () => {
    const repo = new FsArtifactRepository(workspace);
    await repo.save({ artifact: makeArtifact() });

    const target = join(workspace, 'global-instructions', 'default.md');
    const raw = await readFile(target, 'utf8');
    const { frontmatter, body } = parseMarkdown<ArtifactFrontmatter>(raw);

    expect(frontmatter.name).toBe('default');
    expect(frontmatter.type).toBe('global-instruction');
    expect(body).toContain('# default global instruction');
  });

  it('list({ type: "global-instruction" }) returns the saved artifact', async () => {
    const repo = new FsArtifactRepository(workspace);
    await repo.save({ artifact: makeArtifact() });

    const found = await repo.list({ type: 'global-instruction' });
    const ids = found.map((a) => a.id).sort();
    expect(ids).toEqual(['global-instruction/default']);
  });

  it('list() without filter includes global-instructions alongside other types', async () => {
    const repo = new FsArtifactRepository(workspace);
    await repo.save({ artifact: makeArtifact() });

    const found = await repo.list();
    const ids = found.map((a) => a.id);
    expect(ids).toContain('global-instruction/default');
  });
});
