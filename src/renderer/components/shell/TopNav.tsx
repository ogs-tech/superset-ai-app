import { AppBar, Box, Button, IconButton, Stack, Tab, Tabs, Toolbar, Tooltip, Typography } from '@mui/material';
import { Command, Moon, Sun, Settings as SettingsGlyph } from 'lucide-react';
import { Logo } from '../../assets/Logo.js';
import { Icon } from '../ds/Icon.js';
import { Kicker } from '../ds/Kicker.js';
import { StatusPill, type StatusPillVariant } from '../ds/StatusPill.js';
import { useThemeMode } from '../../lib/theme-mode-context.js';
import { NAV_AREAS, type Area } from './nav.js';

interface TopNavProps {
  active: Area;
  onSelectArea: (area: Area) => void;
  onOpenSettings: () => void;
  onOpenCommandPalette: () => void;
  healthSeverity?: 'ok' | 'warning' | 'error';
}

const SYNC_VARIANT: Record<'ok' | 'warning' | 'error', StatusPillVariant> = {
  ok: 'synced',
  warning: 'unsynced',
  error: 'error',
};

const SYNC_LABEL: Record<'ok' | 'warning' | 'error', string> = {
  ok: 'sincronizado',
  warning: 'atenção',
  error: 'erro',
};

export function TopNav({
  active,
  onSelectArea,
  onOpenSettings,
  onOpenCommandPalette,
  healthSeverity,
}: TopNavProps): React.ReactElement {
  const { resolved, setTheme } = useThemeMode();
  const isDark = resolved === 'dark';

  return (
    <AppBar
      position="sticky"
      elevation={0}
      color="default"
      sx={(theme) => ({
        bgcolor: 'background.paper',
        borderBottom: `1px solid ${theme.palette.divider}`,
      })}
    >
      <Toolbar sx={{ gap: 2 }}>
        {/* Brand */}
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', color: 'text.primary' }}>
          <Logo />
          <Box sx={{ lineHeight: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.1 }}>
              Superset AI
            </Typography>
            <Kicker>OGS · TECNOLOGIA BRASIL</Kicker>
          </Box>
        </Stack>

        {/* Primary tabs */}
        <Tabs
          value={active}
          onChange={(_, v) => onSelectArea(v as Area)}
          textColor="inherit"
          indicatorColor="secondary"
          sx={{ ml: 2, flexGrow: 1, minHeight: 'auto' }}
        >
          {NAV_AREAS.map((a) => (
            <Tab
              key={a.area}
              value={a.area}
              label={a.label}
              data-testid={`nav-${a.area}`}
              icon={<Icon glyph={a.glyph} size={16} />}
              iconPosition="start"
              sx={{ minHeight: 48 }}
            />
          ))}
        </Tabs>

        {/* Right cluster */}
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Tooltip title="Buscar e navegar (⌘K)">
            <Button
              data-testid="command-palette-trigger"
              onClick={onOpenCommandPalette}
              color="inherit"
              variant="outlined"
              size="small"
              startIcon={<Icon glyph={Command} size={14} />}
            >
              ⌘K
            </Button>
          </Tooltip>

          {healthSeverity !== undefined && (
            <StatusPill
              variant={SYNC_VARIANT[healthSeverity]}
              label={SYNC_LABEL[healthSeverity]}
              testId="sync"
            />
          )}

          <Tooltip title={isDark ? 'Tema claro' : 'Tema escuro'}>
            <IconButton
              data-testid="theme-toggle"
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              size="small"
              sx={{ color: 'text.secondary' }}
              aria-label={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
            >
              <Icon glyph={isDark ? Sun : Moon} size={18} />
            </IconButton>
          </Tooltip>

          <Tooltip title="Configurações">
            <IconButton
              data-testid="nav-settings"
              onClick={onOpenSettings}
              size="small"
              sx={{ color: 'text.secondary' }}
              aria-label="Configurações"
            >
              <Icon glyph={SettingsGlyph} size={18} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
