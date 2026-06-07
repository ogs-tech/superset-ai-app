import { mkdtemp, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { McpDisabledStash } from '../../../../src/main/infrastructure/mcp/mcp-disabled-stash.js';

describe('McpDisabledStash', () => {
  let tmp: string;
  let stashPath: string;
  beforeEach(async () => {
    tmp = await mkdtemp(path.join(os.tmpdir(), 'mcp-stash-'));
    stashPath = path.join(tmp, 'mcp-disabled.json');
  });
  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it('parks a def and lists it; take() removes and returns it', async () => {
    const stash = new McpDisabledStash({ stashPath });
    await stash.park('id1', { command: 'x' });
    expect(await stash.list()).toEqual([{ id: 'id1', def: { command: 'x' } }]);
    expect(await stash.take('id1')).toEqual({ command: 'x' });
    expect(await stash.list()).toEqual([]);
  });

  it('persists across instances and tolerates a missing file', async () => {
    expect(await new McpDisabledStash({ stashPath }).list()).toEqual([]);
    await new McpDisabledStash({ stashPath }).park('id2', { type: 'http', url: 'https://x.dev' });
    const json = JSON.parse(await readFile(stashPath, 'utf8'));
    expect(json['id2']).toEqual({ type: 'http', url: 'https://x.dev' });
  });

  it('take() of an unknown id returns undefined', async () => {
    expect(await new McpDisabledStash({ stashPath }).take('nope')).toBeUndefined();
  });
});
