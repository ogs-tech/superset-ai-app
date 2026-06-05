import { Alert } from '@mui/material';

interface ReadOnlyNoticeProps {
  pluginId: string;
}

export function ReadOnlyNotice({ pluginId }: ReadOnlyNoticeProps): React.ReactElement {
  return (
    <Alert severity="info" sx={{ mb: 2 }} data-testid="read-only-notice">
      This entity is provided by plugin <strong>{pluginId}</strong> and is read-only. To modify it,
      edit the plugin source or unlink the plugin.
    </Alert>
  );
}
