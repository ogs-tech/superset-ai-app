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

export type SyncStatus = 'ok' | 'conflict' | 'error';

export interface SyncResultDetails {
  backupPath?: string;
  replacedTarget?: string;
  skipped?: 'no-linked-repos' | 'not-found';
  reason?: string;
  action?: 'overwritten';
}

export interface SyncResult {
  adapter: string;
  destination: string | null;
  status: SyncStatus;
  message?: string;
  details?: SyncResultDetails;
}
