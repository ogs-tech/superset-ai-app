import type { Artifact } from '../../../shared/artifact.js';
import type {
  ArtifactDeleteCommand,
  ArtifactExistsQuery,
  ArtifactGetQuery,
  ArtifactListQuery,
  ArtifactRepository,
  ArtifactSaveCommand,
} from '../../application/ports/artifact-repository.js';
import { DomainError } from '../../domain/errors.js';

export class InMemoryArtifactRepository implements ArtifactRepository {
  private readonly store = new Map<string, Artifact>();

  list(query?: ArtifactListQuery): Promise<Artifact[]> {
    const all = Array.from(this.store.values()).map((a) => structuredClone(a));
    if (!query?.type) return Promise.resolve(all);
    return Promise.resolve(all.filter((a) => a.frontmatter.type === query.type));
  }

  get(query: ArtifactGetQuery): Promise<Artifact> {
    const found = this.store.get(query.id);
    if (!found) {
      return Promise.reject(
        new DomainError('not_found', `Artifact not found: ${query.id}`, { id: query.id }),
      );
    }
    return Promise.resolve(structuredClone(found));
  }

  save(command: ArtifactSaveCommand): Promise<Artifact> {
    const cloned = structuredClone(command.artifact);
    this.store.set(cloned.id, cloned);
    return Promise.resolve(structuredClone(cloned));
  }

  delete(command: ArtifactDeleteCommand): Promise<void> {
    if (!this.store.has(command.id)) {
      return Promise.reject(
        new DomainError('not_found', `Artifact not found: ${command.id}`, {
          id: command.id,
        }),
      );
    }
    this.store.delete(command.id);
    return Promise.resolve();
  }

  exists(query: ArtifactExistsQuery): Promise<boolean> {
    return Promise.resolve(this.store.has(query.id));
  }
}
