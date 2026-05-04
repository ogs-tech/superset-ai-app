export type ArtifactType = 'skill' | 'reference' | 'agent' | 'global-instruction' | 'template';

export type TemplateTargetType = Exclude<ArtifactType, 'template'>;

export type ArtifactScope = 'personal' | 'project';

export interface ArtifactFrontmatter {
  name: string;
  type: ArtifactType;
  description: string;
  scopes: ArtifactScope[];
  version: string;
  tags?: string[];
  targetType?: TemplateTargetType;
  createdAt: string;
  updatedAt: string;
}

export interface Artifact {
  id: string;
  frontmatter: ArtifactFrontmatter;
  body: string;
}

export interface Template {
  id: string;
  type: TemplateTargetType;
  name: string;
  description: string;
  frontmatter: Partial<ArtifactFrontmatter>;
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
