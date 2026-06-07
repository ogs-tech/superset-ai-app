import { describe, it, expect } from 'vitest';
import { PluginProvenanceService } from '../../../../src/main/application/services/plugin-provenance.js';

describe('PluginProvenanceService.roots', () => {
  it('returns [] when no deps are configured', async () => {
    const svc = new PluginProvenanceService();
    expect(await svc.roots('personal')).toEqual([]);
  });
});
