import type { IpcHandlers } from './dispatcher.js';
import type { HealthService } from '../application/services/health/health-service.js';
import type { NotificationPort } from '../application/ports/notification-port.js';
import { asObject, asScope, asString, optParams } from './_validators.js';

export function buildHealthHandlers(
  healthService: HealthService,
  notificationPort: NotificationPort,
): IpcHandlers {
  return {
    'health.getReport': async (params) => {
      const raw = optParams(params, 'health.getReport');
      const scope = raw['scope'] === undefined ? 'personal' : asScope(raw['scope']);
      return healthService.getReport(scope);
    },

    'health.notify': async (params) => {
      const raw = asObject(params, 'health.notify');
      const title = asString(raw['title'], 'title');
      const body = asString(raw['body'], 'body');
      await notificationPort.notify({ title, body });
    },
  };
}
