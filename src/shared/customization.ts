export type CustomizationType = 'skill' | 'agent' | 'global-instruction' | 'command';

export type CustomizationScope = 'personal' | 'project';

export interface CustomizationFrontmatter {
  name: string;
  type: CustomizationType;
  description: string;
  scopes: CustomizationScope[];
  version: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Customization {
  id: string;
  frontmatter: CustomizationFrontmatter;
  body: string;
}

export type { SyncStatus, SyncResultDetails, SyncResult } from './sync-result.js';
