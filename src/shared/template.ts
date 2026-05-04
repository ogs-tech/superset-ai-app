import type { ArtifactScope, ArtifactType } from './artifact.js';

export type TemplateTargetType = ArtifactType;

export interface TemplateFrontmatter {
  name: string;
  targetType: TemplateTargetType;
  description: string;
  scopes: ArtifactScope[];
  version: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Template {
  id: string;
  frontmatter: TemplateFrontmatter;
  body: string;
}
