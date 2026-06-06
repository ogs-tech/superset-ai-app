import { DomainError } from './errors.js';

/**
 * Plugin-specific errors. Each extends {@link DomainError} and fixes its
 * `kind` at construction, so the IPC dispatcher maps them to an `IpcError.kind`
 * through the single `DomainError` path — no parallel instanceof table.
 *
 * Constructor params keep narrow `details` shapes for throw-site safety; the
 * public `.details` is the uniform `Record<string, unknown> | undefined`
 * inherited from `DomainError`.
 */

export class PluginIdInvalidError extends DomainError {
  override readonly name = 'PluginIdInvalidError';
  constructor(message: string, details?: { raw?: string }) {
    super('validation', message, details);
  }
}

export class ManifestInvalidError extends DomainError {
  override readonly name = 'ManifestInvalidError';
  constructor(message: string, details?: { path?: string; reason?: string }) {
    super('validation', message, details);
  }
}

export class PluginCollisionError extends DomainError {
  override readonly name = 'PluginCollisionError';
  constructor(message: string, details?: { id?: string }) {
    super('validation', message, details);
  }
}

export class OwnPluginIdCollisionError extends DomainError {
  override readonly name = 'OwnPluginIdCollisionError';
  constructor(message: string, details?: { id?: string }) {
    super('validation', message, details);
  }
}

export class RefNotFoundError extends DomainError {
  override readonly name = 'RefNotFoundError';
  constructor(message: string, details?: { ref?: string; url?: string }) {
    super('not_found', message, details);
  }
}

export class SettingsLockTimeoutError extends DomainError {
  override readonly name = 'SettingsLockTimeoutError';
  constructor(message: string, details?: { path?: string; timeoutMs?: number }) {
    super('io', message, details);
  }
}

export class DriftDetectedError extends DomainError {
  override readonly name = 'DriftDetectedError';
  constructor(message: string, details?: { id?: string; kind?: string }) {
    super('conflict', message, details);
  }
}

export class SemVerInvalidError extends DomainError {
  override readonly name = 'SemVerInvalidError';
  constructor(message: string, details?: { raw?: string }) {
    super('validation', message, details);
  }
}

export class PublishAuthMissingError extends DomainError {
  override readonly name = 'PublishAuthMissingError';
  constructor(message: string, details?: Record<string, unknown>) {
    super('auth', message, details);
  }
}

export class RepoAlreadyExistsError extends DomainError {
  override readonly name = 'RepoAlreadyExistsError';
  constructor(message: string, details?: { repoName?: string }) {
    super('conflict', message, details);
  }
}

export class PublishConflictError extends DomainError {
  override readonly name = 'PublishConflictError';
  constructor(message: string, details?: { localSha?: string; remoteSha?: string }) {
    super('conflict', message, details);
  }
}

export class TagConflictError extends DomainError {
  override readonly name = 'TagConflictError';
  constructor(message: string, details?: { tag?: string }) {
    super('conflict', message, details);
  }
}

export class CredentialStoreUnavailableError extends DomainError {
  override readonly name = 'CredentialStoreUnavailableError';
  constructor(message: string, details?: Record<string, unknown>) {
    super('io', message, details);
  }
}

export class OperationNotAllowedForOriginError extends DomainError {
  override readonly name = 'OperationNotAllowedForOriginError';
  constructor(message: string, details?: { origin?: string; operation?: string }) {
    super('validation', message, details);
  }
}
