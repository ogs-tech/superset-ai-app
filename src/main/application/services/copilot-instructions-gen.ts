import { join } from 'node:path';
import type { ArtifactRepository } from '../ports/artifact-repository.js';
import type { WritableFileSystemPort } from '../ports/writable-filesystem-port.js';
import type { GenerateResult } from '../ports/copilot-instructions-gen.js';

export type { GenerateResult };

const HEADER = '<!-- GENERATED — edit references in the app -->\n\n';
const SEPARATOR = '\n\n---\n\n';
const GENERATED_FILENAME = '_generated/copilot-instructions.md';
const READ_ONLY_MODE = 0o444;
const READ_WRITE_MODE = 0o644;

export interface CopilotInstructionsGenDeps {
  artifactRepository: ArtifactRepository;
  workspaceFs: WritableFileSystemPort;
  workspacePath: string;
}

export class CopilotInstructionsGen {
  private readonly artifactRepository: ArtifactRepository;
  private readonly workspaceFs: WritableFileSystemPort;
  private readonly workspacePath: string;

  constructor(deps: CopilotInstructionsGenDeps) {
    this.artifactRepository = deps.artifactRepository;
    this.workspaceFs = deps.workspaceFs;
    this.workspacePath = deps.workspacePath;
  }

  async generate(): Promise<GenerateResult> {
    const path = join(this.workspacePath, GENERATED_FILENAME);

    const refs = await this.artifactRepository.list({ type: 'reference' });

    if (refs.length === 0) {
      const existing = await this.workspaceFs.stat(path);
      if (existing !== null) {
        await this.workspaceFs.chmod(path, READ_WRITE_MODE);
        await this.workspaceFs.unlink(path);
      }
      return { path, refsIncluded: 0 };
    }

    const collator = new Intl.Collator('en');
    const sorted = [...refs].sort((a, b) => {
      const byName = collator.compare(a.frontmatter.name, b.frontmatter.name);
      if (byName !== 0) return byName;
      return collator.compare(a.id, b.id);
    });

    const content = HEADER + sorted.map((a) => a.body).join(SEPARATOR);
    await this.writeReadOnly(path, content);

    return { path, refsIncluded: refs.length };
  }

  private async writeReadOnly(path: string, content: string): Promise<void> {
    const existing = await this.workspaceFs.stat(path);
    if (existing !== null) {
      await this.workspaceFs.chmod(path, READ_WRITE_MODE);
    }

    const tempPath = `${path}.tmp`;
    await this.workspaceFs.mkdir(join(this.workspacePath, '_generated'), { recursive: true });
    await this.workspaceFs.writeFile(tempPath, content);
    await this.workspaceFs.rename(tempPath, path);
    await this.workspaceFs.chmod(path, READ_ONLY_MODE);
  }
}
