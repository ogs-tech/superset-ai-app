import { Chip, Tooltip } from '@mui/material';
import ExtensionIcon from '@mui/icons-material/Extension';

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
        icon={<ExtensionIcon fontSize="small" />}
        label={pluginId}
        data-testid={`plugin-origin-badge-${pluginId}`}
        sx={{ ml: 1 }}
      />
    </Tooltip>
  );
}
