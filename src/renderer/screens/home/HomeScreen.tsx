import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Container,
  Grid,
  Link,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import TerminalIcon from '@mui/icons-material/Terminal';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import EditNoteIcon from '@mui/icons-material/EditNote';
import ExtensionIcon from '@mui/icons-material/Extension';
import StorefrontIcon from '@mui/icons-material/Storefront';
import VerifiedIcon from '@mui/icons-material/Verified';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { callIpc, IpcCallError } from '../../lib/ipc.js';
import type { SidebarTab } from '../../components/Sidebar.js';

interface CustomizationLite {
  id: string;
  frontmatter: {
    name: string;
    description: string;
    version: string;
  };
}

interface PluginListItem {
  id: string;
  origin: 'imported' | 'owned';
  enabled: boolean;
  installedAt: string;
  marketplaceId?: string;
}

type MarketplaceSource =
  | { kind: 'directory'; path: string }
  | { kind: 'github'; repo: string; cachePath?: string }
  | { kind: 'git'; url: string; ref?: string; cachePath?: string }
  | { kind: 'url'; url: string; cachePath?: string };

interface MarketplaceSummary {
  id: string;
  source: MarketplaceSource;
  manifest?: {
    name: string;
    description?: string;
    plugins: { name: string }[];
  };
}

interface HomeScreenProps {
  onNavigate: (tab: SidebarTab) => void;
}

const SKILLFORGE_LOCAL_ID = 'skillforge-imports';
const OFFICIAL_REPO = 'anthropics/claude-plugins-official';

interface ManagementCardSpec {
  id: SidebarTab;
  label: string;
  icon: React.ReactElement;
  color: string;
}

const MANAGEMENT_CARDS: ReadonlyArray<ManagementCardSpec> = [
  { id: 'skills', label: 'Skills', icon: <AutoAwesomeIcon />, color: '#6f42c1' },
  { id: 'agents', label: 'Agents', icon: <SmartToyIcon />, color: '#0ea5e9' },
  { id: 'commands', label: 'Commands', icon: <TerminalIcon />, color: '#f59e0b' },
  { id: 'references', label: 'References', icon: <MenuBookIcon />, color: '#10b981' },
  { id: 'global-instructions', label: 'Global Instructions', icon: <EditNoteIcon />, color: '#ef4444' },
  { id: 'plugins', label: 'Plugins', icon: <ExtensionIcon />, color: '#2b5cff' },
];

