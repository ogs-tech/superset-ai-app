import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { CustomizationService } from '../../../../src/main/application/services/customization-service.js';
import type { WorkspaceRoot } from '../../../../src/main/application/services/customization-service.js';
import { InMemoryCustomizationRepository } from '../../../../src/main/infrastructure/customization/in-memory-customization-repository.js';
import { FixedClock } from '../../../../src/main/infrastructure/clock/fixed-clock.js';
import { DomainError } from '../../../../src/main/domain/errors.js';
import type { AdapterManager } from '../../../../src/main/application/services/adapter-manager.js';
import type { Customization, CustomizationFrontmatter } from '../../../../src/shared/customization.js';

const FROZEN = new Date('2026-04-26T10:00:00.000Z');

const validFrontmatter = (
  overrides: Partial<CustomizationFrontmatter> = {},
): CustomizationFrontmatter => ({
  name: 'foo',
  type: 'skill',
  description: 'a sample skill',
  scopes: ['personal'],
  version: '0.1.0',
  createdAt: '',
  updatedAt: '',
  ...overrides,
});

const makeCustomization = (overrides: Partial<Customization> = {}): Customization => ({
  id: 'skill/foo',
  frontmatter: validFrontmatter(),
  body: '# Foo\n',
  ...overrides,
});

const setup = () => {
  const repo = new InMemoryCustomizationRepository();
  const clock = new FixedClock(FROZEN);
  const adapterManager = {
    syncOne: vi.fn().mockResolvedValue([]),
    syncAll: vi.fn().mockResolvedValue([]),
    removeOne: vi.fn().mockResolvedValue([]),
  } as unknown as AdapterManager;
  const service = new CustomizationService(repo, clock, adapterManager);
  return { repo, clock, service, adapterManager };
};

describe('CustomizationService.save — validation', () => {
  it('rejects missing required fields with details.missing', async () => {
    const { service } = setup();
    const broken = makeCustomization({
      frontmatter: {
        ...validFrontmatter(),
        name: '',
        description: '',
      } as CustomizationFrontmatter,
    });

    await expect(service.save({ customization: broken })).rejects.toMatchObject({
      kind: 'validation',
      details: { missing: expect.arrayContaining(['name', 'description']) },
    });
  });

  it('rejects name that fails the kebab-case pattern with details.invalid', async () => {
    const { service } = setup();
    const broken = makeCustomization({
      frontmatter: validFrontmatter({ name: '-bad' }),
    });

    await expect(service.save({ customization: broken })).rejects.toMatchObject({
      kind: 'validation',
      details: { invalid: ['name'] },
    });
  });

  it('rejects empty scopes array with details.invalid', async () => {
    const { service } = setup();
    const broken = makeCustomization({
      frontmatter: validFrontmatter({ scopes: [] }),
    });

    await expect(service.save({ customization: broken })).rejects.toMatchObject({
      kind: 'validation',
      details: { invalid: ['scopes'] },
    });
  });

  it('rejects description > 200 chars with details.invalid', async () => {
    const { service } = setup();
    const broken = makeCustomization({
      frontmatter: validFrontmatter({ description: 'x'.repeat(201) }),
    });

    await expect(service.save({ customization: broken })).rejects.toMatchObject({
      kind: 'validation',
      details: { invalid: ['description'] },
    });
  });

  it('rejects creation when <type>/<slug> already exists with details.conflict', async () => {
    const { service } = setup();
    await service.save({ customization: makeCustomization() });

    const conflict = makeCustomization({
      id: 'skill/foo',
      frontmatter: validFrontmatter({ createdAt: '', updatedAt: '' }),
    });

    await expect(service.save({ customization: conflict, isCreate: true })).rejects.toMatchObject({
      kind: 'validation',
      details: { conflict: 'skill/foo' },
    });
  });
});

