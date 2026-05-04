import type { FsWorkspacePointerRepository } from '../../infrastructure/workspace/fs-workspace-pointer-repository.js';

export interface WorkspaceLocatorDeps {
  pointerRepo: FsWorkspacePointerRepository;
  envValue: () => string | undefined;
  defaultPath: string;
}

export class WorkspaceLocator {
  constructor(private readonly deps: WorkspaceLocatorDeps) {}

  async resolve(): Promise<string> {
    const env = this.deps.envValue();
    if (typeof env === 'string' && env.length > 0) return env;
    const pointed = await this.deps.pointerRepo.read();
    if (pointed !== null) return pointed;
    return this.deps.defaultPath;
  }

  async setActive(workspacePath: string): Promise<void> {
    await this.deps.pointerRepo.save(workspacePath);
  }
}
