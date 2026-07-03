import { describe, expect, it } from 'vitest';
import { GeneratedFileCollector } from '../../../../../src/main/application/services/health/generated-file-collector.js';
import { FixedClock } from '../../../../../src/main/infrastructure/clock/fixed-clock.js';
import type { GeneratedFilePlanEntry } from '../../../../../src/main/application/services/adapter-manager.js';
import type { GeneratedFileState } from '../../../../../src/main/application/services/file-materializer.js';
import type { Settings } from '../../../../../src/shared/settings.js';

const clock = new FixedClock(new Date('2026-07-02T10:00:00.000Z'));
const settings = (over: Partial<Settings>): Settings => ({
  adapters: { claude: { enabled: true }, cursor: { enabled: false } },
  linkedRepos: [{ id: 'r', name: 'app', path: '/repos/app' }],
  ui: { theme: 'system' }, language: 'off', ...over,
});

const make = (opts: {
  plan: GeneratedFilePlanEntry[];
  state: GeneratedFileState;
  settings: Settings;
}) =>
  new GeneratedFileCollector(
    { planGeneratedFiles: () => Promise.resolve(opts.plan) },
    { validate: () => Promise.resolve(opts.state) },
    { load: () => Promise.resolve(opts.settings), getDefaults: () => opts.settings },
    clock,
  );

describe('GeneratedFileCollector', () => {
  it('reports ok for a matching generated file', async () => {
    const collector = make({
      plan: [{ adapterId: 'cursor', destination: '/repos/app/AGENTS.md', content: 'x' }],
      state: 'ok',
      settings: settings({}),
    });
    const checks = await collector.collect('personal');
    expect(checks).toHaveLength(1);
    expect(checks[0]).toMatchObject({ category: 'generated-file', severity: 'ok', target: '/repos/app/AGENTS.md' });
  });

  it('reports error for a missing file and warning for drift/foreign', async () => {
    for (const [state, severity] of [['missing', 'error'], ['drift', 'warning'], ['foreign', 'warning']] as const) {
      const collector = make({
        plan: [{ adapterId: 'cursor', destination: '/repos/app/AGENTS.md', content: 'x' }],
        state,
        settings: settings({}),
      });
      const checks = await collector.collect('personal');
      expect(checks[0]?.severity).toBe(severity);
    }
  });

  it('warns when cursor is enabled but no repo is linked', async () => {
    const collector = make({
      plan: [],
      state: 'ok',
      settings: settings({ adapters: { claude: { enabled: true }, cursor: { enabled: true } }, linkedRepos: [] }),
    });
    const checks = await collector.collect('personal');
    expect(checks).toHaveLength(1);
    expect(checks[0]).toMatchObject({ severity: 'warning', id: 'generated-file:cursor:no-linked-repos' });
  });

  it('emits no notice when cursor is disabled', async () => {
    const collector = make({
      plan: [],
      state: 'ok',
      settings: settings({ adapters: { claude: { enabled: true }, cursor: { enabled: false } }, linkedRepos: [] }),
    });
    expect(await collector.collect('personal')).toEqual([]);
  });
});
