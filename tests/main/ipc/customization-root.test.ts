import { describe, expect, it, vi } from 'vitest';
import { buildHandlers } from '../../../src/main/ipc/registry.js';
import type { IpcDeps } from '../../../src/main/ipc/registry.js';
import type { IpcHandler } from '../../../src/main/ipc/dispatcher.js';

// NOTE: T8.1 (adding root param to customization-service) has landed.
// Handlers validate, parse, and pass root to service correctly.

const mockCustomizationService = () => {
  const listMock = vi.fn().mockResolvedValue([]);
  const getMock = vi.fn().mockResolvedValue({ id: 'test', body: '', frontmatter: {} });
  const saveMock = vi.fn().mockResolvedValue({ customization: { id: 'test', body: '', frontmatter: {} }, syncReport: [] });
  const deleteMock = vi.fn().mockResolvedValue({ ok: true });

  return {
    list: listMock,
    get: getMock,
    save: saveMock,
    delete: deleteMock,
  };
};

const mockDeps = (): IpcDeps => ({
  settingsService: {
    load: vi.fn(),
    save: vi.fn(),
    merge: vi.fn(),
  } as any,
  repoService: {} as any,
  customizationService: mockCustomizationService() as any,
  templateService: {} as any,
  adapterManager: {} as any,
  searchService: {} as any,
  dialogPort: {} as any,
  pluginService: {} as any,
  credentialStore: {} as any,
  skillService: {} as any,
  agentService: {} as any,
  referenceService: {} as any,
  globalInstructionService: {} as any,
  marketplaceService: {} as any,
});

const getHandler = (handlers: Record<string, IpcHandler>, key: string): IpcHandler => {
  const handler = handlers[key];
  if (!handler) throw new Error(`Handler ${key} not found`);
  return handler;
};

