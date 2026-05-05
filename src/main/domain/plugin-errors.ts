export class PluginIdInvalidError extends Error {
  override readonly name = 'PluginIdInvalidError';
  readonly details: { raw?: string } | undefined;
  constructor(message: string, details?: { raw?: string }) {
    super(message);
    this.details = details;
  }
}

export class ManifestInvalidError extends Error {
  override readonly name = 'ManifestInvalidError';
  readonly details: { path?: string; reason?: string } | undefined;
  constructor(message: string, details?: { path?: string; reason?: string }) {
    super(message);
    this.details = details;
  }
}

export class PluginCollisionError extends Error {
  override readonly name = 'PluginCollisionError';
  readonly details: { id?: string } | undefined;
  constructor(message: string, details?: { id?: string }) {
    super(message);
    this.details = details;
  }
}

export class OwnPluginIdCollisionError extends Error {
  override readonly name = 'OwnPluginIdCollisionError';
  readonly details: { id?: string } | undefined;
  constructor(message: string, details?: { id?: string }) {
    super(message);
    this.details = details;
  }
}

export class RefNotFoundError extends Error {
  override readonly name = 'RefNotFoundError';
  readonly details: { ref?: string; url?: string } | undefined;
  constructor(message: string, details?: { ref?: string; url?: string }) {
    super(message);
    this.details = details;
  }
}

export class SettingsLockTimeoutError extends Error {
  override readonly name = 'SettingsLockTimeoutError';
  readonly details: { path?: string; timeoutMs?: number } | undefined;
  constructor(message: string, details?: { path?: string; timeoutMs?: number }) {
    super(message);
    this.details = details;
  }
}

export class DriftDetectedError extends Error {
  override readonly name = 'DriftDetectedError';
  readonly details: { id?: string; kind?: string } | undefined;
  constructor(message: string, details?: { id?: string; kind?: string }) {
    super(message);
    this.details = details;
  }
}

export class SemVerInvalidError extends Error {
  override readonly name = 'SemVerInvalidError';
  readonly details: { raw?: string } | undefined;
  constructor(message: string, details?: { raw?: string }) {
    super(message);
    this.details = details;
  }
}

export class PublishAuthMissingError extends Error {
  override readonly name = 'PublishAuthMissingError';
  readonly details: Record<string, unknown> | undefined;
  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.details = details;
  }
}

export class RepoAlreadyExistsError extends Error {
  override readonly name = 'RepoAlreadyExistsError';
  readonly details: { repoName?: string } | undefined;
  constructor(message: string, details?: { repoName?: string }) {
    super(message);
    this.details = details;
  }
}

export class PublishConflictError extends Error {
  override readonly name = 'PublishConflictError';
  readonly details: { localSha?: string; remoteSha?: string } | undefined;
  constructor(message: string, details?: { localSha?: string; remoteSha?: string }) {
    super(message);
    this.details = details;
  }
}

export class TagConflictError extends Error {
  override readonly name = 'TagConflictError';
  readonly details: { tag?: string } | undefined;
  constructor(message: string, details?: { tag?: string }) {
    super(message);
    this.details = details;
  }
}

export class CredentialStoreUnavailableError extends Error {
  override readonly name = 'CredentialStoreUnavailableError';
  readonly details: Record<string, unknown> | undefined;
  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.details = details;
  }
}

export class OperationNotAllowedForOriginError extends Error {
  override readonly name = 'OperationNotAllowedForOriginError';
  readonly details: { origin?: string; operation?: string } | undefined;
  constructor(message: string, details?: { origin?: string; operation?: string }) {
    super(message);
    this.details = details;
  }
}
