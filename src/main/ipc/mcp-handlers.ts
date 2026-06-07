import type { IpcHandlers } from './dispatcher.js';
import type { McpService } from '../application/services/mcp-service.js';
import { asObject, asString } from './_validators.js';

export function buildMcpHandlers(service: McpService): IpcHandlers {
  return {
    'mcp.list': async () => service.list(),

    'mcp.get': async (params) => {
      const raw = asObject(params, 'mcp.get');
      return service.get(asString(raw['id'], 'id'));
    },
  };
}
