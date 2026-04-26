import { describe, expect, it } from 'vitest';
import { ArtifactService } from '../../../../src/main/application/services/artifact-service.js';
import { InMemoryArtifactRepository } from '../../../../src/main/infrastructure/artifact/in-memory-artifact-repository.js';
import { FixedClock } from '../../../../src/main/infrastructure/clock/fixed-clock.js';
import { DomainError } from '../../../../src/main/domain/errors.js';
import type { Artifact, ArtifactFrontmatter } from '../../../../src/shared/artifact.js';

const FROZEN = new Date('2026-04-26T10:00:00.000Z');

const validFrontmatter = (
  overrides: Partial<ArtifactFrontmatter> = {},
): ArtifactFrontmatter => ({
  slug: 'foo',
  name: 'Foo',
  type: 'skill',
  description: 'a sample skill',
  scope: 'personal',
  version: '0.1.0',
  createdAt: '',
  updatedAt: '',
  ...overrides,
});

const makeArtifact = (overrides: Partial<Artifact> = {}): Artifact => ({
  id: 'skill/foo',
  frontmatter: validFrontmatter(),
  body: '# Foo\n',
  ...overrides,
});

const setup = () => {
  const repo = new InMemoryArtifactRepository();
  const clock = new FixedClock(FROZEN);
  const service = new ArtifactService(repo, clock);
  return { repo, clock, service };
};

describe('ArtifactService.save — validation', () => {
  it('rejects missing required fields with details.missing', async () => {
    const { service } = setup();
    const broken = makeArtifact({
      frontmatter: {
        ...validFrontmatter(),
        slug: '',
        name: '',
        description: '',
      } as ArtifactFrontmatter,
    });

    await expect(service.save({ artifact: broken })).rejects.toMatchObject({
      kind: 'validation',
      details: { missing: expect.arrayContaining(['slug', 'name', 'description']) },
    });
  });

  it('rejects slug that fails ^[a-z0-9][a-z0-9-]*$ with details.invalid', async () => {
    const { service } = setup();
    const broken = makeArtifact({
      frontmatter: validFrontmatter({ slug: '-bad' }),
    });

    await expect(service.save({ artifact: broken })).rejects.toMatchObject({
      kind: 'validation',
      details: { invalid: ['slug'] },
    });
  });

  it('rejects description > 200 chars with details.invalid', async () => {
    const { service } = setup();
    const broken = makeArtifact({
      frontmatter: validFrontmatter({ description: 'x'.repeat(201) }),
    });

    await expect(service.save({ artifact: broken })).rejects.toMatchObject({
      kind: 'validation',
      details: { invalid: ['description'] },
    });
  });

  it('rejects creation when <type>/<slug> already exists with details.conflict', async () => {
    const { service } = setup();
    await service.save({ artifact: makeArtifact() });

    const conflict = makeArtifact({
      id: 'skill/foo',
      frontmatter: validFrontmatter({ createdAt: '', updatedAt: '' }),
    });

    await expect(service.save({ artifact: conflict, isCreate: true })).rejects.toMatchObject({
      kind: 'validation',
      details: { conflict: 'skill/foo' },
    });
  });
});

describe('ArtifactService.list', () => {
  it('returns only items of the requested type when type is provided', async () => {
    const { service } = setup();
    await service.save({
      artifact: makeArtifact({
        id: 'skill/foo',
        frontmatter: validFrontmatter({ slug: 'foo', type: 'skill' }),
      }),
    });
    await service.save({
      artifact: makeArtifact({
        id: 'reference/bar',
        frontmatter: validFrontmatter({ slug: 'bar', type: 'reference' }),
        body: '',
      }),
    });

    const skills = await service.list({ type: 'skill' });
    expect(skills.map((a) => a.id)).toEqual(['skill/foo']);
  });

  it('returns artifacts of all types when no filter is provided', async () => {
    const { service } = setup();
    await service.save({
      artifact: makeArtifact({
        id: 'skill/foo',
        frontmatter: validFrontmatter({ slug: 'foo', type: 'skill' }),
      }),
    });
    await service.save({
      artifact: makeArtifact({
        id: 'reference/bar',
        frontmatter: validFrontmatter({ slug: 'bar', type: 'reference' }),
      }),
    });
    await service.save({
      artifact: makeArtifact({
        id: 'agent/baz',
        frontmatter: validFrontmatter({ slug: 'baz', type: 'agent' }),
      }),
    });

    const all = await service.list();
    expect(all.map((a) => a.id).sort()).toEqual([
      'agent/baz',
      'reference/bar',
      'skill/foo',
    ]);
  });
});

