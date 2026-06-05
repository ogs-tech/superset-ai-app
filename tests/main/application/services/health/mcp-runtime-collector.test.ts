import { describe, expect, it } from 'vitest';
import { McpRuntimeCollector } from '../../../../../src/main/application/services/health/mcp-runtime-collector.js';
import { FakeClaudeRuntimePort } from '../../../../../src/main/application/services/__fixtures__/fake-claude-runtime-port.js';
import { FixedClock } from '../../../../../src/main/infrastructure/clock/fixed-clock.js';

const FROZEN = new Date('2026-06-05T10:00:00.000Z');

const setup = () => {
  const runtime = new FakeClaudeRuntimePort();
  const collector = new McpRuntimeCollector(runtime, new FixedClock(FROZEN));
  return { runtime, collector };
};

const byTarget = (
  checks: Awaited<ReturnType<McpRuntimeCollector['collect']>>,
  target: string,
) => checks.find((c) => c.target === target);

describe('McpRuntimeCollector', () => {
  it('reports category mcp-runtime', () => {
    const { collector } = setup();
    expect(collector.category).toBe('mcp-runtime');
  });

  it('returns no checks when nothing is configured or logged', async () => {
    const { collector } = setup();
    await expect(collector.collect('personal')).resolves.toEqual([]);
  });

  it('reports a configured server with no logs as ok', async () => {
    const { runtime, collector } = setup();
    runtime.seedServers([{ name: 'gmail', source: 'global' }]);

    const checks = await collector.collect('personal');

    expect(checks).toHaveLength(1);
    expect(byTarget(checks, 'gmail')).toMatchObject({
      category: 'mcp-runtime',
      severity: 'ok',
      observedAt: FROZEN.toISOString(),
    });
  });

  it('maps a failing log session to an error check with remediation', async () => {
    const { runtime, collector } = setup();
    runtime.seedServers([{ name: 'gmail', source: 'global' }]);
    runtime.seedRuntimeLogs([{ server: 'gmail', state: 'error', detail: 'timed out' }]);

    const check = byTarget(await collector.collect('personal'), 'gmail');

    expect(check).toMatchObject({
      severity: 'error',
      detail: 'timed out',
      remediation: expect.stringContaining('restart'),
    });
  });

  it('includes servers seen only in logs (not in config)', async () => {
    const { runtime, collector } = setup();
    runtime.seedRuntimeLogs([{ server: 'orphan', state: 'warning' }]);

    const check = byTarget(await collector.collect('personal'), 'orphan');
    expect(check?.severity).toBe('warning');
  });
});
