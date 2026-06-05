import type { Result } from './plugin-id.js';
import { AgentIdInvalidError } from './customization-errors.js';
export { AgentIdInvalidError };

export type AgentId = string & { __brand: 'AgentId' };

const AGENT_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

function reasonFor(raw: string): string {
  if (raw.length === 0) return 'cannot be empty';
  if (raw.length > 64) return 'cannot exceed 64 characters';
  if (!/^[a-z0-9]/.test(raw)) return 'must start with lowercase letter or digit';
  if (!/[a-z0-9]$/.test(raw)) return 'cannot end with hyphen';
  return 'can only contain lowercase letters, digits, and hyphens';
}

export function agentId(raw: string): AgentId {
  const result = tryAgentId(raw);
  if (!result.ok) throw result.error;
  return result.value;
}

export function tryAgentId(raw: string): Result<AgentId, AgentIdInvalidError> {
  if (typeof raw !== 'string') {
    return {
      ok: false,
      error: new AgentIdInvalidError(`Invalid agent ID: expected string, got ${typeof raw}`, {
        raw: String(raw),
      }),
    };
  }
  if (!AGENT_ID_PATTERN.test(raw)) {
    return {
      ok: false,
      error: new AgentIdInvalidError(`Invalid agent ID: '${raw}' (${reasonFor(raw)})`, { raw }),
    };
  }
  return { ok: true, value: raw as AgentId };
}

export function isValidAgentId(value: unknown): value is AgentId {
  return typeof value === 'string' && AGENT_ID_PATTERN.test(value);
}
