export type ThemeMode = 'system' | 'light' | 'dark';

export interface AdapterSettings {
  enabled: boolean;
}

export interface CopilotAdapterSettings extends AdapterSettings {
  exclusiveSkillsWithClaude: boolean;
}

export interface LinkedRepo {
  id: string;
  name: string;
  path: string;
}

export interface LinkedRepoView {
  id: string;
  name: string;
  path: string;
  branch: string | null;
}

export interface UiSettings {
  theme: ThemeMode;
}

export interface Settings {
  adapters: {
    claude: AdapterSettings;
    copilot: CopilotAdapterSettings;
  };
  linkedRepos: LinkedRepo[];
  ui: UiSettings;
}

export const WorkspacePaths = [
  'skills',
  'references',
  'agents',
  '_generated',
  '_backups',
  '.sde/templates',
] as const;

export type WorkspacePath = (typeof WorkspacePaths)[number];

export function getDefaults(): Settings {
  return {
    adapters: {
      claude: { enabled: true },
      copilot: { enabled: false, exclusiveSkillsWithClaude: false },
    },
    linkedRepos: [],
    ui: { theme: 'system' },
  };
}
