export interface NotificationPort {
  notify(args: { title: string; body: string }): Promise<void>;
}
