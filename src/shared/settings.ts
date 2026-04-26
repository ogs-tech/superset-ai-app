export type AdapterScope = 'personal' | 'project';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface AdapterSettings {
  enabled: boolean;
  defaultScope: AdapterScope;
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
  workspacePath: string;
  adapters: {
    claude: AdapterSettings;
    copilot: AdapterSettings;
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
    workspacePath: '',
    adapters: {
      claude: { enabled: true, defaultScope: 'personal' },
      copilot: { enabled: false, defaultScope: 'personal' },
    },
    linkedRepos: [],
    ui: { theme: 'system' },
  };
}
