import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FsArtifactRepository } from '../../../../src/main/infrastructure/artifact/fs-artifact-repository.js';
import { SchemaValidator } from '../../../../src/main/application/services/schema-validator.js';

let workspace: string;

beforeEach(async () => {
  workspace = await mkdtemp(join(tmpdir(), 'sde-permissive-'));
});

afterEach(async () => {
  await rm(workspace, { recursive: true, force: true });
});

const invalidFrontmatter = `---
name: my-skill
type: skill
description: ${'x'.repeat(1025)}
scopes:
  - personal
version: 1.0.0
createdAt: "2026-05-03T00:00:00.000Z"
updatedAt: "2026-05-03T00:00:00.000Z"
---
# Body
`;

const skillDir = (ws: string, name: string) => join(ws, 'skills', name);

describe('FsArtifactRepository — permissive load (AC#16)', () => {
  it('list() returns artifact with invalid frontmatter (description > 1024) without throwing', async () => {
    await mkdir(skillDir(workspace, 'my-skill'), { recursive: true });
    await writeFile(join(skillDir(workspace, 'my-skill'), 'SKILL.md'), invalidFrontmatter);

    const repo = new FsArtifactRepository(async () => workspace);
    const artifacts = await repo.list();

    const found = artifacts.find((a) => a.frontmatter.name === 'my-skill');
    expect(found).toBeDefined();
  });

  it('list() does NOT call SchemaValidator.validate', async () => {
    await mkdir(skillDir(workspace, 'my-skill'), { recursive: true });
    await writeFile(join(skillDir(workspace, 'my-skill'), 'SKILL.md'), invalidFrontmatter);

    const validateSpy = vi.spyOn(SchemaValidator.prototype, 'validate');
    const repo = new FsArtifactRepository(async () => workspace);

    await repo.list();

    expect(validateSpy).not.toHaveBeenCalled();
    validateSpy.mockRestore();
  });
});
