import { promises as fs, type Dirent } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { basename, dirname, join } from 'node:path';
import type { Customization, CustomizationType } from '../../../shared/customization.js';
import type {
  CustomizationDeleteCommand,
  CustomizationExistsQuery,
  CustomizationGetQuery,
  CustomizationListQuery,
  CustomizationRepository,
  CustomizationSaveCommand,
} from '../../application/ports/customization-repository.js';
import { DomainError } from '../../domain/errors.js';
import { formatCustomizationId, parseCustomizationId } from '../../domain/customization-id.js';
import { parseMarkdown, serializeMarkdown } from '../../application/markdown/frontmatter.js';
import { normalizeCustomizationFrontmatter } from './normalize-frontmatter.js';

const ARTIFACT_TYPES: CustomizationType[] = [
  'skill',
  'agent',
  'global-instruction',
  'command',
];

const FOLDER_BY_TYPE: Record<CustomizationType, string> = {
  skill: 'skills',
  agent: 'agents',
  'global-instruction': 'global-instructions',
  command: 'commands',
};

const hasErrnoCode = (err: unknown, code: string): boolean =>
  typeof err === 'object' && err !== null && (err as { code?: unknown }).code === code;

export type WorkspacePathProvider = string | (() => string | Promise<string>);

export class FsCustomizationRepository implements CustomizationRepository {
  constructor(private readonly workspaceProvider: WorkspacePathProvider) {}

  private async workspacePath(): Promise<string> {
    if (typeof this.workspaceProvider === 'string') return this.workspaceProvider;
    return await this.workspaceProvider();
  }

  async list(query: CustomizationListQuery = {}): Promise<Customization[]> {
    const types = query.type ? [query.type] : ARTIFACT_TYPES;
    const out: Customization[] = [];
    for (const type of types) {
      out.push(...(await this.listByType(type)));
    }
    return out;
  }

  async get(query: CustomizationGetQuery): Promise<Customization> {
    const { type, name } = parseCustomizationId(query.id);
    const filePath = await this.fileFor(type, name);
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      return this.fromRaw(query.id, raw);
    } catch (err) {
      if (hasErrnoCode(err, 'ENOENT')) {
        throw new DomainError('not_found', `Customization not found: ${query.id}`, {
          id: query.id,
        });
      }
      throw err;
    }
  }

  async save(command: CustomizationSaveCommand): Promise<Customization> {
    const customization = command.customization;
    const { type, name } = parseCustomizationId(
      formatCustomizationId(customization.frontmatter.type, customization.frontmatter.name),
    );
    const filePath = await this.fileFor(type, name);
    const dir = dirname(filePath);

    await fs.mkdir(dir, { recursive: true });

    const content = serializeMarkdown(
      customization.frontmatter as unknown as Record<string, unknown>,
      customization.body,
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
      id: formatCustomizationId(type, name),
      frontmatter: customization.frontmatter,
      body: customization.body,
    };
  }

  async delete(command: CustomizationDeleteCommand): Promise<void> {
    const { type, name } = parseCustomizationId(command.id);
    const root = await this.workspacePath();
    if (type === 'skill') {
      const dir = join(root, FOLDER_BY_TYPE[type], name);
      try {
        await fs.access(dir);
      } catch (err) {
        if (hasErrnoCode(err, 'ENOENT')) {
          throw new DomainError('not_found', `Customization not found: ${command.id}`, {
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
        throw new DomainError('not_found', `Customization not found: ${command.id}`, {
          id: command.id,
        });
      }
      throw err;
    }
  }

  async exists(query: CustomizationExistsQuery): Promise<boolean> {
    const { type, name } = parseCustomizationId(query.id);
    try {
      await fs.access(await this.fileFor(type, name));
      return true;
    } catch {
      return false;
    }
  }

  private async listByType(type: CustomizationType): Promise<Customization[]> {
    const root = await this.workspacePath();
    const folder = join(root, FOLDER_BY_TYPE[type]);
    let entries: Dirent[];
    try {
      entries = await fs.readdir(folder, { withFileTypes: true });
    } catch (err) {
      if (hasErrnoCode(err, 'ENOENT')) return [];
      throw err;
    }

    const out: Customization[] = [];
    for (const dirent of entries) {
      if (dirent.name.startsWith('.')) continue;
      if (type === 'skill') {
        if (!dirent.isDirectory()) continue;
      } else {
        if (!dirent.isFile()) continue;
        if (!dirent.name.endsWith('.md')) continue;
      }
      const name = type === 'skill' ? dirent.name : dirent.name.replace(/\.md$/, '');
      const id = formatCustomizationId(type, name);
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

  private async fileFor(type: CustomizationType, name: string): Promise<string> {
    const root = await this.workspacePath();
    if (type === 'skill') {
      return join(root, FOLDER_BY_TYPE[type], name, 'SKILL.md');
    }
    return join(root, FOLDER_BY_TYPE[type], `${name}.md`);
  }

  private fromRaw(id: string, raw: string): Customization {
    const { frontmatter, body } = parseMarkdown(raw);
    return { id, frontmatter: normalizeCustomizationFrontmatter(frontmatter), body };
  }
}
