import { describe, expect, it } from 'vitest';
import {
  classifyMcpLog,
  type McpLogLine,
} from '../../../../../src/main/application/services/health/mcp-log-classifier.js';

const line = (over: Partial<McpLogLine>): McpLogLine => ({ sessionId: 's1', ...over });

describe('classifyMcpLog', () => {
  it('classifies an empty session as ok', () => {
    expect(classifyMcpLog([]).state).toBe('ok');
  });

  it('treats INFO-only stderr as ok (error field is NOT a failure)', () => {
    const lines = [
      line({ error: 'Server stderr: INFO Connector starting' }),
      line({ error: 'Server stderr: INFO Connected to upstream' }),
      line({ debug: 'tools/list' }),
    ];
    expect(classifyMcpLog(lines).state).toBe('ok');
  });

  it('classifies a real connection failure as error', () => {
    const result = classifyMcpLog([
      line({ error: 'Server stderr: INFO starting' }),
      line({ error: 'Connection to MCP server "gmail" timed out' }),
    ]);
    expect(result.state).toBe('error');
    expect(result.detail).toContain('timed out');
  });

  it('classifies "failed to connect" as error', () => {
    expect(
      classifyMcpLog([line({ error: 'failed to connect to server gmail' })]).state,
    ).toBe('error');
  });

  it('classifies a non-zero exit as error', () => {
    expect(
      classifyMcpLog([line({ error: 'Server process exited with code 1' })]).state,
    ).toBe('error');
  });

  it('classifies a WARNING (no failure signal) as warning', () => {
    const result = classifyMcpLog([line({ error: 'Server stderr: WARNING deprecated flag' })]);
    expect(result.state).toBe('warning');
    expect(result.detail).toContain('WARNING');
  });

  it('only considers the newest session', () => {
    const lines = [
      line({ sessionId: 'old', error: 'failed to connect' }),
      line({ sessionId: 'new', error: 'Server stderr: INFO healthy' }),
    ];
    const result = classifyMcpLog(lines);
    expect(result.state).toBe('ok');
    expect(result.sessionId).toBe('new');
  });
});