describe('customization root parameter parsing', () => {
  describe('customization.list', () => {
    it('calls service with plugin root when root="plugin:my-plugin"', async () => {
      const deps = mockDeps();
      const handlers = buildHandlers(deps);
      const handler = getHandler(handlers, 'customization.list');

      await handler({ root: 'plugin:my-plugin' });

      expect(deps.customizationService.list).toHaveBeenCalledWith(
        {},
        { kind: 'plugin', pluginId: 'my-plugin' }
      );
    });

    it('calls service with customizations root when root="customizations"', async () => {
      const deps = mockDeps();
      const handlers = buildHandlers(deps);
      const handler = getHandler(handlers, 'customization.list');

      await handler({ root: 'customizations' });

      expect(deps.customizationService.list).toHaveBeenCalledWith(
        {},
        { kind: 'customizations' }
      );
    });

    it('calls service with undefined root when root is absent', async () => {
      const deps = mockDeps();
      const handlers = buildHandlers(deps);
      const handler = getHandler(handlers, 'customization.list');

      await handler({});

      expect(deps.customizationService.list).toHaveBeenCalledWith({}, undefined);
    });

    it('throws validation error for invalid root value', async () => {
      const deps = mockDeps();
      const handlers = buildHandlers(deps);
      const handler = getHandler(handlers, 'customization.list');

      await expect(handler({ root: 'invalid' })).rejects.toThrow(
        expect.objectContaining({
          kind: 'validation',
          message: expect.stringContaining("Invalid 'root' value"),
        })
      );
    });

    it('throws validation error for empty plugin id', async () => {
      const deps = mockDeps();
      const handlers = buildHandlers(deps);
      const handler = getHandler(handlers, 'customization.list');

      await expect(handler({ root: 'plugin:' })).rejects.toThrow(
        expect.objectContaining({
          kind: 'validation',
          message: expect.stringContaining('plugin id cannot be empty'),
        })
      );
    });

    it('throws validation error for non-string root', async () => {
      const deps = mockDeps();
      const handlers = buildHandlers(deps);
      const handler = getHandler(handlers, 'customization.list');

      await expect(handler({ root: 123 })).rejects.toThrow(
        expect.objectContaining({
          kind: 'validation',
          message: expect.stringContaining("Invalid 'root'"),
        })
      );
    });
  });

  describe('customization.get', () => {
    it('calls service with plugin root when provided', async () => {
      const deps = mockDeps();
      const handlers = buildHandlers(deps);
      const handler = getHandler(handlers, 'customization.get');

      await handler({ id: 'test-id', root: 'plugin:my-plugin' });

      expect(deps.customizationService.get).toHaveBeenCalledWith({
        id: 'test-id',
        root: { kind: 'plugin', pluginId: 'my-plugin' },
      });
    });

    it('calls service without root when not provided', async () => {
      const deps = mockDeps();
      const handlers = buildHandlers(deps);
      const handler = getHandler(handlers, 'customization.get');

      await handler({ id: 'test-id' });

      expect(deps.customizationService.get).toHaveBeenCalledWith({
        id: 'test-id',
        root: undefined,
      });
    });
  });

  describe('customization.save', () => {
    it('calls service with plugin root when provided', async () => {
      const deps = mockDeps();
      const handlers = buildHandlers(deps);
      const handler = getHandler(handlers, 'customization.save');
      const customization = { id: 'test', body: '', frontmatter: { name: 'test', type: 'skill' as const, version: '1.0.0', scopes: ['personal'] as const, createdAt: '', updatedAt: '', description: '' } };

      await handler({
        customization,
        root: 'plugin:my-plugin',
      });

      expect(deps.customizationService.save).toHaveBeenCalledWith({
        customization,
        root: { kind: 'plugin', pluginId: 'my-plugin' },
      });
    });

    it('calls service without root when not provided', async () => {
      const deps = mockDeps();
      const handlers = buildHandlers(deps);
      const handler = getHandler(handlers, 'customization.save');
      const customization = { id: 'test', body: '', frontmatter: { name: 'test', type: 'skill' as const, version: '1.0.0', scopes: ['personal'] as const, createdAt: '', updatedAt: '', description: '' } };

      await handler({ customization });

      const callArgs = (deps.customizationService.save as any).mock.calls[0][0];
      expect(callArgs).toEqual({ customization });
      expect('root' in callArgs).toBe(false);
    });

    it('calls service with both root and isCreate', async () => {
      const deps = mockDeps();
      const handlers = buildHandlers(deps);
      const handler = getHandler(handlers, 'customization.save');
      const customization = { id: 'test', body: '', frontmatter: { name: 'test', type: 'skill' as const, version: '1.0.0', scopes: ['personal'] as const, createdAt: '', updatedAt: '', description: '' } };

      await handler({
        customization,
        root: 'plugin:my-plugin',
        isCreate: true,
      });

      expect(deps.customizationService.save).toHaveBeenCalledWith(
        expect.objectContaining({
          customization,
          root: { kind: 'plugin', pluginId: 'my-plugin' },
          isCreate: true,
        })
      );
    });
  });

  describe('customization.delete', () => {
    it('calls service with plugin root when provided', async () => {
      const deps = mockDeps();
      const handlers = buildHandlers(deps);
      const handler = getHandler(handlers, 'customization.delete');

      await handler({
        id: 'test-id',
        removeSymlinks: true,
        root: 'plugin:my-plugin',
      });

      expect(deps.customizationService.delete).toHaveBeenCalledWith({
        id: 'test-id',
        removeSymlinks: true,
        root: { kind: 'plugin', pluginId: 'my-plugin' },
      });
    });

    it('calls service without root when not provided', async () => {
      const deps = mockDeps();
      const handlers = buildHandlers(deps);
      const handler = getHandler(handlers, 'customization.delete');

      await handler({
        id: 'test-id',
        removeSymlinks: false,
      });

      const callArgs = (deps.customizationService.delete as any).mock.calls[0][0];
      expect(callArgs).toEqual({
        id: 'test-id',
        removeSymlinks: false,
      });
      expect('root' in callArgs).toBe(false);
    });
  });
});
