import type { SemVer } from './semver.js';

export type PluginPublishInfo = {
  remoteUrl: string;
  visibility: 'public' | 'private';
  lastPublishedSha: string;
  lastPublishedVersion: SemVer;
  lastPublishedAt: string; // ISO8601 datetime string
};
