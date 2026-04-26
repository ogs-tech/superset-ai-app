import type { ClockPort } from '../../application/ports/clock-port.js';

export class FixedClock implements ClockPort {
  constructor(private current: Date) {}

  now(): Date {
    return new Date(this.current.getTime());
  }

  set(date: Date): void {
    this.current = new Date(date.getTime());
  }
}
