import type { Severity, HealthCheck, HealthReport } from '../../shared/health.js';

const RANK: Record<Severity, number> = { ok: 0, warning: 1, error: 2 };

export function worstSeverity(severities: readonly Severity[]): Severity {
  return severities.reduce<Severity>(
    (worst, current) => (RANK[current] > RANK[worst] ? current : worst),
    'ok',
  );
}

export function countBySeverity(checks: readonly HealthCheck[]): HealthReport['counts'] {
  const counts = { ok: 0, warning: 0, error: 0 };
  for (const check of checks) {
    counts[check.severity] += 1;
  }
  return counts;
}
