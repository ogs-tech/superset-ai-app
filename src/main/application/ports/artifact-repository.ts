import type { Artifact, ArtifactType } from '../../../shared/artifact.js';

export interface ArtifactListQuery {
  type?: ArtifactType;
}

export interface ArtifactGetQuery {
  id: string;
}

export interface ArtifactSaveCommand {
  artifact: Artifact;
}

export interface ArtifactDeleteCommand {
  id: string;
}

export interface ArtifactExistsQuery {
  id: string;
}

export interface ArtifactRepository {
  list(query?: ArtifactListQuery): Promise<Artifact[]>;
  get(query: ArtifactGetQuery): Promise<Artifact>;
  save(command: ArtifactSaveCommand): Promise<Artifact>;
  delete(command: ArtifactDeleteCommand): Promise<void>;
  exists(query: ArtifactExistsQuery): Promise<boolean>;
}
