import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import type { ArtifactFrontmatter, ArtifactType, Template } from '../../../shared/artifact.js';
import type {
  TemplateListQuery,
  TemplateRepository,
} from '../../application/ports/template-repository.js';
import { parseMarkdown } from '../markdown/frontmatter.js';

const FILES_BY_TYPE: Record<ArtifactType, string> = {
  skill: 'skill.md',
  reference: 'reference.md',
  agent: 'agent.md',
};

export class BuiltInTemplateRepository implements TemplateRepository {
  constructor(private readonly templatesDir: string) {}

  async list(query: TemplateListQuery): Promise<Template[]> {
    const file = FILES_BY_TYPE[query.type];
    const fullPath = join(this.templatesDir, file);
    const raw = await fs.readFile(fullPath, 'utf8');
    const { frontmatter, body } = parseMarkdown<Partial<ArtifactFrontmatter>>(raw);
    const template: Template = {
      id: `${query.type}/default`,
      type: query.type,
      name: frontmatter.name ?? `New ${query.type}`,
      description: frontmatter.description ?? '',
      frontmatter,
      body,
    };
    return [template];
  }
}
