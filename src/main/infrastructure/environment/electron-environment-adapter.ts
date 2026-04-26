import { app } from 'electron';
import type { EnvironmentPort } from '../../application/ports/environment-port.js';

export class ElectronEnvironmentAdapter implements EnvironmentPort {
  getHomeDir(): string {
    return app.getPath('home');
  }
}
