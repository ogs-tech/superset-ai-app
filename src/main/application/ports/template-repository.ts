import type { ArtifactType, Template } from '../../../shared/artifact.js';

export interface TemplateListQuery {
  type: ArtifactType;
}

export interface TemplateRepository {
  list(query: TemplateListQuery): Promise<Template[]>;
}
