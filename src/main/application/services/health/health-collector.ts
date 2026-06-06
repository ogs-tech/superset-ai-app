import type { HealthCategory, HealthCheck } from '../../../../shared/health.js';
import type { Scope } from '../../ports/scope.js';

/**
 * One collector per health source. Adding a future source = one new file
 * implementing this interface, zero changes to existing collectors.
 *
 * `scope` is passed uniformly to every collector, but only **scope-partitioned**
 * sources consume it: `config-drift` lists plugins per scope. The global sources
 * (`mcp-auth`, `mcp-runtime`, `symlink`) read Claude state that is not split by
 * scope — global MCP runtime files and every planned symlink destination across
 * all scopes — so they intentionally ignore `scope` and implement `collect()`
 * without the parameter. Do not "fix" that by wiring scope in: there is nothing
 * scope-specific for them to read.
 */
export interface HealthCollector {
  readonly category: HealthCategory;
  collect(scope: Scope): Promise<HealthCheck[]>;
}
