import type { IpcErrorKind } from '../../shared/ipc-contract.js';

export type DomainErrorKind = IpcErrorKind;

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

export function symlinkConflictError(args: {
  message: string;
  details?: { backupPath?: string; replacedTarget?: string; reason?: string };
}): DomainError {
  return new DomainError('symlink_conflict', args.message, args.details);
}

export function ioError(args: {
  message: string;
  details?: { code?: string; reason?: string };
}): DomainError {
  return new DomainError('io', args.message, args.details);
}
