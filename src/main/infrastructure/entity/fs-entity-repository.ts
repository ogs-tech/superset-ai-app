import { randomBytes } from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, unlink, writeFile, access } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import type { Entity, EntityKind } from '../../../shared/entity.js';
import { WORKSPACE_SOURCE, parseUrn } from '../../../shared/entity.js';
import type { EntityListQuery, EntityRepository } from '../../application/ports/entity-repository.js';
import { renderEntityFile, parseEntityFile } from '../../application/entity/entity-serializer.js';
import { DomainError } from '../../domain/errors.js';

type WorkspacePathProvider = string | (() => string) | (() => Promise<string>);

const KINDS: EntityKind[] = ['skill', 'agent', 'instruction'];
const FOLDER: Record<'skill' | 'agent' | 'instruction', string> = {
  skill: 'skills',
  agent: 'agents',
  instruction: 'instructions',
};

function isEnoent(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'ENOENT';
}

export class FsEntityRepository implements EntityRepository {
  constructor(private readonly workspace: WorkspacePathProvider) {}

  private async root(): Promise<string> {
    return typeof this.workspace === 'string' ? this.workspace : this.workspace();
  }

  private async fileFor(kind: EntityKind, name: string): Promise<string> {
    const root = await this.root();
    if (kind === 'skill') return join(root, FOLDER.skill, name, 'SKILL.md');
    if (kind === 'agent') return join(root, FOLDER.agent, `${name}.md`);
    if (kind === 'instruction') return join(root, FOLDER.instruction, `${name}.md`);
    throw new DomainError('validation', `Unsupported entity kind for storage: ${kind}`);
  }

  private async legacyInstructionFile(name: string): Promise<string> {
    return join(await this.root(), 'global-instructions', `${name}.md`);
  }

  async list(query?: EntityListQuery): Promise<Entity[]> {
    const kinds = query?.kind ? [query.kind] : KINDS;
    const out: Entity[] = [];
    for (const kind of kinds) {
      if (kind !== 'skill' && kind !== 'agent' && kind !== 'instruction') continue;
      out.push(...(await this.listByKind(kind)));
    }
    return out;
  }

  private async listByKind(kind: 'skill' | 'agent' | 'instruction'): Promise<Entity[]> {
    const dir = join(await this.root(), FOLDER[kind]);
    let entries: import('node:fs').Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (err) {
      if (isEnoent(err)) return [];
      throw err;
    }
    const out: Entity[] = [];
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      let name: string | undefined;
      if (kind === 'skill') {
        if (entry.isDirectory()) name = entry.name;
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        name = entry.name.slice(0, -'.md'.length);
      }
      if (name === undefined) continue;
      const raw = await readFile(await this.fileFor(kind, name), 'utf8');
      out.push(parseEntityFile({ kind, name, raw, source: WORKSPACE_SOURCE }));
    }
    return out;
  }

  async get(urn: string): Promise<Entity> {
    const { kind, name } = parseUrn(urn);
    const path = await this.fileFor(kind, name);
    try {
      const raw = await readFile(path, 'utf8');
      return parseEntityFile({ kind, name, raw, source: WORKSPACE_SOURCE });
    } catch (err) {
      if (isEnoent(err) && kind === 'instruction') {
        try {
          const raw = await readFile(await this.legacyInstructionFile(name), 'utf8');
          return parseEntityFile({ kind, name, raw, source: WORKSPACE_SOURCE });
        } catch (legacyErr) {
          if (isEnoent(legacyErr)) throw new DomainError('not_found', `Entity not found: ${urn}`);
          throw legacyErr;
        }
      }
      if (isEnoent(err)) throw new DomainError('not_found', `Entity not found: ${urn}`);
      throw err;
    }
  }

  async save(entity: Entity): Promise<Entity> {
    const path = await this.fileFor(entity.kind, entity.name);
    const dir = dirname(path);
    await mkdir(dir, { recursive: true });
    const content = renderEntityFile(entity);
    const tmp = join(dir, `.${basename(path)}.${randomBytes(8).toString('hex')}.tmp`);
    await writeFile(tmp, content, 'utf8');
    try {
      await rename(tmp, path);
    } catch (err) {
      await unlink(tmp).catch(() => undefined);
      throw err;
    }
    return entity;
  }

  async delete(urn: string): Promise<void> {
    const { kind, name } = parseUrn(urn);
    const root = await this.root();
    if (kind === 'skill') {
      const dir = join(root, FOLDER.skill, name);
      try {
        await access(dir);
      } catch (err) {
        if (isEnoent(err)) throw new DomainError('not_found', `Entity not found: ${urn}`);
        throw err;
      }
      await rm(dir, { recursive: true, force: true });
      return;
    }
    try {
      await unlink(await this.fileFor(kind, name));
    } catch (err) {
      if (isEnoent(err)) throw new DomainError('not_found', `Entity not found: ${urn}`);
      throw err;
    }
  }

  async exists(urn: string): Promise<boolean> {
    const { kind, name } = parseUrn(urn);
    try {
      await access(await this.fileFor(kind, name));
      return true;
    } catch (err) {
      if (!isEnoent(err)) throw err;
      if (kind === 'instruction') {
        try {
          await access(await this.legacyInstructionFile(name));
          return true;
        } catch (legacyErr) {
          if (!isEnoent(legacyErr)) throw legacyErr;
          return false;
        }
      }
      return false;
    }
  }
}
