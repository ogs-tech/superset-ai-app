import { DomainError } from './errors.js';

export class McpServerIdInvalidError extends DomainError {
  override readonly name = 'McpServerIdInvalidError';
  constructor(message: string, details?: { raw?: string }) {
    super('validation', message, details as Record<string, unknown> | undefined);
  }
}
