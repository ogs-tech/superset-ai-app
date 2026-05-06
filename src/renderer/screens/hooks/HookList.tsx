import { useEffect, useState } from 'react';
import {
  Box,
  Chip,
  Container,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import { callIpc, IpcCallError } from '../../lib/ipc.js';
import { Toast, type ToastMessage } from '../../components/Toast.js';
import { PluginOriginBadge } from '../../components/PluginOriginBadge.js';

interface HookHandler {
  type: 'command' | 'http' | 'mcp_tool' | 'prompt' | 'agent';
  command?: string;
  url?: string;
  prompt?: string;
}

interface Hook {
  id: string;
  event: string;
  matcher?: string;
  description?: string;
  handler: HookHandler;
  source: { kind: 'workspace' } | { kind: 'plugin'; pluginId: string };
}

export function HookList(): React.ReactElement {
  const [items, setItems] = useState<Hook[]>([]);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const load = async (): Promise<void> => {
    try {
      const list = await callIpc<Hook[]>('hook.list', { scope: 'personal' });
      setItems(Array.isArray(list) ? list : []);
    } catch (err) {
      const message = err instanceof IpcCallError ? err.message : String(err);
      setToast({ variant: 'error', message });
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  const handleDelete = async (hook: Hook): Promise<void> => {
    try {
      await callIpc('hook.delete', { id: hook.id, scope: 'personal' });
      setItems((prev) => prev.filter((h) => h.id !== hook.id));
      setToast({ variant: 'success', message: `Hook removed` });
    } catch (err) {
      const message = err instanceof IpcCallError ? err.message : String(err);
      setToast({ variant: 'error', message });
    }
  };

  return (
    <Container component="main" data-testid="hook-list" maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
        Hooks
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Hooks fire on Claude Code lifecycle events. Workspace hooks live in
        <code> ~/.claude/settings.json</code>; plugin hooks come bundled with installed plugins.
      </Typography>

      <List disablePadding>
        {items.length === 0 && (
          <Box
            sx={{
              border: 1,
              borderStyle: 'dashed',
              borderColor: 'divider',
              borderRadius: 1,
              p: 4,
              textAlign: 'center',
              color: 'text.secondary',
            }}
          >
            <Typography variant="body2">No hooks configured.</Typography>
          </Box>
        )}
        {items.map((hook) => {
          const isPlugin = hook.source.kind === 'plugin';
          const pluginId = isPlugin && hook.source.kind === 'plugin' ? hook.source.pluginId : null;
          return (
            <ListItem
              key={hook.id}
              data-testid={`hook-item-${hook.id}`}
              divider
              secondaryAction={
                isPlugin ? null : (
                  <Tooltip title="Delete">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => void handleDelete(hook)}
                      aria-label="Delete"
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )
              }
            >
              <ListItemText
                primary={
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <Chip label={hook.event} size="small" color="primary" variant="outlined" />
                    <Box component="strong">{describeHandler(hook.handler)}</Box>
                    {pluginId && <PluginOriginBadge pluginId={pluginId} />}
                  </Stack>
                }
                secondary={
                  hook.matcher
                    ? `matcher: ${hook.matcher}`
                    : hook.description ?? null
                }
              />
            </ListItem>
          );
        })}
      </List>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </Container>
  );
}

function describeHandler(handler: HookHandler): string {
  switch (handler.type) {
    case 'command':
      return handler.command ?? '(empty command)';
    case 'http':
      return `HTTP → ${handler.url ?? '(no url)'}`;
    case 'mcp_tool':
      return `MCP tool`;
    case 'prompt':
      return `prompt: ${(handler.prompt ?? '').slice(0, 60)}`;
    case 'agent':
      return `agent: ${(handler.prompt ?? '').slice(0, 60)}`;
    default:
      return handler.type;
  }
}
