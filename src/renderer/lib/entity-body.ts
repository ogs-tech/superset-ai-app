import type { Agent, Entity, Instruction, Skill } from '../../shared/entity.js';

/** The editable/viewable markdown body of a `.md`-backed entity. */
export function entityBody(entity: Entity): string {
  if (entity.kind === 'agent') return (entity as Agent).systemPrompt;
  return (entity as Skill | Instruction).content;
}

/** Return a copy of `entity` with its body field (content/systemPrompt) replaced. */
export function withEntityBody<E extends Entity>(entity: E, body: string): E {
  if (entity.kind === 'agent') return { ...entity, systemPrompt: body };
  return { ...entity, content: body };
}
