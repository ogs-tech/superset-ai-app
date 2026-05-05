import { describe, it, expect } from 'vitest';
import {
  PluginIdInvalidError,
  ManifestInvalidError,
  PluginCollisionError,
  OwnPluginIdCollisionError,
  RefNotFoundError,
  SettingsLockTimeoutError,
  DriftDetectedError,
  SemVerInvalidError,
  PublishAuthMissingError,
  RepoAlreadyExistsError,
  PublishConflictError,
  TagConflictError,
  CredentialStoreUnavailableError,
  OperationNotAllowedForOriginError,
} from '../../../src/main/domain/plugin-errors.js';

describe('PluginIdInvalidError', () => {
  it('should be an instanceof PluginIdInvalidError', () => {
    const err = new PluginIdInvalidError('Invalid plugin ID', { raw: 'bad-id!' });
    expect(err).toBeInstanceOf(PluginIdInvalidError);
  });

  it('should be an instanceof Error', () => {
    const err = new PluginIdInvalidError('Invalid plugin ID');
    expect(err).toBeInstanceOf(Error);
  });

  it('should have correct name property', () => {
    const err = new PluginIdInvalidError('Invalid plugin ID');
    expect(err.name).toBe('PluginIdInvalidError');
  });

  it('should preserve details when provided', () => {
    const details = { raw: 'bad-id!' };
    const err = new PluginIdInvalidError('Invalid plugin ID', details);
    expect(err.details).toEqual(details);
  });

  it('should have undefined details when not provided', () => {
    const err = new PluginIdInvalidError('Invalid plugin ID');
    expect(err.details).toBeUndefined();
  });
});

describe('ManifestInvalidError', () => {
  it('should be an instanceof ManifestInvalidError', () => {
    const err = new ManifestInvalidError('Invalid manifest', {
      path: '/path/to/manifest.json',
      reason: 'Missing required field',
    });
    expect(err).toBeInstanceOf(ManifestInvalidError);
  });

  it('should be an instanceof Error', () => {
    const err = new ManifestInvalidError('Invalid manifest');
    expect(err).toBeInstanceOf(Error);
  });

  it('should have correct name property', () => {
    const err = new ManifestInvalidError('Invalid manifest');
    expect(err.name).toBe('ManifestInvalidError');
  });

  it('should preserve details when provided', () => {
    const details = { path: '/path/to/manifest.json', reason: 'Missing field' };
    const err = new ManifestInvalidError('Invalid manifest', details);
    expect(err.details).toEqual(details);
  });

  it('should have undefined details when not provided', () => {
    const err = new ManifestInvalidError('Invalid manifest');
    expect(err.details).toBeUndefined();
  });
});

describe('PluginCollisionError', () => {
  it('should be an instanceof PluginCollisionError', () => {
    const err = new PluginCollisionError('Plugin collision detected', { id: 'plugin-1' });
    expect(err).toBeInstanceOf(PluginCollisionError);
  });

  it('should be an instanceof Error', () => {
    const err = new PluginCollisionError('Plugin collision detected');
    expect(err).toBeInstanceOf(Error);
  });

  it('should have correct name property', () => {
    const err = new PluginCollisionError('Plugin collision detected');
    expect(err.name).toBe('PluginCollisionError');
  });

  it('should preserve details when provided', () => {
    const details = { id: 'plugin-1' };
    const err = new PluginCollisionError('Plugin collision detected', details);
    expect(err.details).toEqual(details);
  });

  it('should have undefined details when not provided', () => {
    const err = new PluginCollisionError('Plugin collision detected');
    expect(err.details).toBeUndefined();
  });
});

describe('OwnPluginIdCollisionError', () => {
  it('should be an instanceof OwnPluginIdCollisionError', () => {
    const err = new OwnPluginIdCollisionError('Own plugin ID collision', { id: 'own-plugin' });
    expect(err).toBeInstanceOf(OwnPluginIdCollisionError);
  });

  it('should be an instanceof Error', () => {
    const err = new OwnPluginIdCollisionError('Own plugin ID collision');
    expect(err).toBeInstanceOf(Error);
  });

  it('should have correct name property', () => {
    const err = new OwnPluginIdCollisionError('Own plugin ID collision');
    expect(err.name).toBe('OwnPluginIdCollisionError');
  });

  it('should preserve details when provided', () => {
    const details = { id: 'own-plugin' };
    const err = new OwnPluginIdCollisionError('Own plugin ID collision', details);
    expect(err.details).toEqual(details);
  });

  it('should have undefined details when not provided', () => {
    const err = new OwnPluginIdCollisionError('Own plugin ID collision');
    expect(err.details).toBeUndefined();
  });
});

