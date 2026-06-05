import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FsClaudeRuntimeReader } from '../../../../src/main/infrastructure/claude-runtime/fs-claude-runtime-reader.js';

const jsonl = (lines: object[]): string => lines.map((l) => JSON.stringify(l)).join('\n');

describe('FsClaudeRuntimeReader', () => {
  let work: string;
  let claudeJsonPath: string;
  let authCachePath: string;
  let mcpLogsBaseDir: string;
  let reader: FsClaudeRuntimeReader;

  beforeEach(async () => {
    work = await mkdtemp(join(tmpdir(), 'sde-claude-runtime-'));
    claudeJsonPath = join(work, '.claude.json');
    authCachePath = join(work, 'mcp-needs-auth-cache.json');
    mcpLogsBaseDir = join(work, 'caches', 'claude-cli-nodejs');
    reader = new FsClaudeRuntimeReader({ claudeJsonPath, authCachePath, mcpLogsBaseDir });
  });

  afterEach(async () => {
    await rm(work, { recursive: true, force: true });
  });

  describe('readMcpServers', () => {
    it('returns [] when ~/.claude.json is missing', async () => {
      await expect(reader.readMcpServers()).resolves.toEqual([]);
    });

    it('reads global mcpServers keys', async () => {
      await writeFile(
        claudeJsonPath,
        JSON.stringify({ mcpServers: { gmail: {}, 'google-drive': {} } }),
        'utf8',
      );
      const servers = await reader.readMcpServers();
      expect(servers).toEqual([
        { name: 'gmail', source: 'global' },
        { name: 'google-drive', source: 'global' },
      ]);
    });
  });

  describe('readMcpAuthAlerts', () => {
    it('returns [] when the auth cache is missing', async () => {
      await expect(reader.readMcpAuthAlerts()).resolves.toEqual([]);
    });

    it('reads server names from an object-keyed cache', async () => {
      await writeFile(authCachePath, JSON.stringify({ Gmail: true, Calendar: true }), 'utf8');
      await expect(reader.readMcpAuthAlerts()).resolves.toEqual([
        { name: 'Gmail' },
        { name: 'Calendar' },
      ]);
    });

    it('reads server names from an array cache', async () => {
      await writeFile(authCachePath, JSON.stringify(['Gmail']), 'utf8');
      await expect(reader.readMcpAuthAlerts()).resolves.toEqual([{ name: 'Gmail' }]);
    });
  });

  describe('readMcpRuntimeLogs', () => {
    it('returns [] when the logs base dir is missing', async () => {
      await expect(reader.readMcpRuntimeLogs()).resolves.toEqual([]);
    });

    it('classifies an INFO-only session as ok and a timeout as error', async () => {
      const project = join(mcpLogsBaseDir, '-Users-me-proj');
      const okDir = join(project, 'mcp-logs-healthy');
      const badDir = join(project, 'mcp-logs-broken');
      await mkdir(okDir, { recursive: true });
      await mkdir(badDir, { recursive: true });

      await writeFile(
        join(okDir, 'session.jsonl'),
        jsonl([{ error: 'Server stderr: INFO ok', sessionId: 's1' }]),
        'utf8',
      );
      await writeFile(
        join(badDir, 'session.jsonl'),
        jsonl([{ error: 'Connection timed out', sessionId: 's1' }]),
        'utf8',
      );

      const summaries = await reader.readMcpRuntimeLogs();
      const healthy = summaries.find((s) => s.server === 'healthy');
      const broken = summaries.find((s) => s.server === 'broken');

      expect(healthy?.state).toBe('ok');
      expect(broken?.state).toBe('error');
    });
  });
});
