import { DomainError } from './errors.js';

export class SkillIdInvalidError extends DomainError {
  override readonly name = 'SkillIdInvalidError';
  constructor(message: string, details?: { raw?: string }) {
    super('validation', message, details);
  }
}

export class AgentIdInvalidError extends DomainError {
  override readonly name = 'AgentIdInvalidError';
  constructor(message: string, details?: { raw?: string }) {
    super('validation', message, details);
  }
}

export class CommandIdInvalidError extends DomainError {
  override readonly name = 'CommandIdInvalidError';
  constructor(message: string, details?: { raw?: string }) {
    super('validation', message, details);
  }
}

export class HookIdInvalidError extends DomainError {
  override readonly name = 'HookIdInvalidError';
  constructor(message: string, details?: { raw?: string }) {
    super('validation', message, details);
  }
}

export class InstructionIdInvalidError extends DomainError {
  override readonly name = 'InstructionIdInvalidError';
  constructor(message: string, details?: { raw?: string }) {
    super('validation', message, details);
  }
}

export class MarketplaceIdInvalidError extends DomainError {
  override readonly name = 'MarketplaceIdInvalidError';
  constructor(message: string, details?: { raw?: string }) {
    super('validation', message, details);
  }
}
