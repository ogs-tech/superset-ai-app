import { useState, useMemo } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { callIpc, IpcCallError } from '../../lib/ipc.js';
import type { MarketplaceManifestIpc, MarketplacePluginIpc } from '../../../shared/plugin-ipc-types.js';

interface MarketplaceDialogProps {
  open: boolean;
  marketplace: MarketplaceManifestIpc;
  scope: 'personal' | 'project';
  onClose: () => void;
  onInstalled: (pluginId: string) => void;
}

type InstallState = 'idle' | 'loading' | 'done';

export function MarketplaceDialog({
  open,
  marketplace,
  scope,
  onClose,
  onInstalled,
}: MarketplaceDialogProps): React.ReactElement {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [installStates, setInstallStates] = useState<Record<string, InstallState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const categories = useMemo(() => {
    const seen = new Set<string>();
    for (const p of marketplace.plugins) if (p.category) seen.add(p.category);
    return Array.from(seen).sort();
  }, [marketplace.plugins]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return marketplace.plugins.filter((p) => {
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        (p.author?.name ?? '').toLowerCase().includes(q);
      const matchesCategory = !selectedCategory || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [marketplace.plugins, search, selectedCategory]);

  const handleInstall = async (plugin: MarketplacePluginIpc): Promise<void> => {
    setInstallStates((s) => ({ ...s, [plugin.name]: 'loading' }));
    setErrors((e) => ({ ...e, [plugin.name]: '' }));
    try {
      const result = await callIpc<{ id: string }>('plugin.installFromMarketplace', {
        plugin,
        scope,
      });
      setInstallStates((s) => ({ ...s, [plugin.name]: 'done' }));
      onInstalled(result.id);
    } catch (err) {
      const message = err instanceof IpcCallError ? err.message : String(err);
      setInstallStates((s) => ({ ...s, [plugin.name]: 'idle' }));
      setErrors((e) => ({ ...e, [plugin.name]: message }));
    }
  };

  const handleClose = () => {
    setSearch('');
    setSelectedCategory(null);
    setInstallStates({});
    setErrors({});
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      data-testid="marketplace-dialog"
    >
      <DialogTitle>
        <Typography variant="h6">{marketplace.name}</Typography>
        {marketplace.description && (
          <Typography variant="body2" color="text.secondary">
            {marketplace.description}
          </Typography>
        )}
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0 }}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search plugins..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
            data-testid="marketplace-search"
          />
          {categories.length > 0 && (
            <Stack direction="row" spacing={0.5} sx={{ mt: 1.5, flexWrap: 'wrap', gap: 0.5 }}>
              <Chip
                label="All"
                size="small"
                onClick={() => setSelectedCategory(null)}
                color={selectedCategory === null ? 'primary' : 'default'}
              />
              {categories.map((cat) => (
                <Chip
                  key={cat}
                  label={cat}
                  size="small"
                  onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
                  color={selectedCategory === cat ? 'primary' : 'default'}
                />
              ))}
            </Stack>
          )}
        </Box>

        <Box sx={{ maxHeight: 480, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
              <Typography variant="body2">No plugins match your search.</Typography>
            </Box>
          ) : (
            <List disablePadding>
              {filtered.map((plugin, idx) => {
                const state = installStates[plugin.name] ?? 'idle';
                const error = errors[plugin.name];
                return (
                  <Box key={plugin.name}>
                    {idx > 0 && <Divider />}
                    <ListItem
                      data-testid={`marketplace-plugin-${plugin.name}`}
                      alignItems="flex-start"
                      sx={{ py: 1.5 }}
                      secondaryAction={
                        <Button
                          size="small"
                          variant={state === 'done' ? 'text' : 'outlined'}
                          disabled={state === 'loading' || state === 'done'}
                          onClick={() => void handleInstall(plugin)}
                          startIcon={state === 'loading' ? <CircularProgress size={14} /> : undefined}
                          data-testid={`marketplace-install-${plugin.name}`}
                        >
                          {state === 'done' ? 'Installed' : state === 'loading' ? 'Installing...' : 'Install'}
                        </Button>
                      }
                    >
                      <ListItemText
                        primary={
                          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', pr: 12 }}>
                            <Typography variant="body2" fontWeight="medium">
                              {plugin.name}
                            </Typography>
                            {plugin.category && <Chip label={plugin.category} size="small" variant="outlined" />}
                            {plugin.author && (
                              <Typography variant="caption" color="text.secondary">
                                by {plugin.author.name}
                              </Typography>
                            )}
                          </Stack>
                        }
                        secondary={
                          <Box sx={{ pr: 12 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              {plugin.description}
                            </Typography>
                            {error && (
                              <Alert severity="error" sx={{ mt: 0.5, py: 0 }}>
                                {error}
                              </Alert>
                            )}
                          </Box>
                        }
                      />
                    </ListItem>
                  </Box>
                );
              })}
            </List>
          )}
        </Box>
      </DialogContent>

      <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          {filtered.length} of {marketplace.plugins.length} plugins
        </Typography>
        <Button onClick={handleClose}>Close</Button>
      </Box>
    </Dialog>
  );
}
