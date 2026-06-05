export type Severity = 'ok' | 'warning' | 'error';

export type HealthCategory = 'mcp-auth' | 'mcp-runtime' | 'config-drift' | 'symlink';

export interface HealthCheck {
  /** Stable id, e.g. "mcp-auth:claude.ai Gmail". Used for notification diffing. */
  id: string;
  category: HealthCategory;
  severity: Severity;
  title: string;
  detail?: string;
  /** MCP/plugin/symlink name this check is about. */
  target?: string;
  /** Actionable hint, e.g. "Run /mcp to authenticate". */
  remediation?: string;
  /** ISO timestamp, stamped by the service via ClockPort. */
  observedAt: string;
}

export interface HealthReport {
  generatedAt: string;
  /** Drives the nav badge color. */
  worst: Severity;
  counts: { ok: number; warning: number; error: number };
  checks: HealthCheck[];
}
