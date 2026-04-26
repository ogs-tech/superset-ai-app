import type { IpcErrorKind } from '../../shared/ipc-contract.js';

export type DomainErrorKind = Exclude<IpcErrorKind, 'internal'>;

export class DomainError extends Error {
  readonly kind: DomainErrorKind;
  readonly details: Record<string, unknown> | undefined;

  constructor(kind: DomainErrorKind, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'DomainError';
    this.kind = kind;
    this.details = details;
  }
}

export interface ValidationDetails {
  missing?: string[];
  invalid?: string[];
  conflict?: string;
}

export function validationError(args: {
  message: string;
  details?: ValidationDetails;
}): DomainError {
  return new DomainError(
    'validation',
    args.message,
    args.details as Record<string, unknown> | undefined,
  );
}
