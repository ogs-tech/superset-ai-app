import {
  House, SlidersHorizontal, Puzzle, Activity, Sparkles, Bot,
  MessageSquareText, Webhook, NotebookPen, Store, Plug, type LucideIcon,
} from 'lucide-react';

export type Area = 'inicio' | 'biblioteca' | 'plugins' | 'diagnostico';
export type LibrarySub = 'skills' | 'agents' | 'commands' | 'hooks' | 'global-instructions' | 'mcps';
export type PluginsSub = 'plugins' | 'marketplaces';

export type Nav =
  | { area: 'inicio' }
  | { area: 'biblioteca'; sub: LibrarySub }
  | { area: 'plugins'; sub: PluginsSub }
  | { area: 'diagnostico' };

export interface AreaDef { area: Area; label: string; glyph: LucideIcon; }
export interface SubDef<S> { sub: S; label: string; glyph: LucideIcon; }

export const NAV_AREAS: ReadonlyArray<AreaDef> = [
  { area: 'inicio', label: 'Início', glyph: House },
  { area: 'biblioteca', label: 'Biblioteca', glyph: SlidersHorizontal },
  { area: 'plugins', label: 'Plugins', glyph: Puzzle },
  { area: 'diagnostico', label: 'Diagnóstico', glyph: Activity },
];

export const LIBRARY_SUBS: ReadonlyArray<SubDef<LibrarySub>> = [
  { sub: 'skills', label: 'Skills', glyph: Sparkles },
  { sub: 'agents', label: 'Agents', glyph: Bot },
  { sub: 'commands', label: 'Prompts', glyph: MessageSquareText },
  { sub: 'hooks', label: 'Hooks', glyph: Webhook },
  { sub: 'global-instructions', label: 'Global Instructions', glyph: NotebookPen },
  { sub: 'mcps', label: 'MCP', glyph: Plug },
];

export const PLUGINS_SUBS: ReadonlyArray<SubDef<PluginsSub>> = [
  { sub: 'plugins', label: 'Plugins', glyph: Puzzle },
  { sub: 'marketplaces', label: 'Marketplaces', glyph: Store },
];

export const defaultNav: Nav = { area: 'inicio' };

/** Stable `nav-<id>` testid: the sub id when present, else the area id. */
export function navTestId(nav: Nav): string {
  return 'sub' in nav ? `nav-${nav.sub}` : `nav-${nav.area}`;
}

/** Default sub when an area with subs is first entered. */
export function defaultSubFor(area: Area): Nav {
  if (area === 'biblioteca') return { area, sub: 'skills' };
  if (area === 'plugins') return { area, sub: 'plugins' };
  return { area } as Nav;
}
