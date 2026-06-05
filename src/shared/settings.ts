export type ThemeMode = 'system' | 'light' | 'dark';

export type LanguagePreference = 'off' | 'mirror' | 'pt-BR' | 'en' | 'es';

export interface AdapterSettings {
  enabled: boolean;
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
  };
  linkedRepos: LinkedRepo[];
  ui: UiSettings;
  language: LanguagePreference;
}

export const WorkspacePaths = [
  'skills',
  'agents',
  '_backups',
] as const;

export type WorkspacePath = (typeof WorkspacePaths)[number];

export function getDefaults(): Settings {
  return {
    adapters: {
      claude: { enabled: true },
    },
    linkedRepos: [],
    ui: { theme: 'system' },
    language: 'off',
  };
}
