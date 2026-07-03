import { describe, expect, it } from 'vitest';
import type { Adapter } from '../adapter.js';

const fakeAdapter: Adapter = {
  adapterId: 'fake',
  resolveEntityDestinations: () => [],
};

describe('Adapter port contract', () => {
  it('exports only adapterId and resolveEntityDestinations', () => {
    const keys = Object.keys(fakeAdapter);
    expect(keys).toEqual(['adapterId', 'resolveEntityDestinations']);
  });

  it('satisfies Adapter interface shape', () => {
    expect(fakeAdapter.adapterId).toBe('fake');
    expect(typeof fakeAdapter.resolveEntityDestinations).toBe('function');
  });
});
