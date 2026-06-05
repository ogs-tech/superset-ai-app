import { Notification } from 'electron';
import type { NotificationPort } from '../../application/ports/notification-port.js';

export class ElectronNotificationAdapter implements NotificationPort {
  async notify(args: { title: string; body: string }): Promise<void> {
    if (!Notification.isSupported()) return;
    new Notification({ title: args.title, body: args.body }).show();
  }
}
