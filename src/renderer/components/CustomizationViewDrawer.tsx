import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import ReactMarkdown from 'react-markdown';
import { DetailDrawer } from './DetailDrawer.js';
import { ReadOnlyNotice } from './ReadOnlyNotice.js';
import { PluginOriginBadge } from './PluginOriginBadge.js';
import type { CustomizationListItem } from '../hooks/use-customization-list.js';

interface CustomizationViewDrawerProps {
  entity: CustomizationListItem | null;
  onClose: () => void;
  onEdit: (entity: CustomizationListItem) => void;
}

export function CustomizationViewDrawer({
  entity,
  onClose,
  onEdit,
}: CustomizationViewDrawerProps): React.ReactElement {
  const isWorkspace = entity?.source.kind === 'workspace';
  const pluginId = entity?.source.kind === 'plugin' ? entity.source.pluginId : null;

  return (
    <DetailDrawer
      open={entity !== null}
      onClose={onClose}
      title={entity?.frontmatter.name ?? ''}
      subtitle={
        typeof entity?.frontmatter.description === 'string'
          ? entity.frontmatter.description
          : undefined
      }
      badges={pluginId ? <PluginOriginBadge pluginId={pluginId} /> : undefined}
      testId="customization"
    >
      {entity && (
        <Stack spacing={2}>
          {pluginId && <ReadOnlyNotice pluginId={pluginId} />}
          {isWorkspace && (
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<EditIcon fontSize="small" />}
                onClick={() => onEdit(entity)}
              >
                Edit
              </Button>
            </Stack>
          )}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Body
            </Typography>
            <Box sx={{ mt: 1, '& p': { my: 0.5 } }}>
              <ReactMarkdown>{entity.body}</ReactMarkdown>
            </Box>
          </Paper>
        </Stack>
      )}
    </DetailDrawer>
  );
}
