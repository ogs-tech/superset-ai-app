import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Container,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import { callIpc, IpcCallError } from '../../lib/ipc.js';
import { Toast, type ToastMessage } from '../../components/Toast.js';
import { CustomizationEditor } from '../customizations/CustomizationEditor.js';
import type { Customization } from '../../../shared/customization.js';
import type { Template } from '../../../shared/template.js';

const SLUG = 'default';

export function GlobalInstructionScreen(): React.ReactElement {
  const [existing, setExisting] = useState<Customization | null>(null);
  const [editor, setEditor] = useState<{
    kind: 'closed' | 'edit' | 'create';
    customization?: Customization;
    isCreate?: boolean;
  }>({ kind: 'closed' });
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const load = async (): Promise<void> => {
    try {
      const c = await callIpc<Customization>('global-instruction.get', { id: SLUG });
      setExisting(c);
    } catch (err) {
      if (err instanceof IpcCallError && err.kind === 'not_found') {
        setExisting(null);
        return;
      }
      const message = err instanceof IpcCallError ? err.message : String(err);
      setToast({ variant: 'error', message });
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleEdit = async (): Promise<void> => {
    if (existing) {
      setEditor({ kind: 'edit', customization: existing, isCreate: false });
      return;
    }
    try {
      const list = await callIpc<Template[]>('template.list', {
        targetType: 'global-instruction',
      });
      const template = list[0];
      if (!template) {
        setToast({ variant: 'error', message: 'global-instruction template not found' });
        return;
      }
      setEditor({
        kind: 'create',
        customization: customizationFromTemplate(template),
        isCreate: true,
      });
    } catch (err) {
      const message = err instanceof IpcCallError ? err.message : String(err);
      setToast({ variant: 'error', message });
    }
  };

  if (editor.kind !== 'closed' && editor.customization) {
    return (
      <CustomizationEditor
        initial={editor.customization}
        isCreate={editor.isCreate ?? false}
        onSaved={async (saved) => {
          setEditor({ kind: 'closed' });
          setToast({ variant: 'success', message: `${saved.frontmatter.name} saved` });
          await load();
        }}
        onCancel={() => setEditor({ kind: 'closed' })}
      />
    );
  }

  return (
    <Container
      component="main"
      data-testid="global-instruction-screen"
      maxWidth="md"
      sx={{ py: 4 }}
    >
      <Stack direction="row" sx={{ mb: 3, alignItems: 'center' }}>
        <Typography variant="h4" component="h1">
          Global Instructions
        </Typography>
      </Stack>

      <List data-testid="global-instruction-slots" disablePadding>
        <ListItem
          divider
          secondaryAction={
            <Button size="small" startIcon={<EditIcon fontSize="small" />} onClick={handleEdit}>
              Edit
            </Button>
          }
        >
          <ListItemText
            primary={<Box component="strong">Global instructions</Box>}
            secondary={existing ? '(configured)' : '(not configured)'}
          />
        </ListItem>
      </List>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </Container>
  );
}

function customizationFromTemplate(template: Template): Customization {
  const fm = template.frontmatter;
  return {
    id: '',
    frontmatter: {
      name: SLUG,
      type: 'global-instruction',
      description: fm.description,
      scopes: ['personal'],
      version: fm.version ?? '0.1.0',
      createdAt: '',
      updatedAt: '',
      ...(fm.tags ? { tags: fm.tags } : {}),
    },
    body: template.body,
  };
}
