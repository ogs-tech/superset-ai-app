import type {
  ClaudeRuntimePort,
  McpServerConfig,
  McpAuthAlert,
  McpLogSummary,
} from '../../ports/claude-runtime-port.js';

export class FakeClaudeRuntimePort implements ClaudeRuntimePort {
  private servers: McpServerConfig[] = [];
  private alerts: McpAuthAlert[] = [];
  private logs: McpLogSummary[] = [];

  seedServers(servers: McpServerConfig[]): void {
    this.servers = servers;
  }

  seedAuthAlerts(alerts: McpAuthAlert[]): void {
    this.alerts = alerts;
  }

  seedRuntimeLogs(logs: McpLogSummary[]): void {
    this.logs = logs;
  }

  readMcpServers(): Promise<McpServerConfig[]> {
    return Promise.resolve(this.servers);
  }

  readMcpAuthAlerts(): Promise<McpAuthAlert[]> {
    return Promise.resolve(this.alerts);
  }

  readMcpRuntimeLogs(): Promise<McpLogSummary[]> {
    return Promise.resolve(this.logs);
  }
}
