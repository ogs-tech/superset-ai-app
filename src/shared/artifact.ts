export type ArtifactType = 'skill' | 'reference' | 'agent';

export type ArtifactScope = 'personal' | 'project';

export interface ArtifactFrontmatter {
  slug: string;
  name: string;
  type: ArtifactType;
  description: string;
  scope: ArtifactScope;
  version: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  includeInCopilotInstructions?: boolean;
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

export type SyncResult = unknown;