describe('ArtifactService.get', () => {
  it('returns the artifact when it exists', async () => {
    const { service } = setup();
    await service.save({ artifact: makeArtifact() });

    const result = await service.get({ id: 'skill/foo' });
    expect(result.id).toBe('skill/foo');
  });

  it('rejects with kind=not_found for non-existing id', async () => {
    const { service } = setup();
    await expect(service.get({ id: 'skill/missing' })).rejects.toMatchObject({
      kind: 'not_found',
    });
  });
});

describe('ArtifactService.save — sync stub and timestamps', () => {
  it('returns { artifact, syncReport: [] } on successful save', async () => {
    const { service } = setup();

    const result = await service.save({ artifact: makeArtifact() });

    expect(result.syncReport).toEqual([]);
    expect(result.artifact.id).toBe('skill/foo');
  });

  it('sets createdAt and updatedAt on first save (ISO-8601 UTC, not from caller)', async () => {
    const { service } = setup();
    const artifact = makeArtifact({
      frontmatter: validFrontmatter({
        createdAt: 'caller-injected-bogus',
        updatedAt: 'caller-injected-bogus',
      }),
    });

    const result = await service.save({ artifact });

    expect(result.artifact.frontmatter.createdAt).toBe(FROZEN.toISOString());
    expect(result.artifact.frontmatter.updatedAt).toBe(FROZEN.toISOString());
  });

  it('on re-save preserves createdAt and bumps updatedAt', async () => {
    const { service, clock } = setup();
    const first = await service.save({ artifact: makeArtifact() });
    const createdAt = first.artifact.frontmatter.createdAt;

    const later = new Date('2026-04-26T11:00:00.000Z');
    clock.set(later);

    const second = await service.save({
      artifact: makeArtifact({ body: 'updated body' }),
    });

    expect(second.artifact.frontmatter.createdAt).toBe(createdAt);
    expect(second.artifact.frontmatter.updatedAt).toBe(later.toISOString());
  });
});

describe('ArtifactService.delete', () => {
  it('removes the artifact via repository', async () => {
    const { service, repo } = setup();
    await service.save({ artifact: makeArtifact() });

    await service.delete({ id: 'skill/foo', removeSymlinks: true });

    expect(await repo.exists({ id: 'skill/foo' })).toBe(false);
  });

  it('rejects with kind=not_found when id does not exist', async () => {
    const { service } = setup();
    await expect(
      service.delete({ id: 'skill/missing', removeSymlinks: false }),
    ).rejects.toMatchObject({ kind: 'not_found' });
  });

  it('returns { ok: true }', async () => {
    const { service } = setup();
    await service.save({ artifact: makeArtifact() });

    const result = await service.delete({ id: 'skill/foo', removeSymlinks: true });
    expect(result).toEqual({ ok: true });
  });
});

describe('ArtifactService.save — DomainError instance', () => {
  it('throws an actual DomainError so the dispatcher envelope wires up correctly', async () => {
    const { service } = setup();
    const broken = makeArtifact({
      frontmatter: validFrontmatter({ slug: '' }),
    });

    await expect(service.save({ artifact: broken })).rejects.toBeInstanceOf(DomainError);
  });
});
