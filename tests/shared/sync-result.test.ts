import { describe, it, expect } from 'vitest';
import type { SyncResult } from '../../src/shared/sync-result.js';

describe('SyncResult', () => {
  it('accepts an ok result with a destination', () => {
    const r: SyncResult = { adapter: 'claude', destination: '/x', status: 'ok' };
    expect(r.status).toBe('ok');
  });
});
