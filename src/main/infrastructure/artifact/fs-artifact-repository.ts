import { promises as fs, type Dirent } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { basename, dirname, join } from 'node:path';
import type { Artifact, ArtifactType } from '../../../shared/artifact.js';
import type {
  ArtifactDeleteCommand,
  ArtifactExistsQuery,
  ArtifactGetQuery,
  ArtifactListQuery,
  ArtifactRepository,
  ArtifactSaveCommand,
} from '../../application/ports/artifact-repository.js';
import { DomainError } from '../../domain/errors.js';
import { formatArtifactId, parseArtifactId } from '../../domain/artifact-id.js';
import { parseMarkdown, serializeMarkdown } from '../markdown/frontmatter.js';
import { normalizeArtifactFrontmatter } from './normalize-frontmatter.js';

const ARTIFACT_TYPES: ArtifactType[] = ['skill', 'reference', 'agent'];

const FOLDER_BY_TYPE: Record<ArtifactType, string> = {
  skill: 'skills',
  reference: 'references',
  agent: 'agents',
};

const hasErrnoCode = (err: unknown, code: string): boolean =>
  typeof err === 'object' && err !== null && (err as { code?: unknown }).code === code;

export type WorkspacePathProvider = string | (() => string | Promise<string>);

export class FsArtifactRepository implements ArtifactRepository {
  constructor(private readonly workspaceProvider: WorkspacePathProvider) {}

  private async workspacePath(): Promise<string> {
    if (typeof this.workspaceProvider === 'string') return this.workspaceProvider;
    return await this.workspaceProvider();
  }

  async list(query: ArtifactListQuery = {}): Promise<Artifact[]> {
    const types = query.type ? [query.type] : ARTIFACT_TYPES;
    const out: Artifact[] = [];
    for (const type of types) {
      out.push(...(await this.listByType(type)));
    }
    return out;
  }

  async get(query: ArtifactGetQuery): Promise<Artifact> {
    const { type, name } = parseArtifactId(query.id);
    const filePath = await this.fileFor(type, name);
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      return this.fromRaw(query.id, raw);
    } catch (err) {
      if (hasErrnoCode(err, 'ENOENT')) {
        throw new DomainError('not_found', `Artifact not found: ${query.id}`, {
          id: query.id,
        });
      }
      throw err;
    }
  }

  async save(command: ArtifactSaveCommand): Promise<Artifact> {
    const artifact = command.artifact;
    const { type, name } = parseArtifactId(
      formatArtifactId(artifact.frontmatter.type, artifact.frontmatter.name),
    );
    const filePath = await this.fileFor(type, name);
    const dir = dirname(filePath);

    await fs.mkdir(dir, { recursive: true });

    const content = serializeMarkdown(
      artifact.frontmatter as unknown as Record<string, unknown>,
      artifact.body,
    );

    const tempPath = join(
      dir,
      `.${basename(filePath)}.${randomBytes(8).toString('hex')}.tmp`,
    );
    await fs.writeFile(tempPath, content, 'utf8');
    try {
      await fs.rename(tempPath, filePath);
    } catch (err) {
      await fs.unlink(tempPath).catch(() => undefined);
      throw err;
    }

    return {
      id: formatArtifactId(type, name),
      frontmatter: artifact.frontmatter,
      body: artifact.body,
    };
  }

  async delete(command: ArtifactDeleteCommand): Promise<void> {
    const { type, name } = parseArtifactId(command.id);
    const root = await this.workspacePath();
    if (type === 'skill') {
      const dir = join(root, FOLDER_BY_TYPE[type], name);
      try {
        await fs.access(dir);
      } catch (err) {
        if (hasErrnoCode(err, 'ENOENT')) {
          throw new DomainError('not_found', `Artifact not found: ${command.id}`, {
            id: command.id,
          });
        }
        throw err;
      }
      await fs.rm(dir, { recursive: true, force: true });
      return;
    }
    const file = await this.fileFor(type, name);
    try {
      await fs.unlink(file);
    } catch (err) {
      if (hasErrnoCode(err, 'ENOENT')) {
        throw new DomainError('not_found', `Artifact not found: ${command.id}`, {
          id: command.id,
        });
      }
      throw err;
    }
  }

  async exists(query: ArtifactExistsQuery): Promise<boolean> {
    const { type, name } = parseArtifactId(query.id);
    try {
      await fs.access(await this.fileFor(type, name));
      return true;
    } catch {
      return false;
    }
  }

  private async listByType(type: ArtifactType): Promise<Artifact[]> {
    const root = await this.workspacePath();
    const folder = join(root, FOLDER_BY_TYPE[type]);
    let entries: Dirent[];
    try {
      entries = await fs.readdir(folder, { withFileTypes: true });
    } catch (err) {
      if (hasErrnoCode(err, 'ENOENT')) return [];
      throw err;
    }

    const out: Artifact[] = [];
    for (const dirent of entries) {
      if (dirent.name.startsWith('.')) continue;
      if (type === 'skill') {
        if (!dirent.isDirectory()) continue;
      } else {
        if (!dirent.isFile()) continue;
        if (!dirent.name.endsWith('.md')) continue;
      }
      const name = type === 'skill' ? dirent.name : dirent.name.replace(/\.md$/, '');
      const id = formatArtifactId(type, name);
      const filePath = await this.fileFor(type, name);
      try {
        const raw = await fs.readFile(filePath, 'utf8');
        out.push(this.fromRaw(id, raw));
      } catch (err) {
        if (hasErrnoCode(err, 'ENOENT')) continue;
        throw err;
      }
    }
    return out;
  }

  private async fileFor(type: ArtifactType, name: string): Promise<string> {
    const root = await this.workspacePath();
    if (type === 'skill') {
      return join(root, FOLDER_BY_TYPE[type], name, 'SKILL.md');
    }
    return join(root, FOLDER_BY_TYPE[type], `${name}.md`);
  }

  private fromRaw(id: string, raw: string): Artifact {
    const { frontmatter, body } = parseMarkdown(raw);
    return { id, frontmatter: normalizeArtifactFrontmatter(frontmatter), body };
  }
}
