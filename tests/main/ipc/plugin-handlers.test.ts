import { describe, expect, it, vi } from 'vitest';
import { buildPluginHandlers } from '../../../src/main/ipc/plugin-handlers.js';
import { createDispatcher } from '../../../src/main/ipc/dispatcher.js';
import { DomainError } from '../../../src/main/domain/errors.js';
import type { PluginService } from '../../../src/main/application/services/plugin-service.js';

// ── Fake service ──────────────────────────────────────────────────────────────

class FakePluginService {
  import = vi.fn().mockResolvedValue({ id: 'test-plugin', origin: 'imported' });
  list = vi.fn().mockResolvedValue([]);
  get = vi.fn().mockResolvedValue({ id: 'test-plugin' });
  update = vi.fn().mockResolvedValue({ id: 'test-plugin' });
  remove = vi.fn().mockResolvedValue(undefined);
  toggle = vi.fn().mockResolvedValue(undefined);
  createOwned = vi.fn().mockResolvedValue({ id: 'test-plugin', origin: 'owned' });
  deleteOwned = vi.fn().mockResolvedValue(undefined);
  publish = vi.fn().mockResolvedValue({ remoteUrl: 'https://github.com/x/y' });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function setup() {
  const fakeService = new FakePluginService();
  const handlers = buildPluginHandlers(fakeService as unknown as PluginService);
  const dispatch = createDispatcher(handlers);
  return { fakeService, handlers, dispatch };
}

// ── plugin.list ───────────────────────────────────────────────────────────────

describe('plugin.list', () => {
  it('calls service and returns result', async () => {
    const { fakeService, dispatch } = setup();
    fakeService.list.mockResolvedValueOnce([{ id: 'my-plugin' }]);

    const result = await dispatch('plugin.list', { scope: 'personal' });

    expect(result.ok).toBe(true);
    expect(result).toMatchObject({ ok: true, data: [{ id: 'my-plugin' }] });
    expect(fakeService.list).toHaveBeenCalledWith('personal');
  });

  it('throws validation error for missing scope', async () => {
    const { dispatch } = setup();
    const result = await dispatch('plugin.list', { scope: 'bad-scope' });
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ ok: false, error: { kind: 'validation' } });
  });
});

// ── plugin.get ────────────────────────────────────────────────────────────────

describe('plugin.get', () => {
  it('calls service with parsed id and scope', async () => {
    const { fakeService, dispatch } = setup();

    const result = await dispatch('plugin.get', { id: 'my-plugin', scope: 'personal' });

    expect(result.ok).toBe(true);
    expect(fakeService.get).toHaveBeenCalledWith('my-plugin', 'personal');
  });

  it('throws validation error for missing id', async () => {
    const { dispatch } = setup();
    const result = await dispatch('plugin.get', { scope: 'personal' });
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ ok: false, error: { kind: 'validation' } });
  });

  it('throws for invalid plugin id format (uppercase)', async () => {
    const { dispatch } = setup();
    const result = await dispatch('plugin.get', { id: 'Invalid-ID', scope: 'personal' });
    expect(result.ok).toBe(false);
  });
});

// ── plugin.import ─────────────────────────────────────────────────────────────

describe('plugin.import', () => {
  it('calls service with url and scope', async () => {
    const { fakeService, dispatch } = setup();

    const result = await dispatch('plugin.import', {
      url: 'https://github.com/org/repo.git',
      scope: 'personal',
    });

    expect(result.ok).toBe(true);
    expect(fakeService.import).toHaveBeenCalledWith({
      url: 'https://github.com/org/repo.git',
      scope: 'personal',
    });
  });

  it('passes optional ref when provided', async () => {
    const { fakeService, dispatch } = setup();

    await dispatch('plugin.import', {
      url: 'https://github.com/org/repo.git',
      scope: 'personal',
      ref: { kind: 'branch', value: 'main' },
    });

    expect(fakeService.import).toHaveBeenCalledWith(
      expect.objectContaining({ ref: { kind: 'branch', value: 'main' } }),
    );
  });

  it('throws validation error for missing url', async () => {
    const { dispatch } = setup();
    const result = await dispatch('plugin.import', { scope: 'personal' });
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ ok: false, error: { kind: 'validation' } });
  });
});

