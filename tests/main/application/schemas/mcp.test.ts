import { describe, it, expect } from 'vitest';
import { mcpServerDefSchema, transportOf } from '../../../../src/main/application/schemas/mcp.js';

describe('mcpServerDefSchema', () => {
  it('accepts a stdio server and reports transport stdio', () => {
    const def = { command: 'npx', args: ['-y', 'x'], env: { A: '1' } };
    const parsed = mcpServerDefSchema.parse(def);
    expect(transportOf(parsed)).toBe('stdio');
  });

  it('accepts http and sse servers', () => {
    expect(transportOf(mcpServerDefSchema.parse({ type: 'http', url: 'https://x.dev' }))).toBe('http');
    expect(transportOf(mcpServerDefSchema.parse({ type: 'sse', url: 'https://x.dev' }))).toBe('sse');
  });

  it('preserves unknown fields (passthrough)', () => {
    const parsed = mcpServerDefSchema.parse({ command: 'x', timeout: 30000, foo: 'bar' }) as Record<string, unknown>;
    expect(parsed['timeout']).toBe(30000);
    expect(parsed['foo']).toBe('bar');
  });

  it('rejects a def with neither command nor url', () => {
    expect(() => mcpServerDefSchema.parse({ type: 'stdio' })).toThrow();
    expect(() => mcpServerDefSchema.parse({})).toThrow();
  });
});
