import {
  SquareTerminal,
  SlidersHorizontal,
  Puzzle,
  Sparkles,
  Braces,
  Network,
} from 'lucide-react';
import { Icon } from '../../components/ds/Icon.js';

export const OFFICIAL_REPO = 'anthropics/claude-plugins-official';

export interface MarketplacePlugin {
  name: string;
  description: string;
  author?: { name: string };
  category?: string;
  source: unknown;
}

/**
 * The starter pack is organized into curated groups so the user installs only
 * the slices they want — never everything in one click. Ordering within a group
 * follows the `plugins` array order. Long/optional groups default to collapsed.
 */
export interface StarterGroup {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
  plugins: string[];
  defaultCollapsed?: boolean;
}

export const STARTER_PACK_GROUPS: StarterGroup[] = [
  {
    id: 'core-dev',
    label: 'Core dev workflow',
    description: 'The everyday loop — build, review, refactor, ship.',
    icon: <Icon glyph={SquareTerminal} size={20} />,
    accent: '#2b5cff',
    plugins: [
      'feature-dev',
      'superpowers',
      'code-review',
      'pr-review-toolkit',
      'code-simplifier',
      'code-modernization',
      'frontend-design',
      'commit-commands',
    ],
  },
  {
    id: 'claude-setup',
    label: 'Claude Code setup',
    description: 'Tune Claude Code itself — config, memory, and guardrails.',
    icon: <Icon glyph={SlidersHorizontal} size={20} />,
    accent: '#6f42c1',
    plugins: ['claude-code-setup', 'claude-md-management', 'hookify'],
  },
  {
    id: 'build-for-claude',
    label: 'Build for Claude',
    description: 'Author your own plugins, agents, and MCP servers.',
    icon: <Icon glyph={Puzzle} size={20} />,
    accent: '#0a7d6b',
    plugins: [
      'agent-sdk-dev',
      'mcp-server-dev',
      'plugin-dev',
      'example-plugin',
      'ralph-loop',
      'playground',
    ],
  },
  {
    id: 'output-styles',
    label: 'Output styles',
    description: 'Change how Claude explains and teaches as it works.',
    icon: <Icon glyph={Sparkles} size={20} />,
    accent: '#c9760a',
    plugins: ['explanatory-output-style', 'learning-output-style'],
  },
  {
    id: 'language-servers',
    label: 'Language servers',
    description: 'Per-language LSPs — add only the ones you code in.',
    icon: <Icon glyph={Braces} size={20} />,
    accent: '#2e7d32',
    defaultCollapsed: true,
    plugins: [
      'pyright-lsp',
      'gopls-lsp',
      'clangd-lsp',
      'csharp-lsp',
      'jdtls-lsp',
      'kotlin-lsp',
      'php-lsp',
      'lua-lsp',
    ],
  },
  {
    id: 'integrations',
    label: 'Integrations',
    description: 'Connect external tools and services via MCP.',
    icon: <Icon glyph={Network} size={20} />,
    accent: '#c2255c',
    defaultCollapsed: true,
    plugins: [
      'github',
      'gitlab',
      'linear',
      'atlassian',
      'figma',
      'playwright',
      'context7',
      'greptile',
      'serena',
    ],
  },
];

export const RECOMMENDED_PLUGIN_NAMES = new Set(
  STARTER_PACK_GROUPS.flatMap((g) => g.plugins),
);
