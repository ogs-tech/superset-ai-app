import { describe, expect, it, vi } from 'vitest';
import { ArtifactService } from '../../../../src/main/application/services/artifact-service.js';
import { InMemoryArtifactRepository } from '../../../../src/main/infrastructure/artifact/in-memory-artifact-repository.js';
import { FixedClock } from '../../../../src/main/infrastructure/clock/fixed-clock.js';
import { DomainError } from '../../../../src/main/domain/errors.js';
import type { AdapterManager } from '../../../../src/main/application/services/adapter-manager.js';
import type { Artifact, ArtifactFrontmatter } from '../../../../src/shared/artifact.js';

const FROZEN = new Date('2026-04-26T10:00:00.000Z');

const validFrontmatter = (
  overrides: Partial<ArtifactFrontmatter> = {},
): ArtifactFrontmatter => ({
  name: 'foo',
  type: 'skill',
  description: 'a sample skill',
  scopes: ['personal'],
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
  const adapterManager = {
    syncOne: vi.fn().mockResolvedValue([]),
    syncAll: vi.fn().mockResolvedValue([]),
    removeOne: vi.fn().mockResolvedValue([]),
  } as unknown as AdapterManager;
  const service = new ArtifactService(repo, clock, adapterManager);
  return { repo, clock, service, adapterManager };
};

describe('ArtifactService.save — validation', () => {
  it('rejects missing required fields with details.missing', async () => {
    const { service } = setup();
    const broken = makeArtifact({
      frontmatter: {
        ...validFrontmatter(),
        name: '',
        description: '',
      } as ArtifactFrontmatter,
    });

    await expect(service.save({ artifact: broken })).rejects.toMatchObject({
      kind: 'validation',
      details: { missing: expect.arrayContaining(['name', 'description']) },
    });
  });

  it('rejects name that fails the kebab-case pattern with details.invalid', async () => {
    const { service } = setup();
    const broken = makeArtifact({
      frontmatter: validFrontmatter({ name: '-bad' }),
    });

    await expect(service.save({ artifact: broken })).rejects.toMatchObject({
      kind: 'validation',
      details: { invalid: ['name'] },
    });
  });

  it('rejects empty scopes array with details.invalid', async () => {
    const { service } = setup();
    const broken = makeArtifact({
      frontmatter: validFrontmatter({ scopes: [] }),
    });

    await expect(service.save({ artifact: broken })).rejects.toMatchObject({
      kind: 'validation',
      details: { invalid: ['scopes'] },
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
        frontmatter: validFrontmatter({ name: 'foo', type: 'skill' }),
      }),
    });
    await service.save({
      artifact: makeArtifact({
        id: 'reference/bar',
        frontmatter: validFrontmatter({ name: 'bar', type: 'reference' }),
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
        frontmatter: validFrontmatter({ name: 'foo', type: 'skill' }),
      }),
    });
    await service.save({
      artifact: makeArtifact({
        id: 'reference/bar',
        frontmatter: validFrontmatter({ name: 'bar', type: 'reference' }),
      }),
    });
    await service.save({
      artifact: makeArtifact({
        id: 'agent/baz',
        frontmatter: validFrontmatter({ name: 'baz', type: 'agent' }),
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

  it('returns { ok: true, syncReport: [] } when removeSymlinks is true and adapters report ok', async () => {
    const { service } = setup();
    await service.save({ artifact: makeArtifact() });

    const result = await service.delete({ id: 'skill/foo', removeSymlinks: true });
    expect(result).toEqual({ ok: true, syncReport: [] });
  });

  it('calls adapterManager.removeOne with the loaded artifact when removeSymlinks=true', async () => {
    const { service, adapterManager } = setup();
    const saved = await service.save({ artifact: makeArtifact() });

    await service.delete({ id: 'skill/foo', removeSymlinks: true });

    expect(adapterManager.removeOne).toHaveBeenCalledWith({ artifact: saved.artifact });
  });

  it('does NOT call adapterManager.removeOne when removeSymlinks=false', async () => {
    const { service, adapterManager } = setup();
    await service.save({ artifact: makeArtifact() });

    await service.delete({ id: 'skill/foo', removeSymlinks: false });

    expect(adapterManager.removeOne).not.toHaveBeenCalled();
  });
});

describe('ArtifactService.save — rename', () => {
  it('moves the artifact to the new id when name changes (no duplicate)', async () => {
    const { service, repo } = setup();
    const created = await service.save({ artifact: makeArtifact() });

    const renamed = await service.save({
      artifact: {
        id: created.artifact.id,
        frontmatter: { ...created.artifact.frontmatter, name: 'foo-renamed' },
        body: created.artifact.body,
      },
    });

    expect(renamed.artifact.id).toBe('skill/foo-renamed');
    expect(await repo.exists({ id: 'skill/foo' })).toBe(false);
    expect(await repo.exists({ id: 'skill/foo-renamed' })).toBe(true);
  });

  it('preserves createdAt and bumps updatedAt on rename', async () => {
    const { service, clock } = setup();
    const first = await service.save({ artifact: makeArtifact() });
    const createdAt = first.artifact.frontmatter.createdAt;

    const later = new Date('2026-04-26T12:00:00.000Z');
    clock.set(later);

    const renamed = await service.save({
      artifact: {
        id: first.artifact.id,
        frontmatter: { ...first.artifact.frontmatter, name: 'foo-renamed' },
        body: first.artifact.body,
      },
    });

    expect(renamed.artifact.frontmatter.createdAt).toBe(createdAt);
    expect(renamed.artifact.frontmatter.updatedAt).toBe(later.toISOString());
  });

  it('removes old symlinks via adapterManager.removeOne with the previous artifact on rename', async () => {
    const { service, adapterManager } = setup();
    const first = await service.save({ artifact: makeArtifact() });

    await service.save({
      artifact: {
        id: first.artifact.id,
        frontmatter: { ...first.artifact.frontmatter, name: 'foo-renamed' },
        body: first.artifact.body,
      },
    });

    expect(adapterManager.removeOne).toHaveBeenCalledWith({ artifact: first.artifact });
  });

  it('rejects rename with details.conflict when target id already exists; nothing is moved', async () => {
    const { service, repo, adapterManager } = setup();
    const original = await service.save({ artifact: makeArtifact() });
    await service.save({
      artifact: makeArtifact({
        id: 'skill/taken',
        frontmatter: validFrontmatter({ name: 'taken' }),
      }),
    });

    (adapterManager.removeOne as ReturnType<typeof vi.fn>).mockClear();

    await expect(
      service.save({
        artifact: {
          id: original.artifact.id,
          frontmatter: { ...original.artifact.frontmatter, name: 'taken' },
          body: original.artifact.body,
        },
      }),
    ).rejects.toMatchObject({
      kind: 'validation',
      details: { conflict: 'skill/taken' },
    });

    expect(await repo.exists({ id: 'skill/foo' })).toBe(true);
    expect(adapterManager.removeOne).not.toHaveBeenCalled();
  });

  it('does NOT call removeOne when name is unchanged on re-save', async () => {
    const { service, adapterManager } = setup();
    const first = await service.save({ artifact: makeArtifact() });

    (adapterManager.removeOne as ReturnType<typeof vi.fn>).mockClear();

    await service.save({
      artifact: {
        id: first.artifact.id,
        frontmatter: first.artifact.frontmatter,
        body: 'updated body',
      },
    });

    expect(adapterManager.removeOne).not.toHaveBeenCalled();
  });
});

describe('ArtifactService.save — DomainError instance', () => {
  it('throws an actual DomainError so the dispatcher envelope wires up correctly', async () => {
    const { service } = setup();
    const broken = makeArtifact({
      frontmatter: validFrontmatter({ name: '' }),
    });

    await expect(service.save({ artifact: broken })).rejects.toBeInstanceOf(DomainError);
  });
});
