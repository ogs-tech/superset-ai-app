import { shell } from 'electron';
import type { ShellPort } from '../../application/ports/shell-port.js';

export class ElectronShell implements ShellPort {
  async openExternal(url: string): Promise<void> {
    await shell.openExternal(url);
  }
}
