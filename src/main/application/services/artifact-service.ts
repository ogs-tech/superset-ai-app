import type { Artifact, ArtifactFrontmatter, SyncResult } from '../../../shared/artifact.js';
import type { ClockPort } from '../../application/ports/clock-port.js';
import type {
  ArtifactDeleteCommand,
  ArtifactListQuery,
  ArtifactRepository,
} from '../../application/ports/artifact-repository.js';
import type { AdapterManager } from './adapter-manager.js';
import { formatArtifactId } from '../../domain/artifact-id.js';
import { DomainError, validationError } from '../../domain/errors.js';

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]*$/;
const REQUIRED_FIELDS: Array<keyof ArtifactFrontmatter> = [
  'slug',
  'name',
  'type',
  'description',
  'scope',
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

    const id = formatArtifactId(artifact.frontmatter.type, artifact.frontmatter.slug);
    const exists = await this.repository.exists({ id });

    if (isCreate && exists) {
      throw validationError({
        message: `Artifact already exists: ${id}`,
        details: { conflict: id },
      });
    }

    const nowIso = this.clock.now().toISOString();
    let createdAt = nowIso;
    if (exists) {
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
    const syncReport = await this.adapterManager.syncOne({ artifact: saved });
    return { artifact: saved, syncReport };
  }

  async delete(command: DeleteArtifactCommand): Promise<DeleteArtifactResult> {
    const repoCommand: ArtifactDeleteCommand = { id: command.id };
    await this.repository.delete(repoCommand);
    return { ok: true };
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
    if (!SLUG_REGEX.test(fm.slug)) invalid.push('slug');
    if (fm.description.length > DESCRIPTION_MAX_LENGTH) invalid.push('description');
    if (invalid.length > 0) {
      throw validationError({
        message: `Invalid field(s): ${invalid.join(', ')}`,
        details: { invalid },
      });
    }
  }
}

export { DomainError };
