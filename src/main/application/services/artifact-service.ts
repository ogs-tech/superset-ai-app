import type { Artifact, ArtifactFrontmatter, SyncResult } from '../../../shared/artifact.js';
import type { ClockPort } from '../../application/ports/clock-port.js';
import type {
  ArtifactDeleteCommand,
  ArtifactListQuery,
  ArtifactRepository,
} from '../../application/ports/artifact-repository.js';
import type { AdapterManager } from './adapter-manager.js';
import type { SchemaValidator } from './schema-validator.js';
import { formatArtifactId } from '../../domain/artifact-id.js';
import { isValidArtifactName } from '../../domain/artifact-name.js';
import { DomainError, validationError } from '../../domain/errors.js';

const GLOBAL_INSTRUCTION_ALLOWED_SLUGS: ReadonlyArray<string> = ['claude', 'copilot'];

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
    private readonly schemaValidator?: SchemaValidator,
  ) {}

  list(query: ArtifactListQuery = {}): Promise<Artifact[]> {
    return this.repository.list(query);
  }

  get(query: { id: string }): Promise<Artifact> {
    return this.repository.get(query);
  }

  async save(command: SaveArtifactCommand): Promise<SaveArtifactResult> {
    const { artifact, isCreate = false } = command;
    this.validateArtifact(artifact);

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

  private validateArtifact(artifact: Artifact): void {
    const fm = artifact.frontmatter;

    if (this.schemaValidator) {
      const result = this.schemaValidator.validate(fm);
      if (!result.ok) {
        throw validationError({
          message: `${result.errors.length} validation error(s)`,
          details: { errors: result.errors },
        });
      }
      return;
    }

    if (fm.type === 'global-instruction') {
      this.validateGlobalInstruction(fm);
    }

    const missing: string[] = [];
    const REQUIRED_FIELDS: Array<keyof ArtifactFrontmatter> = ['name', 'type', 'description', 'version'];
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
    if (!Array.isArray(fm.scopes) || fm.scopes.length === 0) invalid.push('scopes');
    if (fm.description && fm.description.length > 200) invalid.push('description');
    if (invalid.length > 0) {
      throw validationError({
        message: `Invalid field(s): ${invalid.join(', ')}`,
        details: { invalid },
      });
    }
  }

  private validateGlobalInstruction(fm: ArtifactFrontmatter): void {
    if (!GLOBAL_INSTRUCTION_ALLOWED_SLUGS.includes(fm.name)) {
      throw validationError({
        message: `Invalid slug for global-instruction: '${fm.name}' (must be 'claude' or 'copilot')`,
        details: { reason: 'global-instruction-slug-not-allowed' },
      });
    }
    const scopes = Array.isArray(fm.scopes) ? fm.scopes : [];
    if (scopes.length !== 1 || scopes[0] !== 'personal') {
      throw validationError({
        message: `Invalid scopes for global-instruction: must be exactly ['personal']`,
        details: { reason: 'global-instruction-scope-must-be-personal' },
      });
    }
  }
}

export { DomainError };
