import type { McpLogState } from '../../ports/claude-runtime-port.js';

/** One parsed line of an mcp-logs-<server>/*.jsonl file. */
export interface McpLogLine {
  error?: string;
  debug?: unknown;
  timestamp?: string;
  sessionId?: string;
}

export interface McpLogClassification {
  state: McpLogState;
  detail?: string;
  sessionId?: string;
}

// Real failure signals. The `error` field captures ALL server stderr (including
// normal INFO/WARNING lines), so "has an error field" != "failed". Only these match.
const FAILURE_SIGNALS: readonly RegExp[] = [
  /failed to connect/i,
  /connection .*(?:timed out|timeout)/i,
  /\btimed out\b/i,
  /ECONNREFUSED/i,
  /exited with (?:code )?[1-9]/i,
  /non-zero exit/i,
];

function isFailure(message: string): boolean {
  return FAILURE_SIGNALS.some((re) => re.test(message));
}

export function classifyMcpLog(lines: readonly McpLogLine[]): McpLogClassification {
  if (lines.length === 0) return { state: 'ok' };

  // Newest session = sessionId of the last line that carries one.
  const lastWithSession = [...lines].reverse().find((l) => typeof l.sessionId === 'string');
  const sessionId = lastWithSession?.sessionId;
  const sessionLines =
    sessionId !== undefined ? lines.filter((l) => l.sessionId === sessionId) : lines;

  let state: McpLogState = 'ok';
  let detail: string | undefined;

  for (const line of sessionLines) {
    if (typeof line.error !== 'string') continue;
    if (isFailure(line.error)) {
      return {
        state: 'error',
        detail: line.error,
        ...(sessionId !== undefined ? { sessionId } : {}),
      };
    }
    if (state === 'ok' && /\bwarn(?:ing)?\b/i.test(line.error)) {
      state = 'warning';
      detail = line.error;
    }
  }

  return {
    state,
    ...(detail !== undefined ? { detail } : {}),
    ...(sessionId !== undefined ? { sessionId } : {}),
  };
}