// ── plugin.update ─────────────────────────────────────────────────────────────

describe('plugin.update', () => {
  it('calls service with id and scope', async () => {
    const { fakeService, dispatch } = setup();

    const result = await dispatch('plugin.update', { id: 'my-plugin', scope: 'personal' });

    expect(result.ok).toBe(true);
    expect(fakeService.update).toHaveBeenCalledWith('my-plugin', 'personal');
  });

  it('throws validation error for missing id', async () => {
    const { dispatch } = setup();
    const result = await dispatch('plugin.update', { scope: 'personal' });
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ ok: false, error: { kind: 'validation' } });
  });
});

// ── plugin.remove ─────────────────────────────────────────────────────────────

describe('plugin.remove', () => {
  it('calls service and returns undefined (no data)', async () => {
    const { fakeService, dispatch } = setup();

    const result = await dispatch('plugin.remove', { id: 'my-plugin', scope: 'personal' });

    expect(result.ok).toBe(true);
    expect(fakeService.remove).toHaveBeenCalledWith('my-plugin', 'personal');
  });

  it('throws validation error for missing scope', async () => {
    const { dispatch } = setup();
    const result = await dispatch('plugin.remove', { id: 'my-plugin' });
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ ok: false, error: { kind: 'validation' } });
  });
});

// ── plugin.toggle ─────────────────────────────────────────────────────────────

describe('plugin.toggle', () => {
  it('calls service with enabled=true', async () => {
    const { fakeService, dispatch } = setup();

    const result = await dispatch('plugin.toggle', {
      id: 'my-plugin',
      scope: 'personal',
      enabled: true,
    });

    expect(result.ok).toBe(true);
    expect(fakeService.toggle).toHaveBeenCalledWith('my-plugin', 'personal', true);
  });

  it('calls service with enabled=false', async () => {
    const { fakeService, dispatch } = setup();

    await dispatch('plugin.toggle', { id: 'my-plugin', scope: 'personal', enabled: false });

    expect(fakeService.toggle).toHaveBeenCalledWith('my-plugin', 'personal', false);
  });

  it('throws validation error when enabled is missing', async () => {
    const { dispatch } = setup();
    const result = await dispatch('plugin.toggle', { id: 'my-plugin', scope: 'personal' });
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ ok: false, error: { kind: 'validation' } });
  });
});

// ── plugin.createOwned ────────────────────────────────────────────────────────

describe('plugin.createOwned', () => {
  it('calls service with required fields', async () => {
    const { fakeService, dispatch } = setup();

    const result = await dispatch('plugin.createOwned', {
      id: 'my-plugin',
      version: '1.0.0',
      scope: 'personal',
    });

    expect(result.ok).toBe(true);
    expect(fakeService.createOwned).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'my-plugin', version: '1.0.0', scope: 'personal' }),
    );
  });

  it('passes optional description when provided', async () => {
    const { fakeService, dispatch } = setup();

    await dispatch('plugin.createOwned', {
      id: 'my-plugin',
      version: '1.0.0',
      scope: 'personal',
      description: 'A nice plugin',
    });

    expect(fakeService.createOwned).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'A nice plugin' }),
    );
  });

  it('throws validation error for missing version', async () => {
    const { dispatch } = setup();
    const result = await dispatch('plugin.createOwned', {
      id: 'my-plugin',
      scope: 'personal',
    });
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ ok: false, error: { kind: 'validation' } });
  });

  it('throws for invalid semver', async () => {
    const { dispatch } = setup();
    const result = await dispatch('plugin.createOwned', {
      id: 'my-plugin',
      version: 'not-a-version',
      scope: 'personal',
    });
    expect(result.ok).toBe(false);
  });

  it('throws for invalid plugin id', async () => {
    const { dispatch } = setup();
    const result = await dispatch('plugin.createOwned', {
      id: 'Invalid-ID',
      version: '1.0.0',
      scope: 'personal',
    });
    expect(result.ok).toBe(false);
  });
});

