import { describe, expect, it, vi } from 'vitest';
import { WorkspaceTeardownService } from '../../../../src/main/application/services/workspace-teardown.js';

const WORKSPACE = '/home/user/.superset-ai-app';

const buildService = () => {
  const order: string[] = [];
  const removeAllAdapterSymlinks = vi.fn(async () => {
    order.push('symlinks');
    return { removed: 0, skipped: 0, errors: [] };
  });
  const remove = vi.fn(async (path: string) => {
    order.push(`remove:${path}`);
  });
  const service = new WorkspaceTeardownService(
    { removeAllAdapterSymlinks },
    { remove },
    WORKSPACE,
  );
  return { service, removeAllAdapterSymlinks, remove, order };
};

describe('WorkspaceTeardownService.restore', () => {
  it('deletes only the workspace directory through the filesystem port', async () => {
    const { service, remove } = buildService();

    await service.restore();

    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith(WORKSPACE);
  });

  it('never targets ~/.claude or any .env.local — only the app workspace', async () => {
    const { service, remove } = buildService();

    await service.restore();

    const removedPaths = remove.mock.calls.map(([path]) => path);
    expect(removedPaths).toEqual([WORKSPACE]);
    expect(removedPaths.some((p) => p.includes('.claude'))).toBe(false);
    expect(removedPaths.some((p) => p.includes('.env.local'))).toBe(false);
  });

  it('removes app-created symlinks before deleting the workspace directory', async () => {
    const { service, removeAllAdapterSymlinks, order } = buildService();

    await service.restore();

    expect(removeAllAdapterSymlinks).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['symlinks', `remove:${WORKSPACE}`]);
  });
});
