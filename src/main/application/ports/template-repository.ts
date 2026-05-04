import type { Template, TemplateTargetType } from '../../../shared/template.js';

export interface TemplateListQuery {
  targetType?: TemplateTargetType;
}

export interface TemplateGetQuery {
  id: string;
}

export interface TemplateSaveCommand {
  template: Template;
}

export interface TemplateDeleteCommand {
  id: string;
}

export interface TemplateExistsQuery {
  id: string;
}

export interface TemplateRepository {
  list(query?: TemplateListQuery): Promise<Template[]>;
  get(query: TemplateGetQuery): Promise<Template>;
  save(command: TemplateSaveCommand): Promise<Template>;
  delete(command: TemplateDeleteCommand): Promise<void>;
  exists(query: TemplateExistsQuery): Promise<boolean>;
}
