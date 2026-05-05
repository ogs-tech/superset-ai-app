import React from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { CustomizationList } from '../customizations/CustomizationList.js';

interface PluginEditorProps {
  pluginId: string;
  onBack: () => void;
}

export function PluginEditor({ pluginId, onBack }: PluginEditorProps): React.ReactElement {
  const root = `plugin:${pluginId}`;
  return (
    <Box>
      <Box sx={{ px: 3, pt: 2, pb: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <Button startIcon={<ArrowBackIcon />} onClick={onBack}>Back</Button>
          <Typography variant="h6">Editing plugin: {pluginId}</Typography>
        </Stack>
      </Box>
      <CustomizationList root={root} />
    </Box>
  );
}
