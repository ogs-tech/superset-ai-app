import type { Hook } from '../schemas/hook.js';
import type { HookId } from '../../domain/hook-id.js';
import type { Scope } from './scope.js';

// Hooks differ from skill/agent/command repositories: their backing store is
// scoped (personal → ~/.claude/settings.json, project → .claude/settings.json),
// so each method takes the scope explicitly rather than the service binding it
// at construction.
export interface HookRepository {
  list(scope: Scope): Promise<Hook[]>;
  get(query: { id: HookId; scope: Scope }): Promise<Hook>;
  save(command: { hook: Hook; scope: Scope }): Promise<Hook>;
  delete(command: { id: HookId; scope: Scope }): Promise<void>;
  exists(query: { id: HookId; scope: Scope }): Promise<boolean>;
}
