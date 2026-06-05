import type { HealthCategory, HealthCheck } from '../../../../shared/health.js';
import type { Scope } from '../../ports/scope.js';

/**
 * One collector per health source. Adding a future source = one new file
 * implementing this interface, zero changes to existing collectors.
 */
export interface HealthCollector {
  readonly category: HealthCategory;
  collect(scope: Scope): Promise<HealthCheck[]>;
}
