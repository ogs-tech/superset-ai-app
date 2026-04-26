import type { Template } from '../../../shared/artifact.js';
import type {
  TemplateListQuery,
  TemplateRepository,
} from '../../application/ports/template-repository.js';

export class TemplateService {
  constructor(private readonly repository: TemplateRepository) {}

  list(query: TemplateListQuery): Promise<Template[]> {
    return this.repository.list(query);
  }
}
