import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
  Typography,
} from '@mui/material';
import { callIpc, IpcCallError } from '../../lib/ipc.js';
import type { Template, TemplateTargetType } from '../../../shared/template.js';

interface NewFromTemplateDialogProps {
  targetType: TemplateTargetType;
  onSelect: (template: Template) => void;
  onCancel: () => void;
}

export function NewFromTemplateDialog({
  targetType,
  onSelect,
  onCancel,
}: NewFromTemplateDialogProps): React.ReactElement {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const list = await callIpc<Template[]>('template.list', { targetType });
        setTemplates(list);
      } catch (err) {
        const message = err instanceof IpcCallError ? err.message : String(err);
        setError(message);
      }
    })();
  }, [targetType]);

  return (
    <Dialog
      open
      onClose={onCancel}
      aria-label="Select template"
      data-testid="template-dialog"
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        Pick template{' '}
        <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}>
          ({targetType})
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {error && (
          <Alert severity="error" role="alert" sx={{ mb: 1.5 }}>
            {error}
          </Alert>
        )}
        {templates.length === 0 && !error && (
          <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
            No templates found.
          </Typography>
        )}
        <List disablePadding>
          {templates.map((tpl) => (
            <ListItemButton
              key={tpl.id}
              onClick={() => onSelect(tpl)}
              aria-label={tpl.frontmatter.name}
            >
              <ListItemText
                primary={<Box component="strong">{tpl.frontmatter.name}</Box>}
                secondary={tpl.frontmatter.description}
              />
            </ListItemButton>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}
