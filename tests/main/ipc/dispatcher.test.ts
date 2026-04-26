import { describe, expect, it } from 'vitest';
import { createDispatcher, type IpcHandler } from '../../../src/main/ipc/dispatcher.js';
import { DomainError } from '../../../src/main/domain/errors.js';

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
