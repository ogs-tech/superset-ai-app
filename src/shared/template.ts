import type { CustomizationScope, CustomizationType } from './customization.js';

export type TemplateTargetType = CustomizationType;

export interface TemplateFrontmatter {
  name: string;
  targetType: TemplateTargetType;
  description: string;
  scopes: CustomizationScope[];
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
