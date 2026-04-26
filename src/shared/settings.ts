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
  branch: string;
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
