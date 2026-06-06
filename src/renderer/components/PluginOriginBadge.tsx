import { Tooltip } from '@mui/material';
import { StatusPill } from './ds/StatusPill.js';

interface PluginOriginBadgeProps {
  pluginId: string;
}

export function PluginOriginBadge({ pluginId }: PluginOriginBadgeProps): React.ReactElement {
  return (
    <Tooltip title={`Provided by plugin '${pluginId}' (read-only)`}>
      <span data-testid={`plugin-origin-badge-${pluginId}`}>
        <StatusPill variant="plugin" label={pluginId} />
      </span>
    </Tooltip>
  );
}
