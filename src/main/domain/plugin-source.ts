import type { PluginRef } from './plugin-ref.js';

export type PluginSource = {
  kind: 'git';
  url: string;
  ref?: PluginRef;
};

/**
 * Normalizes a Git URL to a consistent format.
 *
 * - GitHub shorthand "owner/repo" → "https://github.com/owner/repo.git"
 * - HTTPS URLs without .git (github.com) → adds .git suffix
 * - HTTPS URLs with .git → returned as-is
 * - Non-GitHub HTTPS URLs → returned as-is
 * - SSH URLs (git@...) → returned as-is
 */
export function normalizeGitUrl(url: string): string {
  // Handle GitHub shorthand: "owner/repo" -> "https://github.com/owner/repo.git"
  if (!url.includes('://') && !url.startsWith('git@')) {
    return `https://github.com/${url}.git`;
  }

  // Handle HTTPS URLs
  if (url.startsWith('https://')) {
    // Only add .git for github.com URLs that don't already have it
    if (url.includes('github.com') && !url.endsWith('.git')) {
      return `${url}.git`;
    }
    return url;
  }

  // SSH URLs and other protocols: return as-is
  return url;
}

/**
 * Creates a PluginSource with a normalized URL.
 */
export function pluginSource(url: string, ref?: PluginRef): PluginSource {
  return {
    kind: 'git',
    url: normalizeGitUrl(url),
    ...(ref && { ref }),
  };
}
