import { Chip, Tooltip } from '@mui/material';
import { Puzzle } from 'lucide-react';
import { Icon } from './ds/Icon.js';

interface PluginOriginBadgeProps {
  pluginId: string;
}

export function PluginOriginBadge({ pluginId }: PluginOriginBadgeProps): React.ReactElement {
  return (
    <Tooltip title={`Provided by plugin '${pluginId}' (read-only)`}>
      <Chip
        size="small"
        variant="outlined"
        color="info"
        icon={<Icon glyph={Puzzle} size={16} />}
        label={pluginId}
        data-testid={`plugin-origin-badge-${pluginId}`}
        sx={{ ml: 1 }}
      />
    </Tooltip>
  );
}
