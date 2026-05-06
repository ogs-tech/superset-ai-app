import type { PluginId } from './plugin-id.js';
import type { SemVer } from './semver.js';

export type PluginManifest = {
  id: PluginId;
  version: SemVer;
  description?: string;
  artifacts: {
    skills: string[];
    agents: string[];
    commands: string[];
    hooks: number;
    mcp: boolean;
    lsp: boolean;
  };
};
