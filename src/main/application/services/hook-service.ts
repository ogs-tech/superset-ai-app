import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import type { ClaudeSettingsPort } from '../ports/claude-settings-port.js';
import type { PluginCachePort } from '../ports/plugin-cache-port.js';
import type { FileSystemPort } from '../ports/filesystem-port.js';
import type { Scope } from '../ports/scope.js';
import type { Hook, HookHandler, ClaudeHookHandlerEntry, ClaudeHooksField } from '../schemas/hook.js';
import { claudeHooksFieldSchema } from '../schemas/hook.js';
import type { HookId } from '../../domain/hook-id.js';
import { hookId } from '../../domain/hook-id.js';
import type { PluginId } from '../../domain/plugin-id.js';
import { WORKSPACE_SOURCE, pluginSource } from '../../domain/customization-source.js';
import { OperationNotAllowedForOriginError } from '../../domain/plugin-errors.js';
import { DomainError } from '../../domain/errors.js';

export interface SaveHookResult {
  hook: Hook;
}

export interface PluginDepsForHooks {
  cache: PluginCachePort;
  fs: FileSystemPort;
}

export class HookService {
  constructor(
    private readonly settings: ClaudeSettingsPort,
    private readonly pluginDeps?: PluginDepsForHooks,
  ) {}

  async list(scope: Scope = 'personal'): Promise<Hook[]> {
    const workspace = await this.listWorkspace(scope);
    if (!this.pluginDeps) return workspace;
    const pluginHooks = await this.collectPluginHooks(scope);
    const ids = new Set(workspace.map((h) => h.id));
    return [...workspace, ...pluginHooks.filter((h) => !ids.has(h.id))];
  }

  async get(input: { id: HookId; scope?: Scope }): Promise<Hook> {
    const scope = input.scope ?? 'personal';
    const all = await this.list(scope);
    const found = all.find((h) => h.id === input.id);
    if (!found) {
      throw new DomainError('not_found', `Hook not found: ${input.id}`, {
        id: input.id,
        scope,
      });
    }
    return found;
  }

  async save(input: {
    hook: Omit<Hook, 'id' | 'source'> & { id?: HookId };
    scope?: Scope;
  }): Promise<SaveHookResult> {
    const scope = input.scope ?? 'personal';

    if (input.hook.id) {
      await this.assertNotPluginSourced('save', input.hook.id, scope);
    }

    const id: HookId = input.hook.id ?? hookId(randomUUID());

    await this.settings.mutate(scope, (s) => {
      const hooks = parseHooks(s.hooks);
      const updated = upsertOwnedHook(hooks, {
        id,
        event: input.hook.event,
        ...(input.hook.matcher !== undefined ? { matcher: input.hook.matcher } : {}),
        ...(input.hook.description !== undefined ? { description: input.hook.description } : {}),
        handler: input.hook.handler,
      });
      return { ...s, hooks: updated };
    });

    return {
      hook: {
        id,
        event: input.hook.event,
        ...(input.hook.matcher !== undefined ? { matcher: input.hook.matcher } : {}),
        ...(input.hook.description !== undefined ? { description: input.hook.description } : {}),
        handler: input.hook.handler,
        source: WORKSPACE_SOURCE,
      },
    };
  }

  async delete(input: { id: HookId; scope?: Scope }): Promise<{ ok: true }> {
    const scope = input.scope ?? 'personal';
    await this.assertNotPluginSourced('delete', input.id, scope);

    await this.settings.mutate(scope, (s) => {
      const hooks = parseHooks(s.hooks);
      const updated = removeOwnedHook(hooks, input.id);
      return { ...s, hooks: updated };
    });

    return { ok: true };
  }

  private async listWorkspace(scope: Scope): Promise<Hook[]> {
    const settings = await this.settings.read(scope);
    const hooks = parseHooks(settings.hooks);
    return flattenWorkspaceHooks(hooks);
  }

  private async collectPluginHooks(scope: Scope): Promise<Hook[]> {
    if (!this.pluginDeps) return [];
    const { cache, fs } = this.pluginDeps;

    let plugins: ReadonlyArray<{ id: string }> = [];
    try {
      const meta = await cache.readMeta(scope);
      plugins = meta.plugins;
    } catch {
      return [];
    }

    const out: Hook[] = [];
    for (const entry of plugins) {
      const pid = entry.id as PluginId;
      const dir = cache.pluginDir(scope, pid);
      const hooks = await readPluginHooksFile(fs, dir);
      if (!hooks) continue;
      out.push(...flattenPluginHooks(hooks, pid));
    }
    return out;
  }

