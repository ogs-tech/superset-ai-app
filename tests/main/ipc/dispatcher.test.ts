import { describe, expect, it } from 'vitest';
import { createDispatcher, type IpcHandler } from '../../../src/main/ipc/dispatcher.js';
import { DomainError } from '../../../src/main/domain/errors.js';
import {
  PublishAuthMissingError,
  RepoAlreadyExistsError,
  PublishConflictError,
  TagConflictError,
  PluginCollisionError,
  OwnPluginIdCollisionError,
  RefNotFoundError,
  SettingsLockTimeoutError,
  CredentialStoreUnavailableError,
  PluginIdInvalidError,
  ManifestInvalidError,
  SemVerInvalidError,
  OperationNotAllowedForOriginError,
} from '../../../src/main/domain/plugin-errors.js';

describe('createDispatcher', () => {
  it('returns { ok: true, data } when the handler resolves', async () => {
    const handlers: Record<string, IpcHandler> = {
      'settings.get': () => Promise.resolve({ workspacePath: '/tmp' }),
    };
    const dispatch = createDispatcher(handlers);

    const result = await dispatch('settings.get', {});

    expect(result).toEqual({ ok: true, data: { workspacePath: '/tmp' } });
  });

  it('returns envelope with kind=not_found when method is unknown', async () => {
    const dispatch = createDispatcher({});

    const result = await dispatch('does.not.exist', {});

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('not_found');
    expect(result.error.message).toContain('does.not.exist');
  });

  it('preserves DomainError kind and details in the envelope', async () => {
    const handlers: Record<string, IpcHandler> = {
      'broken.op': () => {
        throw new DomainError('symlink_conflict', 'target exists', { path: '/x' });
      },
    };
    const dispatch = createDispatcher(handlers);

    const result = await dispatch('broken.op', {});

    expect(result).toEqual({
      ok: false,
      error: { kind: 'symlink_conflict', message: 'target exists', details: { path: '/x' } },
    });
  });

  it('omits details from envelope when DomainError carries no details', async () => {
    const handlers: Record<string, IpcHandler> = {
      'no.details': () => {
        throw new DomainError('validation', 'bad input');
      },
    };
    const dispatch = createDispatcher(handlers);

    const result = await dispatch('no.details', {});

    expect(result).toEqual({
      ok: false,
      error: { kind: 'validation', message: 'bad input' },
    });
    if (result.ok) return;
    expect(result.error).not.toHaveProperty('details');
  });

  it('maps a generic Error to envelope kind=internal preserving message', async () => {
    const handlers: Record<string, IpcHandler> = {
      'boom.op': () => {
        throw new Error('disk on fire');
      },
    };
    const dispatch = createDispatcher(handlers);

    const result = await dispatch('boom.op', {});

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('internal');
    expect(result.error.message).toBe('disk on fire');
  });

  it('maps a non-Error throw to envelope kind=internal with message "Unknown error"', async () => {
    const handlers: Record<string, IpcHandler> = {
      'weird.op': () => {
        throw 'just a string';
      },
    };
    const dispatch = createDispatcher(handlers);

    const result = await dispatch('weird.op', {});

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('internal');
    expect(result.error.message).toBe('Unknown error');
  });
});

describe('createDispatcher — plugin error mapping', () => {
  const makeDispatch = (err: Error) =>
    createDispatcher({ 'test.op': () => { throw err; } });

  it('maps PublishAuthMissingError to auth', async () => {
    const result = await makeDispatch(new PublishAuthMissingError('missing token'))('test.op', {});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('auth');
    expect(result.error.message).toBe('missing token');
  });

  it('maps RepoAlreadyExistsError to conflict', async () => {
    const result = await makeDispatch(new RepoAlreadyExistsError('repo exists', { repoName: 'foo' }))('test.op', {});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('conflict');
    expect(result.error.details).toEqual({ repoName: 'foo' });
  });

  it('maps PublishConflictError to conflict', async () => {
    const result = await makeDispatch(new PublishConflictError('push rejected'))('test.op', {});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('conflict');
  });

  it('maps TagConflictError to conflict', async () => {
    const result = await makeDispatch(new TagConflictError('tag exists', { tag: 'v1.0.0' }))('test.op', {});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('conflict');
    expect(result.error.details).toEqual({ tag: 'v1.0.0' });
  });

  it('maps PluginCollisionError to validation', async () => {
    const result = await makeDispatch(new PluginCollisionError('collision', { id: 'my-plugin' }))('test.op', {});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation');
    expect(result.error.details).toEqual({ id: 'my-plugin' });
  });

  it('maps OwnPluginIdCollisionError to validation', async () => {
    const result = await makeDispatch(new OwnPluginIdCollisionError('own collision'))('test.op', {});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation');
  });

  it('maps PluginIdInvalidError to validation', async () => {
    const result = await makeDispatch(new PluginIdInvalidError('bad id', { raw: '!!invalid!!' }))('test.op', {});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation');
    expect(result.error.details).toEqual({ raw: '!!invalid!!' });
  });

  it('maps ManifestInvalidError to validation', async () => {
    const result = await makeDispatch(new ManifestInvalidError('bad manifest'))('test.op', {});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation');
  });

  it('maps SemVerInvalidError to validation', async () => {
    const result = await makeDispatch(new SemVerInvalidError('bad version', { raw: 'x.y.z' }))('test.op', {});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation');
  });

  it('maps OperationNotAllowedForOriginError to validation', async () => {
    const result = await makeDispatch(new OperationNotAllowedForOriginError('not allowed'))('test.op', {});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation');
  });

  it('maps RefNotFoundError to not_found', async () => {
    const result = await makeDispatch(new RefNotFoundError('ref missing', { ref: 'v9.9.9' }))('test.op', {});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('not_found');
    expect(result.error.details).toEqual({ ref: 'v9.9.9' });
  });

  it('maps SettingsLockTimeoutError to io', async () => {
    const result = await makeDispatch(new SettingsLockTimeoutError('lock timeout'))('test.op', {});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('io');
  });

  it('maps CredentialStoreUnavailableError to io', async () => {
    const result = await makeDispatch(new CredentialStoreUnavailableError('store unavailable'))('test.op', {});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('io');
  });

  it('omits details key when error has no details', async () => {
    const result = await makeDispatch(new PublishAuthMissingError('no details'))('test.op', {});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).not.toHaveProperty('details');
  });
});