export function HomeScreen({ onNavigate }: HomeScreenProps): React.ReactElement {
  const [counts, setCounts] = useState<Record<SidebarTab, number | null>>({
    home: 0,
    skills: null,
    agents: null,
    commands: null,
    references: null,
    'global-instructions': null,
    templates: null,
    plugins: null,
    marketplaces: null,
  });
  const [recentPlugins, setRecentPlugins] = useState<PluginListItem[]>([]);
  const [marketplaces, setMarketplaces] = useState<MarketplaceSummary[]>([]);
  const [hasGlobalInstruction, setHasGlobalInstruction] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [skills, agents, commands, refs, plugins, marketplaceList, gi] = await Promise.all([
          callIpc<CustomizationLite[]>('skill.list', { scope: 'personal' }),
          callIpc<CustomizationLite[]>('agent.list', { scope: 'personal' }),
          callIpc<CustomizationLite[]>('command.list', { scope: 'personal' }),
          callIpc<CustomizationLite[]>('reference.list', {}),
          callIpc<PluginListItem[]>('plugin.list', { scope: 'personal' }),
          callIpc<MarketplaceSummary[]>('marketplace.list', { scope: 'personal' }),
          callIpc<CustomizationLite>('global-instruction.get', { id: 'default' }).then(
            () => true,
            (err) => {
              if (err instanceof IpcCallError && err.kind === 'not_found') return false;
              throw err;
            },
          ),
        ]);

        if (cancelled) return;

        const filteredMarketplaces = marketplaceList.filter((m) => m.id !== SKILLFORGE_LOCAL_ID);
        const sortedPlugins = [...plugins].sort(
          (a, b) => (b.installedAt || '').localeCompare(a.installedAt || ''),
        );

        setCounts({
          home: 0,
          skills: skills.length,
          agents: agents.length,
          commands: commands.length,
          references: refs.length,
          'global-instructions': gi ? 1 : 0,
          templates: 0,
          plugins: plugins.length,
          marketplaces: filteredMarketplaces.length,
        });
        setRecentPlugins(sortedPlugins.slice(0, 5));
        setMarketplaces(filteredMarketplaces);
        setHasGlobalInstruction(gi);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof IpcCallError ? err.message : String(err);
        setError(message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const officialMarketplace = useMemo(
    () => marketplaces.find((m) => m.source.kind === 'github' && m.source.repo === OFFICIAL_REPO),
    [marketplaces],
  );

  return (
    <Container component="main" data-testid="home-screen" maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={1} sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
          Welcome back
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Manage your Claude Code customizations, plugins, and marketplaces from one place.
        </Typography>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {hasGlobalInstruction === false && (
        <Paper
          variant="outlined"
          data-testid="suggest-sde-card"
          sx={{
            mb: 4,
            p: 2.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            background: (theme) =>
              `linear-gradient(135deg, ${theme.palette.primary.main}11, ${theme.palette.secondary.main}11)`,
            borderColor: 'primary.light',
          }}
        >
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Set up your SDE global instruction
            </Typography>
            <Typography variant="body2" color="text.secondary">
              We ship a template tailored for software engineers — coding style, review preferences, action safety. Apply it in one click.
            </Typography>
          </Box>
          <Button
            variant="contained"
            endIcon={<ArrowForwardIcon />}
            onClick={() => onNavigate('global-instructions')}
          >
            Configure
          </Button>
        </Paper>
      )}

      <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        Manage
      </Typography>
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {MANAGEMENT_CARDS.map((card) => {
          const count = counts[card.id];
          return (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={card.id}>
              <Card
                variant="outlined"
                sx={{
                  height: '100%',
                  transition: 'transform 120ms, border-color 120ms',
                  '&:hover': { borderColor: 'primary.main', transform: 'translateY(-1px)' },
                }}
              >
                <CardActionArea
                  data-testid={`home-card-${card.id}`}
                  onClick={() => onNavigate(card.id)}
                  sx={{ height: '100%' }}
                >
                  <CardContent>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 1.5 }}>
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: card.color,
                          backgroundColor: `${card.color}1a`,
                        }}
                      >
                        {card.icon}
                      </Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {card.label}
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
                      {count === null ? (
                        <Skeleton width={36} height={36} />
                      ) : (
                        <Typography variant="h4" sx={{ fontWeight: 600, lineHeight: 1 }}>
                          {count}
                        </Typography>
                      )}
                      <Typography variant="caption" color="text.secondary">
                        {card.id === 'global-instructions'
                          ? count === 1
                            ? 'configured'
                            : 'not configured'
                          : count === 1
                            ? 'item'
                            : 'items'}
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.5} sx={{ mt: 1.5, alignItems: 'center', color: 'primary.main' }}>
                      <Typography variant="caption" sx={{ fontWeight: 500 }}>
                        Manage
                      </Typography>
                      <ArrowForwardIcon sx={{ fontSize: 14 }} />
                    </Stack>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="overline" color="text.secondary">
              Recently installed plugins
            </Typography>
            <Link
              component="button"
              variant="caption"
              data-testid="home-plugins-link"
              onClick={() => onNavigate('plugins')}
              underline="hover"
            >
              Manage all →
            </Link>
          </Stack>
          <Paper variant="outlined" sx={{ minHeight: 160 }}>
            {recentPlugins.length === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
                <Typography variant="body2">No plugins installed yet.</Typography>
                <Button
                  size="small"
                  sx={{ mt: 1 }}
                  onClick={() => onNavigate('marketplaces')}
                  endIcon={<ArrowForwardIcon />}
                >
                  Browse marketplaces
                </Button>
              </Box>
            ) : (
              <Stack divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}>
                {recentPlugins.map((plugin) => (
                  <Box
                    key={plugin.id}
                    data-testid={`home-recent-plugin-${plugin.id}`}
                    sx={{ p: 1.75, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {plugin.id}
                      </Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 0.25 }}>
                        <Chip
                          label={plugin.origin}
                          size="small"
                          variant="outlined"
                          sx={{ height: 18, fontSize: 10 }}
                        />
                        {plugin.marketplaceId && plugin.marketplaceId !== SKILLFORGE_LOCAL_ID && (
                          <Chip
                            label={plugin.marketplaceId}
                            size="small"
                            variant="outlined"
                            sx={{ height: 18, fontSize: 10 }}
                          />
                        )}
                        {!plugin.enabled && (
                          <Chip
                            label="disabled"
                            size="small"
                            color="warning"
                            variant="outlined"
                            sx={{ height: 18, fontSize: 10 }}
                          />
                        )}
                      </Stack>
                    </Box>
                    {plugin.installedAt && (
                      <Typography variant="caption" color="text.secondary">
                        {formatRelativeDate(plugin.installedAt)}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Stack>
            )}
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="overline" color="text.secondary">
              Marketplaces
            </Typography>
            <Link
              component="button"
              variant="caption"
              data-testid="home-marketplaces-link"
              onClick={() => onNavigate('marketplaces')}
              underline="hover"
            >
              Browse →
            </Link>
          </Stack>
          <Paper variant="outlined" sx={{ minHeight: 160 }}>
            {marketplaces.length === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
                <Typography variant="body2">No marketplaces configured.</Typography>
              </Box>
            ) : (
              <Stack divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}>
                {officialMarketplace && (
                  <MarketplaceRow
                    marketplace={officialMarketplace}
                    isOfficial
                    onClick={() => onNavigate('marketplaces')}
                  />
                )}
                {marketplaces
                  .filter((m) => m.id !== officialMarketplace?.id)
                  .slice(0, 4)
                  .map((m) => (
                    <MarketplaceRow
                      key={m.id}
                      marketplace={m}
                      isOfficial={false}
                      onClick={() => onNavigate('marketplaces')}
                    />
                  ))}
              </Stack>
            )}
          </Paper>
        </Grid>
      </Grid>

      <Stack direction="row" spacing={1} sx={{ mt: 4, alignItems: 'center', justifyContent: 'flex-end' }}>
        <StorefrontIcon fontSize="small" color="disabled" />
        <Typography variant="caption" color="text.secondary">
          Suggested marketplaces appear automatically on first launch.
        </Typography>
      </Stack>
    </Container>
  );
}

interface MarketplaceRowProps {
  marketplace: MarketplaceSummary;
  isOfficial: boolean;
  onClick: () => void;
}

function MarketplaceRow({ marketplace, isOfficial, onClick }: MarketplaceRowProps): React.ReactElement {
  const pluginCount = marketplace.manifest?.plugins.length ?? 0;
  return (
    <Box
      data-testid={`home-marketplace-${marketplace.id}`}
      onClick={onClick}
      sx={{
        p: 1.75,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'pointer',
        '&:hover': { backgroundColor: 'action.hover' },
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {marketplace.manifest?.name ?? marketplace.id}
          </Typography>
          {isOfficial && (
            <Chip
              icon={<VerifiedIcon sx={{ fontSize: 12 }} />}
              label="official"
              size="small"
              color="primary"
              sx={{ height: 18, fontSize: 10, '& .MuiChip-icon': { fontSize: 12 } }}
            />
          )}
        </Stack>
        {marketplace.manifest?.description && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {marketplace.manifest.description}
          </Typography>
        )}
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', ml: 2 }}>
        {pluginCount} plugin{pluginCount === 1 ? '' : 's'}
      </Typography>
    </Box>
  );
}

function formatRelativeDate(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return '';
  const diffMs = Date.now() - ts;
  const day = 1000 * 60 * 60 * 24;
  if (diffMs < day) return 'today';
  if (diffMs < 2 * day) return 'yesterday';
  if (diffMs < 30 * day) return `${Math.floor(diffMs / day)}d ago`;
  return new Date(ts).toLocaleDateString();
}
