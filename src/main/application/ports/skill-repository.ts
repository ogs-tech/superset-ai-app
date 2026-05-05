import type { Skill } from '../schemas/skill.js';
import type { SkillId } from '../../domain/skill-id.js';

export interface SkillRepository {
  list(): Promise<Skill[]>;
  get(query: { id: SkillId }): Promise<Skill>;
  save(command: { skill: Skill }): Promise<Skill>;
  delete(command: { id: SkillId }): Promise<void>;
  exists(query: { id: SkillId }): Promise<boolean>;
}
