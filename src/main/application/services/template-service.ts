import type { Artifact, Template } from '../../../shared/artifact.js';
import type { ArtifactRepository } from '../../application/ports/artifact-repository.js';
import type {
  TemplateListQuery,
  TemplateRepository,
} from '../../application/ports/template-repository.js';

export class TemplateService {
  constructor(
    private readonly builtIns: TemplateRepository,
    private readonly artifactRepository?: ArtifactRepository,
  ) {}

  async list(query: TemplateListQuery): Promise<Template[]> {
    const [builtIns, userTemplates] = await Promise.all([
      this.builtIns.list(query),
      this.listUserTemplates(query),
    ]);
    return [...userTemplates, ...builtIns];
  }

  private async listUserTemplates(query: TemplateListQuery): Promise<Template[]> {
    if (!this.artifactRepository) return [];
    const all = await this.artifactRepository.list({ type: 'template' });
    return all
      .filter((artifact) => artifact.frontmatter.targetType === query.type)
      .map((artifact) => toTemplate(artifact, query.type));
  }
}

function toTemplate(artifact: Artifact, targetType: TemplateListQuery['type']): Template {
  const fm = artifact.frontmatter;
  return {
    id: artifact.id,
    type: targetType,
    name: fm.name,
    description: fm.description,
    frontmatter: {
      type: targetType,
      ...(fm.scopes ? { scopes: fm.scopes } : {}),
      ...(fm.version ? { version: fm.version } : {}),
      ...(fm.tags ? { tags: fm.tags } : {}),
    },
    body: artifact.body,
    isBuiltIn: false,
  };
}
