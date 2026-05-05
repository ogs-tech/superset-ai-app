export type MarketplacePluginSource =
  | { source: 'git-subdir'; url: string; path: string; ref?: string; sha?: string }
  | { source: 'url'; url: string; sha?: string }
  | { source: 'github'; repo: string; commit?: string }
  | { source: 'git'; url: string; ref?: string; sha?: string }
  | { source: string; [key: string]: unknown }
  | string;

export type MarketplacePlugin = {
  name: string;
  description: string;
  author?: { name: string };
  category?: string;
  source: MarketplacePluginSource;
  homepage?: string;
};

export type MarketplaceManifest = {
  name: string;
  owner?: { name: string; email?: string };
  description?: string;
  plugins: MarketplacePlugin[];
};