describe('RefNotFoundError', () => {
  it('should be an instanceof RefNotFoundError', () => {
    const err = new RefNotFoundError('Reference not found', { ref: 'missing-ref' });
    expect(err).toBeInstanceOf(RefNotFoundError);
  });

  it('should be an instanceof Error', () => {
    const err = new RefNotFoundError('Reference not found');
    expect(err).toBeInstanceOf(Error);
  });

  it('should have correct name property', () => {
    const err = new RefNotFoundError('Reference not found');
    expect(err.name).toBe('RefNotFoundError');
  });

  it('should preserve details when provided', () => {
    const details = { ref: 'missing-ref', url: 'https://example.com/ref' };
    const err = new RefNotFoundError('Reference not found', details);
    expect(err.details).toEqual(details);
  });

  it('should have undefined details when not provided', () => {
    const err = new RefNotFoundError('Reference not found');
    expect(err.details).toBeUndefined();
  });
});

describe('SettingsLockTimeoutError', () => {
  it('should be an instanceof SettingsLockTimeoutError', () => {
    const err = new SettingsLockTimeoutError('Lock timeout', { path: '/settings' });
    expect(err).toBeInstanceOf(SettingsLockTimeoutError);
  });

  it('should be an instanceof Error', () => {
    const err = new SettingsLockTimeoutError('Lock timeout');
    expect(err).toBeInstanceOf(Error);
  });

  it('should have correct name property', () => {
    const err = new SettingsLockTimeoutError('Lock timeout');
    expect(err.name).toBe('SettingsLockTimeoutError');
  });

  it('should preserve details when provided', () => {
    const details = { path: '/settings', timeoutMs: 5000 };
    const err = new SettingsLockTimeoutError('Lock timeout', details);
    expect(err.details).toEqual(details);
  });

  it('should have undefined details when not provided', () => {
    const err = new SettingsLockTimeoutError('Lock timeout');
    expect(err.details).toBeUndefined();
  });
});

describe('DriftDetectedError', () => {
  it('should be an instanceof DriftDetectedError', () => {
    const err = new DriftDetectedError('Drift detected', { id: 'plugin-1', kind: 'manifest' });
    expect(err).toBeInstanceOf(DriftDetectedError);
  });

  it('should be an instanceof Error', () => {
    const err = new DriftDetectedError('Drift detected');
    expect(err).toBeInstanceOf(Error);
  });

  it('should have correct name property', () => {
    const err = new DriftDetectedError('Drift detected');
    expect(err.name).toBe('DriftDetectedError');
  });

  it('should preserve details when provided', () => {
    const details = { id: 'plugin-1', kind: 'manifest' };
    const err = new DriftDetectedError('Drift detected', details);
    expect(err.details).toEqual(details);
  });

  it('should have undefined details when not provided', () => {
    const err = new DriftDetectedError('Drift detected');
    expect(err.details).toBeUndefined();
  });
});

describe('SemVerInvalidError', () => {
  it('should be an instanceof SemVerInvalidError', () => {
    const err = new SemVerInvalidError('Invalid semver', { raw: 'bad-version' });
    expect(err).toBeInstanceOf(SemVerInvalidError);
  });

  it('should be an instanceof Error', () => {
    const err = new SemVerInvalidError('Invalid semver');
    expect(err).toBeInstanceOf(Error);
  });

  it('should have correct name property', () => {
    const err = new SemVerInvalidError('Invalid semver');
    expect(err.name).toBe('SemVerInvalidError');
  });

  it('should preserve details when provided', () => {
    const details = { raw: 'bad-version' };
    const err = new SemVerInvalidError('Invalid semver', details);
    expect(err.details).toEqual(details);
  });

  it('should have undefined details when not provided', () => {
    const err = new SemVerInvalidError('Invalid semver');
    expect(err.details).toBeUndefined();
  });
});

describe('PublishAuthMissingError', () => {
  it('should be an instanceof PublishAuthMissingError', () => {
    const err = new PublishAuthMissingError('Auth missing', { token: undefined });
    expect(err).toBeInstanceOf(PublishAuthMissingError);
  });

  it('should be an instanceof Error', () => {
    const err = new PublishAuthMissingError('Auth missing');
    expect(err).toBeInstanceOf(Error);
  });

  it('should have correct name property', () => {
    const err = new PublishAuthMissingError('Auth missing');
    expect(err.name).toBe('PublishAuthMissingError');
  });

  it('should preserve details when provided', () => {
    const details: Record<string, unknown> = { token: undefined };
    const err = new PublishAuthMissingError('Auth missing', details);
    expect(err.details).toEqual(details);
  });

  it('should have undefined details when not provided', () => {
    const err = new PublishAuthMissingError('Auth missing');
    expect(err.details).toBeUndefined();
  });
});

