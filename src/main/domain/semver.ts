import type { Result } from './plugin-id.js';
import { SemVerInvalidError } from './plugin-errors.js';

export type { Result };
export { SemVerInvalidError };

export type SemVer = string & { readonly __brand: 'SemVer' };

const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[\w.]+)?$/;

/**
 * Parse and validate a semantic version string.
 * Throws SemVerInvalidError if invalid.
 */
export function semVer(raw: string): SemVer {
  if (typeof raw !== 'string' || !SEMVER_PATTERN.test(raw)) {
    throw new SemVerInvalidError(
      `Invalid semantic version: '${raw}' (expected format: major.minor.patch[-prerelease])`,
      { raw },
    );
  }
  // Check for empty pre-release (e.g., '1.2.3-')
  if (raw.endsWith('-')) {
    throw new SemVerInvalidError(
      `Invalid semantic version: '${raw}' (pre-release cannot be empty)`,
      { raw },
    );
  }
  return raw as SemVer;
}

/**
 * Try to parse a semantic version string.
 * Returns a Result that never throws.
 */
export function trySemVer(raw: string): Result<SemVer, SemVerInvalidError> {
  try {
    return { ok: true, value: semVer(raw) };
  } catch (error) {
    if (error instanceof SemVerInvalidError) {
      return { ok: false, error };
    }
    throw error;
  }
}

interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease: string | null;
}

function parseVersion(ver: SemVer): ParsedVersion {
  const match = ver.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
  if (!match || !match[1] || !match[2] || !match[3]) {
    throw new Error(`Failed to parse version: ${ver}`);
  }

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] ?? null,
  };
}

/**
 * Compare two semantic versions.
 * Returns:
 *   -1 if a < b
 *    0 if a === b
 *    1 if a > b
 *
 * Pre-release versions are considered lower than release versions with the same base version.
 * Example: '1.0.0-rc.1' < '1.0.0'
 */
export function compareSemVer(a: SemVer, b: SemVer): -1 | 0 | 1 {
  const parsedA = parseVersion(a);
  const parsedB = parseVersion(b);

  // Compare major.minor.patch numerically
  if (parsedA.major !== parsedB.major) {
    return parsedA.major < parsedB.major ? -1 : 1;
  }

  if (parsedA.minor !== parsedB.minor) {
    return parsedA.minor < parsedB.minor ? -1 : 1;
  }

  if (parsedA.patch !== parsedB.patch) {
    return parsedA.patch < parsedB.patch ? -1 : 1;
  }

  // At this point, major.minor.patch are equal.
  // Handle pre-release comparison:
  // - No pre-release beats pre-release (e.g., '1.0.0' > '1.0.0-rc.1')
  // - If both have pre-release, compare them lexicographically
  if (parsedA.prerelease === null && parsedB.prerelease === null) {
    return 0;
  }

  if (parsedA.prerelease === null) {
    return 1; // a (no pre-release) > b (has pre-release)
  }

  if (parsedB.prerelease === null) {
    return -1; // a (has pre-release) < b (no pre-release)
  }

  // Both have pre-release: lexicographic comparison
  if (parsedA.prerelease < parsedB.prerelease) {
    return -1;
  }

  if (parsedA.prerelease > parsedB.prerelease) {
    return 1;
  }

  return 0;
}
