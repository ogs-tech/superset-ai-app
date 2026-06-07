import { describe, it, expect } from 'vitest';
import { buildDef } from '../../../../src/renderer/screens/mcps/McpEditorDialog.js';

describe('buildDef', () => {
  it('switching http->stdio drops url/headers, keeps passthrough, sets command', () => {
    const base = { type: 'http', url: 'https://x.dev', headers: { A: '1' }, timeout: 5000 };
    const def = buildDef(base, 'stdio', 'my-cmd', '');
    expect(def).toEqual({ command: 'my-cmd', timeout: 5000 });
  });

  it('switching stdio->http drops command/args/env, keeps passthrough, sets type+url', () => {
    const base = { command: 'old', args: ['-y'], env: { A: '1' }, timeout: 5000 };
    const def = buildDef(base, 'http', '', 'https://y.dev');
    expect(def).toEqual({ type: 'http', url: 'https://y.dev', timeout: 5000 });
  });

  it('stdio->stdio preserves passthrough args/env and updates command', () => {
    const base = { command: 'old', args: ['-y'], env: { A: '1' } };
    const def = buildDef(base, 'stdio', 'new', '');
    expect(def).toEqual({ command: 'new', args: ['-y'], env: { A: '1' } });
  });

  it('sse sets type sse and url', () => {
    const def = buildDef({}, 'sse', '', 'https://s.dev');
    expect(def).toEqual({ type: 'sse', url: 'https://s.dev' });
  });
});