describe('RepoAlreadyExistsError', () => {
  it('should be an instanceof RepoAlreadyExistsError', () => {
    const err = new RepoAlreadyExistsError('Repo exists', { repoName: 'my-repo' });
    expect(err).toBeInstanceOf(RepoAlreadyExistsError);
  });

  it('should be an instanceof Error', () => {
    const err = new RepoAlreadyExistsError('Repo exists');
    expect(err).toBeInstanceOf(Error);
  });

  it('should have correct name property', () => {
    const err = new RepoAlreadyExistsError('Repo exists');
    expect(err.name).toBe('RepoAlreadyExistsError');
  });

  it('should preserve details when provided', () => {
    const details = { repoName: 'my-repo' };
    const err = new RepoAlreadyExistsError('Repo exists', details);
    expect(err.details).toEqual(details);
  });

  it('should have undefined details when not provided', () => {
    const err = new RepoAlreadyExistsError('Repo exists');
    expect(err.details).toBeUndefined();
  });
});

describe('PublishConflictError', () => {
  it('should be an instanceof PublishConflictError', () => {
    const err = new PublishConflictError('Conflict', { localSha: 'abc123' });
    expect(err).toBeInstanceOf(PublishConflictError);
  });

  it('should be an instanceof Error', () => {
    const err = new PublishConflictError('Conflict');
    expect(err).toBeInstanceOf(Error);
  });

  it('should have correct name property', () => {
    const err = new PublishConflictError('Conflict');
    expect(err.name).toBe('PublishConflictError');
  });

  it('should preserve details when provided', () => {
    const details = { localSha: 'abc123', remoteSha: 'def456' };
    const err = new PublishConflictError('Conflict', details);
    expect(err.details).toEqual(details);
  });

  it('should have undefined details when not provided', () => {
    const err = new PublishConflictError('Conflict');
    expect(err.details).toBeUndefined();
  });
});

describe('TagConflictError', () => {
  it('should be an instanceof TagConflictError', () => {
    const err = new TagConflictError('Tag conflict', { tag: 'v1.0.0' });
    expect(err).toBeInstanceOf(TagConflictError);
  });

  it('should be an instanceof Error', () => {
    const err = new TagConflictError('Tag conflict');
    expect(err).toBeInstanceOf(Error);
  });

  it('should have correct name property', () => {
    const err = new TagConflictError('Tag conflict');
    expect(err.name).toBe('TagConflictError');
  });

  it('should preserve details when provided', () => {
    const details = { tag: 'v1.0.0' };
    const err = new TagConflictError('Tag conflict', details);
    expect(err.details).toEqual(details);
  });

  it('should have undefined details when not provided', () => {
    const err = new TagConflictError('Tag conflict');
    expect(err.details).toBeUndefined();
  });
});

describe('CredentialStoreUnavailableError', () => {
  it('should be an instanceof CredentialStoreUnavailableError', () => {
    const err = new CredentialStoreUnavailableError('Store unavailable', { reason: 'locked' });
    expect(err).toBeInstanceOf(CredentialStoreUnavailableError);
  });

  it('should be an instanceof Error', () => {
    const err = new CredentialStoreUnavailableError('Store unavailable');
    expect(err).toBeInstanceOf(Error);
  });

  it('should have correct name property', () => {
    const err = new CredentialStoreUnavailableError('Store unavailable');
    expect(err.name).toBe('CredentialStoreUnavailableError');
  });

  it('should preserve details when provided', () => {
    const details: Record<string, unknown> = { reason: 'locked' };
    const err = new CredentialStoreUnavailableError('Store unavailable', details);
    expect(err.details).toEqual(details);
  });

  it('should have undefined details when not provided', () => {
    const err = new CredentialStoreUnavailableError('Store unavailable');
    expect(err.details).toBeUndefined();
  });
});

describe('OperationNotAllowedForOriginError', () => {
  it('should be an instanceof OperationNotAllowedForOriginError', () => {
    const err = new OperationNotAllowedForOriginError('Operation not allowed', {
      origin: 'external',
      operation: 'delete',
    });
    expect(err).toBeInstanceOf(OperationNotAllowedForOriginError);
  });

  it('should be an instanceof Error', () => {
    const err = new OperationNotAllowedForOriginError('Operation not allowed');
    expect(err).toBeInstanceOf(Error);
  });

  it('should have correct name property', () => {
    const err = new OperationNotAllowedForOriginError('Operation not allowed');
    expect(err.name).toBe('OperationNotAllowedForOriginError');
  });

  it('should preserve details when provided', () => {
    const details = { origin: 'external', operation: 'delete' };
    const err = new OperationNotAllowedForOriginError('Operation not allowed', details);
    expect(err.details).toEqual(details);
  });

  it('should have undefined details when not provided', () => {
    const err = new OperationNotAllowedForOriginError('Operation not allowed');
    expect(err.details).toBeUndefined();
  });
});
