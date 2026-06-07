import { Box, Button, Paper, Stack } from '@mui/material';
import { Pencil } from 'lucide-react';
import { Icon } from './ds/Icon.js';
import { Kicker } from './ds/Kicker.js';
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
  const pluginSource = entity?.source.kind === 'plugin' ? entity.source : null;

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
      badges={
        pluginSource ? (
          <PluginOriginBadge
            pluginId={pluginSource.pluginId}
            {...(pluginSource.provenance ? { provenance: pluginSource.provenance } : {})}
          />
        ) : undefined
      }
      testId="customization"
    >
      {entity && (
        <Stack spacing={2}>
          {pluginSource && <ReadOnlyNotice pluginId={pluginSource.pluginId} />}
          {isWorkspace && (
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<Icon glyph={Pencil} size={16} />}
                onClick={() => onEdit(entity)}
              >
                Edit
              </Button>
            </Stack>
          )}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Kicker>Body</Kicker>
            <Box sx={{ mt: 1, '& p': { my: 0.5 } }}>
              <ReactMarkdown>{entity.body}</ReactMarkdown>
            </Box>
          </Paper>
        </Stack>
      )}
    </DetailDrawer>
  );
}