  private async assertNotPluginSourced(
    operation: 'save' | 'delete',
    id: HookId,
    scope: Scope,
  ): Promise<void> {
    if (!this.pluginDeps) return;
    const pluginHooks = await this.collectPluginHooks(scope);
    if (pluginHooks.some((h) => h.id === id)) {
      throw new OperationNotAllowedForOriginError(
        `Cannot ${operation} hook '${id}' provided by a plugin`,
        { origin: 'plugin', operation },
      );
    }
  }
}

function parseHooks(value: unknown): ClaudeHooksField {
  if (value === undefined || value === null) return {};
  return claudeHooksFieldSchema.parse(value);
}

function flattenWorkspaceHooks(hooks: ClaudeHooksField): Hook[] {
  const out: Hook[] = [];
  for (const [event, blocks] of Object.entries(hooks)) {
    for (const block of blocks) {
      const matcher = block.matcher;
      const description = block.description;
      for (const handler of block.hooks) {
        const id = (handler as { _sdeAiId?: string })._sdeAiId ?? randomUUID();
        const { _sdeAiId: _omit, ...handlerOnly } = handler as HookHandler & { _sdeAiId?: string };
        void _omit;
        out.push({
          id: hookId(id),
          event,
          ...(matcher !== undefined ? { matcher } : {}),
          ...(description !== undefined ? { description } : {}),
          handler: handlerOnly as HookHandler,
          source: WORKSPACE_SOURCE,
        });
      }
    }
  }
  return out;
}

function flattenPluginHooks(hooks: ClaudeHooksField, pid: PluginId): Hook[] {
  const out: Hook[] = [];
  for (const [event, blocks] of Object.entries(hooks)) {
    blocks.forEach((block, blockIdx) => {
      const matcher = block.matcher;
      const description = block.description;
      block.hooks.forEach((handler, handlerIdx) => {
        const synthetic = `${pid}:${event}:${blockIdx}:${handlerIdx}`;
        const { _sdeAiId: _omit, ...handlerOnly } = handler as HookHandler & { _sdeAiId?: string };
        void _omit;
        out.push({
          id: hookId(synthetic),
          event,
          ...(matcher !== undefined ? { matcher } : {}),
          ...(description !== undefined ? { description } : {}),
          handler: handlerOnly as HookHandler,
          source: pluginSource(pid),
        });
      });
    });
  }
  return out;
}

function upsertOwnedHook(
  hooks: ClaudeHooksField,
  hook: { id: HookId; event: string; matcher?: string; description?: string; handler: HookHandler },
): ClaudeHooksField {
  const next: ClaudeHooksField = { ...hooks };
  // Remove any pre-existing entry with the same id across all events.
  for (const [event, blocks] of Object.entries(next)) {
    const cleaned = blocks
      .map((b) => stripById(b, hook.id))
      .filter((b) => b.hooks.length > 0);
    if (cleaned.length === 0) {
      delete next[event];
    } else {
      next[event] = cleaned;
    }
  }

  const block: ClaudeHookHandlerEntry = {
    ...(hook.matcher !== undefined ? { matcher: hook.matcher } : {}),
    ...(hook.description !== undefined ? { description: hook.description } : {}),
    hooks: [{ ...hook.handler, _sdeAiId: hook.id }],
  };

  const existing = next[hook.event] ?? [];
  next[hook.event] = [...existing, block];
  return next;
}

function removeOwnedHook(hooks: ClaudeHooksField, id: HookId): ClaudeHooksField {
  const next: ClaudeHooksField = {};
  for (const [event, blocks] of Object.entries(hooks)) {
    const cleaned = blocks
      .map((b) => stripById(b, id))
      .filter((b) => b.hooks.length > 0);
    if (cleaned.length > 0) {
      next[event] = cleaned;
    }
  }
  return next;
}

function stripById(block: ClaudeHookHandlerEntry, id: HookId): ClaudeHookHandlerEntry {
  return {
    ...block,
    hooks: block.hooks.filter((h) => (h as { _sdeAiId?: string })._sdeAiId !== id),
  };
}

async function readPluginHooksFile(
  fs: FileSystemPort,
  pluginDir: string,
): Promise<ClaudeHooksField | null> {
  const candidates = [join(pluginDir, 'hooks', 'hooks.json'), join(pluginDir, 'hooks.json')];
  for (const path of candidates) {
    try {
      if (!(await fs.pathExists(path))) continue;
      const raw = await fs.readFile(path);
      const parsed = JSON.parse(raw) as { hooks?: unknown };
      const hooksField = parsed.hooks ?? parsed; // tolerate {hooks: {...}} or bare {...}
      const result = claudeHooksFieldSchema.safeParse(hooksField);
      if (result.success) return result.data;
    } catch {
      // skip unreadable / malformed file
    }
  }
  return null;
}
