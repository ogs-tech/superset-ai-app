import type { HealthCheck, HealthReport } from '../../../../shared/health.js';
import type { ClockPort } from '../../ports/clock-port.js';
import type { Scope } from '../../ports/scope.js';
import { worstSeverity, countBySeverity } from '../../../domain/health.js';
import type { HealthCollector } from './health-collector.js';

export class HealthService {
  constructor(
    private readonly collectors: readonly HealthCollector[],
    private readonly clock: ClockPort,
  ) {}

  async getReport(scope: Scope): Promise<HealthReport> {
    const results = await Promise.all(
      this.collectors.map((collector) => this.runIsolated(collector, scope)),
    );
    const checks = results.flat();
    return {
      generatedAt: this.clock.now().toISOString(),
      worst: worstSeverity(checks.map((c) => c.severity)),
      counts: countBySeverity(checks),
      checks,
    };
  }

  private async runIsolated(collector: HealthCollector, scope: Scope): Promise<HealthCheck[]> {
    try {
      return await collector.collect(scope);
    } catch (err) {
      return [
        {
          id: `collector-error:${collector.category}`,
          category: collector.category,
          severity: 'error',
          title: `Health check failed: ${collector.category}`,
          detail: err instanceof Error ? err.message : String(err),
          observedAt: this.clock.now().toISOString(),
        },
      ];
    }
  }
}
