import type { Template, TemplateTargetType } from '../../../shared/artifact.js';

export interface TemplateListQuery {
  type: TemplateTargetType;
}

export interface TemplateRepository {
  list(query: TemplateListQuery): Promise<Template[]>;
}
