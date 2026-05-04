export type ArtifactType = 'skill' | 'reference' | 'agent' | 'global-instruction';

export type ArtifactScope = 'personal' | 'project';

export interface ArtifactFrontmatter {
  name: string;
  type: ArtifactType;
  description: string;
  scopes: ArtifactScope[];
  version: string;
  tags?: string[];
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
  type: ArtifactType;
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
