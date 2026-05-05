import { DomainError } from '../domain/errors.js';
import type { Scope } from '../application/ports/scope.js';

const SCOPES: readonly Scope[] = ['personal', 'project'];

export function asString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new DomainError('validation', `Missing or invalid '${field}'`);
  }
  return value;
}

export function asObject(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new DomainError('validation', `Invalid '${label}' payload`);
  }
  return value as Record<string, unknown>;
}

export function asBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw new DomainError('validation', `Missing or invalid '${field}'`);
  }
  return value;
}

export function asScope(value: unknown): Scope {
  if (typeof value !== 'string' || !(SCOPES as readonly string[]).includes(value)) {
    throw new DomainError(
      'validation',
      `Missing or invalid 'scope' (must be ${SCOPES.join(' | ')})`,
    );
  }
  return value as Scope;
}

export function optParams(params: unknown, label: string): Record<string, unknown> {
  return params === undefined || params === null ? {} : asObject(params, label);
}
