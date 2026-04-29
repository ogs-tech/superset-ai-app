import type { Artifact, ArtifactFrontmatter, SyncResult } from '../../../shared/artifact.js';
import type { ClockPort } from '../../application/ports/clock-port.js';
import type {
  ArtifactDeleteCommand,
  ArtifactListQuery,
  ArtifactRepository,
} from '../../application/ports/artifact-repository.js';
import type { AdapterManager } from './adapter-manager.js';
import { formatArtifactId } from '../../domain/artifact-id.js';
import { isValidArtifactName } from '../../domain/artifact-name.js';
import { DomainError, validationError } from '../../domain/errors.js';

const REQUIRED_FIELDS: Array<keyof ArtifactFrontmatter> = [
  'name',
  'type',
  'description',
  'version',
];
const DESCRIPTION_MAX_LENGTH = 200;

export interface SaveArtifactCommand {
  artifact: Artifact;
  isCreate?: boolean;
}

export interface SaveArtifactResult {
  artifact: Artifact;
  syncReport: SyncResult[];
}

export interface DeleteArtifactCommand {
  id: string;
  removeSymlinks: boolean;
}

export interface DeleteArtifactResult {
  ok: true;
  syncReport?: SyncResult[];
}

export class ArtifactService {
  constructor(
    private readonly repository: ArtifactRepository,
    private readonly clock: ClockPort,
    private readonly adapterManager: AdapterManager,
  ) {}

  list(query: ArtifactListQuery = {}): Promise<Artifact[]> {
    return this.repository.list(query);
  }

  get(query: { id: string }): Promise<Artifact> {
    return this.repository.get(query);
  }

  async save(command: SaveArtifactCommand): Promise<SaveArtifactResult> {
    const { artifact, isCreate = false } = command;
    this.validate(artifact);

    const id = formatArtifactId(artifact.frontmatter.type, artifact.frontmatter.name);
    const previousId = artifact.id;
    const isRename = !isCreate && previousId !== '' && previousId !== id;
    const exists = await this.repository.exists({ id });

    if (isCreate && exists) {
      throw validationError({
        message: `Artifact already exists: ${id}`,
        details: { conflict: id },
      });
    }

    if (isRename && exists) {
      throw validationError({
        message: `Artifact already exists: ${id}`,
        details: { conflict: id },
      });
    }

    const nowIso = this.clock.now().toISOString();
    let createdAt = nowIso;
    let previousArtifact: Artifact | undefined;
    if (isRename) {
      previousArtifact = await this.repository.get({ id: previousId });
      createdAt = previousArtifact.frontmatter.createdAt || nowIso;
    } else if (exists) {
      const previous = await this.repository.get({ id });
      createdAt = previous.frontmatter.createdAt || nowIso;
    }

    const persisted: Artifact = {
      id,
      frontmatter: {
        ...artifact.frontmatter,
        createdAt,
        updatedAt: nowIso,
      },
      body: artifact.body,
    };

    const saved = await this.repository.save({ artifact: persisted });

    const removeReport: SyncResult[] = [];
    if (isRename && previousArtifact) {
      const removed = await this.adapterManager.removeOne({ artifact: previousArtifact });
      removeReport.push(...removed);
      await this.repository.delete({ id: previousId });
    }

    const syncReport = await this.adapterManager.syncOne({ artifact: saved });
    return { artifact: saved, syncReport: [...removeReport, ...syncReport] };
  }

  async delete(command: DeleteArtifactCommand): Promise<DeleteArtifactResult> {
    let syncReport: SyncResult[] | undefined;
    if (command.removeSymlinks) {
      const artifact = await this.repository.get({ id: command.id });
      syncReport = await this.adapterManager.removeOne({ artifact });
    }
    const repoCommand: ArtifactDeleteCommand = { id: command.id };
    await this.repository.delete(repoCommand);
    return syncReport === undefined ? { ok: true } : { ok: true, syncReport };
  }

  private validate(artifact: Artifact): void {
    const fm = artifact.frontmatter;
    const missing: string[] = [];
    for (const field of REQUIRED_FIELDS) {
      const value = fm[field];
      if (value === undefined || value === null || value === '') {
        missing.push(field);
      }
    }
    if (missing.length > 0) {
      throw validationError({
        message: `Missing required field(s): ${missing.join(', ')}`,
        details: { missing },
      });
    }

    const invalid: string[] = [];
    if (!isValidArtifactName(fm.name)) invalid.push('name');
    if (fm.description.length > DESCRIPTION_MAX_LENGTH) invalid.push('description');
    if (!Array.isArray(fm.scopes) || fm.scopes.length === 0) invalid.push('scopes');
    if (invalid.length > 0) {
      throw validationError({
        message: `Invalid field(s): ${invalid.join(', ')}`,
        details: { invalid },
      });
    }
  }
}

export { DomainError };