// ── plugin.deleteOwned ────────────────────────────────────────────────────────

describe('plugin.deleteOwned', () => {
  it('calls service with id and scope', async () => {
    const { fakeService, dispatch } = setup();

    const result = await dispatch('plugin.deleteOwned', {
      id: 'my-plugin',
      scope: 'personal',
    });

    expect(result.ok).toBe(true);
    expect(fakeService.deleteOwned).toHaveBeenCalledWith('my-plugin', 'personal');
  });

  it('throws validation error for missing id', async () => {
    const { dispatch } = setup();
    const result = await dispatch('plugin.deleteOwned', { scope: 'personal' });
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ ok: false, error: { kind: 'validation' } });
  });
});

// ── plugin.publish ────────────────────────────────────────────────────────────

describe('plugin.publish', () => {
  it('calls service with required fields and defaults to public visibility', async () => {
    const { fakeService, dispatch } = setup();

    const result = await dispatch('plugin.publish', {
      id: 'my-plugin',
      scope: 'personal',
      version: '1.2.3',
    });

    expect(result.ok).toBe(true);
    expect(fakeService.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'my-plugin',
        scope: 'personal',
        version: '1.2.3',
        visibility: 'public',
      }),
    );
  });

  it('passes private visibility when specified', async () => {
    const { fakeService, dispatch } = setup();

    await dispatch('plugin.publish', {
      id: 'my-plugin',
      scope: 'personal',
      version: '1.2.3',
      visibility: 'private',
    });

    expect(fakeService.publish).toHaveBeenCalledWith(
      expect.objectContaining({ visibility: 'private' }),
    );
  });

  it('passes optional repoName and commitMessage', async () => {
    const { fakeService, dispatch } = setup();

    await dispatch('plugin.publish', {
      id: 'my-plugin',
      scope: 'personal',
      version: '1.2.3',
      repoName: 'custom-repo',
      commitMessage: 'chore: release',
    });

    expect(fakeService.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        repoName: 'custom-repo',
        commitMessage: 'chore: release',
      }),
    );
  });

  it('throws validation error for missing version', async () => {
    const { dispatch } = setup();
    const result = await dispatch('plugin.publish', { id: 'my-plugin', scope: 'personal' });
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ ok: false, error: { kind: 'validation' } });
  });

  it('throws for invalid plugin id', async () => {
    const { dispatch } = setup();
    const result = await dispatch('plugin.publish', {
      id: 'Invalid-ID',
      scope: 'personal',
      version: '1.0.0',
    });
    expect(result.ok).toBe(false);
  });
});

// ── handler registration ──────────────────────────────────────────────────────

describe('buildPluginHandlers — registration', () => {
  it('registers all expected handler keys', () => {
    const { handlers } = setup();
    const expectedKeys = [
      'plugin.import',
      'plugin.list',
      'plugin.get',
      'plugin.update',
      'plugin.remove',
      'plugin.toggle',
      'plugin.createOwned',
      'plugin.deleteOwned',
      'plugin.publish',
    ];
    for (const key of expectedKeys) {
      expect(handlers).toHaveProperty(key);
    }
  });
});

// ── DomainError shape ─────────────────────────────────────────────────────────

describe('validation error shape', () => {
  it('params=null on plugin.get throws DomainError with kind=validation', async () => {
    const { handlers } = setup();
    await expect(handlers['plugin.get']?.(null)).rejects.toBeInstanceOf(DomainError);
    await expect(handlers['plugin.get']?.(null)).rejects.toMatchObject({ kind: 'validation' });
  });

  it('params=null on plugin.toggle throws DomainError with kind=validation', async () => {
    const { handlers } = setup();
    await expect(handlers['plugin.toggle']?.(null)).rejects.toBeInstanceOf(DomainError);
  });
});
