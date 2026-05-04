import { promises as fs, type Dirent } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { basename, dirname, join } from 'node:path';
import type { Template, TemplateFrontmatter } from '../../../shared/template.js';
import type {
  TemplateDeleteCommand,
  TemplateExistsQuery,
  TemplateGetQuery,
  TemplateListQuery,
  TemplateRepository,
  TemplateSaveCommand,
} from '../../application/ports/template-repository.js';
import { DomainError } from '../../domain/errors.js';
import { formatTemplateId, parseTemplateId } from '../../domain/template-id.js';
import { parseMarkdown, serializeMarkdown } from '../markdown/frontmatter.js';
import { normalizeTemplateFrontmatter } from './normalize-frontmatter.js';

const TEMPLATES_FOLDER = 'templates';

const hasErrnoCode = (err: unknown, code: string): boolean =>
  typeof err === 'object' && err !== null && (err as { code?: unknown }).code === code;

export type WorkspacePathProvider = string | (() => string | Promise<string>);

export class FsTemplateRepository implements TemplateRepository {
  constructor(private readonly workspaceProvider: WorkspacePathProvider) {}

  private async workspacePath(): Promise<string> {
    if (typeof this.workspaceProvider === 'string') return this.workspaceProvider;
    return await this.workspaceProvider();
  }

  async list(query: TemplateListQuery = {}): Promise<Template[]> {
    const root = await this.workspacePath();
    const folder = join(root, TEMPLATES_FOLDER);
    let entries: Dirent[];
    try {
      entries = await fs.readdir(folder, { withFileTypes: true });
    } catch (err) {
      if (hasErrnoCode(err, 'ENOENT')) return [];
      throw err;
    }

    const out: Template[] = [];
    for (const dirent of entries) {
      if (dirent.name.startsWith('.')) continue;
      if (!dirent.isFile()) continue;
      if (!dirent.name.endsWith('.md')) continue;
      const name = dirent.name.replace(/\.md$/, '');
      const id = formatTemplateId(name);
      const filePath = join(folder, dirent.name);
      try {
        const raw = await fs.readFile(filePath, 'utf8');
        out.push(this.fromRaw(id, raw));
      } catch (err) {
        if (hasErrnoCode(err, 'ENOENT')) continue;
        throw err;
      }
    }

    if (query.targetType) {
      return out.filter((t) => t.frontmatter.targetType === query.targetType);
    }
    return out;
  }

  async get(query: TemplateGetQuery): Promise<Template> {
    const { name } = parseTemplateId(query.id);
    const filePath = await this.fileFor(name);
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      return this.fromRaw(query.id, raw);
    } catch (err) {
      if (hasErrnoCode(err, 'ENOENT')) {
        throw new DomainError('not_found', `Template not found: ${query.id}`, {
          id: query.id,
        });
      }
      throw err;
    }
  }

  async save(command: TemplateSaveCommand): Promise<Template> {
    const template = command.template;
    const id = formatTemplateId(template.frontmatter.name);
    const { name } = parseTemplateId(id);
    const filePath = await this.fileFor(name);
    const dir = dirname(filePath);

    await fs.mkdir(dir, { recursive: true });

    const content = serializeMarkdown(
      template.frontmatter as unknown as Record<string, unknown>,
      template.body,
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
      id,
      frontmatter: template.frontmatter,
      body: template.body,
    };
  }

  async delete(command: TemplateDeleteCommand): Promise<void> {
    const { name } = parseTemplateId(command.id);
    const filePath = await this.fileFor(name);
    try {
      await fs.unlink(filePath);
    } catch (err) {
      if (hasErrnoCode(err, 'ENOENT')) {
        throw new DomainError('not_found', `Template not found: ${command.id}`, {
          id: command.id,
        });
      }
      throw err;
    }
  }

  async exists(query: TemplateExistsQuery): Promise<boolean> {
    const { name } = parseTemplateId(query.id);
    try {
      await fs.access(await this.fileFor(name));
      return true;
    } catch {
      return false;
    }
  }

  private async fileFor(name: string): Promise<string> {
    const root = await this.workspacePath();
    return join(root, TEMPLATES_FOLDER, `${name}.md`);
  }

  private fromRaw(id: string, raw: string): Template {
    const { frontmatter, body } = parseMarkdown<Partial<TemplateFrontmatter>>(raw);
    return { id, frontmatter: normalizeTemplateFrontmatter(frontmatter), body };
  }
}
