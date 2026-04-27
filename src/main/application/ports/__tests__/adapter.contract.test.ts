import { describe, expect, it } from 'vitest';
import type { Adapter } from '../adapter.js';

const fakeAdapter: Adapter = {
  adapterId: 'fake',
  resolveDestinations: () => [{ scope: 'personal', destination: '/tmp/dest' }],
};

describe('Adapter port contract', () => {
  it('exports only adapterId and resolveDestinations', () => {
    const keys = Object.keys(fakeAdapter);
    expect(keys).toEqual(['adapterId', 'resolveDestinations']);
  });

  it('satisfies Adapter interface shape', () => {
    expect(fakeAdapter.adapterId).toBe('fake');
    expect(typeof fakeAdapter.resolveDestinations).toBe('function');
  });
});