describe('CustomizationService.list', () => {
  it('returns only items of the requested type when type is provided', async () => {
    const { service } = setup();
    await service.save({
      customization: makeCustomization({
        id: 'skill/foo',
        frontmatter: validFrontmatter({ name: 'foo', type: 'skill' }),
      }),
    });
    await service.save({
      customization: makeCustomization({
        id: 'reference/bar',
        frontmatter: validFrontmatter({ name: 'bar', type: 'reference' }),
        body: '',
      }),
    });

    const skills = await service.list({ type: 'skill' });
    expect(skills.map((a) => a.id)).toEqual(['skill/foo']);
  });

  it('returns customizations of all types when no filter is provided', async () => {
    const { service } = setup();
    await service.save({
      customization: makeCustomization({
        id: 'skill/foo',
        frontmatter: validFrontmatter({ name: 'foo', type: 'skill' }),
      }),
    });
    await service.save({
      customization: makeCustomization({
        id: 'reference/bar',
        frontmatter: validFrontmatter({ name: 'bar', type: 'reference' }),
      }),
    });
    await service.save({
      customization: makeCustomization({
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

describe('CustomizationService.get', () => {
  it('returns the customization when it exists', async () => {
    const { service } = setup();
    await service.save({ customization: makeCustomization() });

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

describe('CustomizationService.save — sync stub and timestamps', () => {
  it('returns { customization, syncReport: [] } on successful save', async () => {
    const { service } = setup();

    const result = await service.save({ customization: makeCustomization() });

    expect(result.syncReport).toEqual([]);
    expect(result.customization.id).toBe('skill/foo');
  });

  it('sets createdAt and updatedAt on first save (ISO-8601 UTC, not from caller)', async () => {
    const { service } = setup();
    const customization = makeCustomization({
      frontmatter: validFrontmatter({
        createdAt: 'caller-injected-bogus',
        updatedAt: 'caller-injected-bogus',
      }),
    });

    const result = await service.save({ customization });

    expect(result.customization.frontmatter.createdAt).toBe(FROZEN.toISOString());
    expect(result.customization.frontmatter.updatedAt).toBe(FROZEN.toISOString());
  });

  it('on re-save preserves createdAt and bumps updatedAt', async () => {
    const { service, clock } = setup();
    const first = await service.save({ customization: makeCustomization() });
    const createdAt = first.customization.frontmatter.createdAt;

    const later = new Date('2026-04-26T11:00:00.000Z');
    clock.set(later);

    const second = await service.save({
      customization: makeCustomization({ body: 'updated body' }),
    });

    expect(second.customization.frontmatter.createdAt).toBe(createdAt);
    expect(second.customization.frontmatter.updatedAt).toBe(later.toISOString());
  });
});

describe('CustomizationService.delete', () => {
  it('removes the customization via repository', async () => {
    const { service, repo } = setup();
    await service.save({ customization: makeCustomization() });

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
    await service.save({ customization: makeCustomization() });

    const result = await service.delete({ id: 'skill/foo', removeSymlinks: true });
    expect(result).toEqual({ ok: true, syncReport: [] });
  });

  it('calls adapterManager.removeOne with the loaded customization when removeSymlinks=true', async () => {
    const { service, adapterManager } = setup();
    const saved = await service.save({ customization: makeCustomization() });

    await service.delete({ id: 'skill/foo', removeSymlinks: true });

    expect(adapterManager.removeOne).toHaveBeenCalledWith({ customization: saved.customization });
  });

  it('does NOT call adapterManager.removeOne when removeSymlinks=false', async () => {
    const { service, adapterManager } = setup();
    await service.save({ customization: makeCustomization() });

    await service.delete({ id: 'skill/foo', removeSymlinks: false });

    expect(adapterManager.removeOne).not.toHaveBeenCalled();
  });
});

describe('CustomizationService.save — rename', () => {
  it('moves the customization to the new id when name changes (no duplicate)', async () => {
    const { service, repo } = setup();
    const created = await service.save({ customization: makeCustomization() });

    const renamed = await service.save({
      customization: {
        id: created.customization.id,
        frontmatter: { ...created.customization.frontmatter, name: 'foo-renamed' },
        body: created.customization.body,
      },
    });

    expect(renamed.customization.id).toBe('skill/foo-renamed');
    expect(await repo.exists({ id: 'skill/foo' })).toBe(false);
    expect(await repo.exists({ id: 'skill/foo-renamed' })).toBe(true);
  });

  it('preserves createdAt and bumps updatedAt on rename', async () => {
    const { service, clock } = setup();
    const first = await service.save({ customization: makeCustomization() });
    const createdAt = first.customization.frontmatter.createdAt;

    const later = new Date('2026-04-26T12:00:00.000Z');
    clock.set(later);

    const renamed = await service.save({
      customization: {
        id: first.customization.id,
        frontmatter: { ...first.customization.frontmatter, name: 'foo-renamed' },
        body: first.customization.body,
      },
    });

    expect(renamed.customization.frontmatter.createdAt).toBe(createdAt);
    expect(renamed.customization.frontmatter.updatedAt).toBe(later.toISOString());
  });

  it('removes old symlinks via adapterManager.removeOne with the previous customization on rename', async () => {
    const { service, adapterManager } = setup();
    const first = await service.save({ customization: makeCustomization() });

    await service.save({
      customization: {
        id: first.customization.id,
        frontmatter: { ...first.customization.frontmatter, name: 'foo-renamed' },
        body: first.customization.body,
      },
    });

    expect(adapterManager.removeOne).toHaveBeenCalledWith({ customization: first.customization });
  });

  it('rejects rename with details.conflict when target id already exists; nothing is moved', async () => {
    const { service, repo, adapterManager } = setup();
    const original = await service.save({ customization: makeCustomization() });
    await service.save({
      customization: makeCustomization({
        id: 'skill/taken',
        frontmatter: validFrontmatter({ name: 'taken' }),
      }),
    });

    (adapterManager.removeOne as ReturnType<typeof vi.fn>).mockClear();

    await expect(
      service.save({
        customization: {
          id: original.customization.id,
          frontmatter: { ...original.customization.frontmatter, name: 'taken' },
          body: original.customization.body,
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
    const first = await service.save({ customization: makeCustomization() });

    (adapterManager.removeOne as ReturnType<typeof vi.fn>).mockClear();

    await service.save({
      customization: {
        id: first.customization.id,
        frontmatter: first.customization.frontmatter,
        body: 'updated body',
      },
    });

    expect(adapterManager.removeOne).not.toHaveBeenCalled();
  });
});

describe('CustomizationService.save — DomainError instance', () => {
  it('throws an actual DomainError so the dispatcher envelope wires up correctly', async () => {
    const { service } = setup();
    const broken = makeCustomization({
      frontmatter: validFrontmatter({ name: '' }),
    });

    await expect(service.save({ customization: broken })).rejects.toBeInstanceOf(DomainError);
  });
});

describe('WorkspaceRoot type', () => {
  it('is exported and accepts { kind: "customizations" }', () => {
    const root: WorkspaceRoot = { kind: 'customizations' };
    expect(root.kind).toBe('customizations');
  });

  it('is exported and accepts { kind: "plugin", pluginId: string }', () => {
    const root: WorkspaceRoot = { kind: 'plugin', pluginId: 'my-plugin' };
    expect(root.kind).toBe('plugin');
    if (root.kind === 'plugin') {
      expect(root.pluginId).toBe('my-plugin');
    }
  });
});

describe('CustomizationService.resolveRoot — path resolution', () => {
  const WORKSPACE = '/test/workspace';

  const setupWithWorkspace = () => {
    const repo = new InMemoryCustomizationRepository();
    const clock = new FixedClock(FROZEN);
    const adapterManager = {
      syncOne: vi.fn().mockResolvedValue([]),
      syncAll: vi.fn().mockResolvedValue([]),
      removeOne: vi.fn().mockResolvedValue([]),
    } as unknown as AdapterManager;
    const service = new CustomizationService(repo, clock, adapterManager, undefined, WORKSPACE);
    return { service };
  };

  it('resolves customizations root to <workspace>/customizations', () => {
    const { service } = setupWithWorkspace();
    const result = (service as any).resolveRoot({ kind: 'customizations' });
    expect(result).toBe(join(WORKSPACE, 'customizations'));
  });

  it('resolves plugin root to <workspace>/plugins/<id>', () => {
    const { service } = setupWithWorkspace();
    const result = (service as any).resolveRoot({ kind: 'plugin', pluginId: 'my-plugin' });
    expect(result).toBe(join(WORKSPACE, 'plugins', 'my-plugin'));
  });

  it('defaults to customizations when no root is provided', () => {
    const { service } = setupWithWorkspace();
    const result = (service as any).resolveRoot();
    expect(result).toBe(join(WORKSPACE, 'customizations'));
  });

  it('throws when workspacePath is not set', () => {
    const { service } = setup();
    expect(() => (service as any).resolveRoot()).toThrow('workspacePath is required');
  });
});

describe('CustomizationService — root parameter accepted on public methods', () => {
  it('list accepts optional root parameter without error', async () => {
    const { service } = setup();
    await service.save({ customization: makeCustomization() });

    const resultDefault = await service.list({});
    const resultWithRoot = await service.list({}, { kind: 'customizations' });
    const resultWithPlugin = await service.list({}, { kind: 'plugin', pluginId: 'my-plugin' });

    expect(resultDefault).toHaveLength(1);
    expect(resultWithRoot).toHaveLength(1);
    // plugin root uses the same in-memory repo in tests, so same data
    expect(resultWithPlugin).toHaveLength(1);
  });

  it('get accepts optional root in query without error', async () => {
    const { service } = setup();
    await service.save({ customization: makeCustomization() });

    const result = await service.get({ id: 'skill/foo', root: { kind: 'customizations' } });
    expect(result.id).toBe('skill/foo');
  });

  it('save accepts optional root in command without error', async () => {
    const { service } = setup();

    const result = await service.save({
      customization: makeCustomization(),
      root: { kind: 'plugin', pluginId: 'my-plugin' },
    });

    expect(result.customization.id).toBe('skill/foo');
  });

  it('delete accepts optional root in command without error', async () => {
    const { service } = setup();
    await service.save({ customization: makeCustomization() });

    const result = await service.delete({
      id: 'skill/foo',
      removeSymlinks: false,
      root: { kind: 'plugin', pluginId: 'my-plugin' },
    });

    expect(result.ok).toBe(true);
  });
});
