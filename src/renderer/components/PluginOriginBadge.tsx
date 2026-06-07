import { Tooltip } from '@mui/material';
import { StatusPill } from './ds/StatusPill.js';

interface PluginOriginBadgeProps {
  pluginId: string;
  provenance?: 'workspace-managed' | 'claude-code';
}

export function PluginOriginBadge({
  pluginId,
  provenance = 'workspace-managed',
}: PluginOriginBadgeProps): React.ReactElement {
  const isClaudeCode = provenance === 'claude-code';
  const label = isClaudeCode ? 'via Claude Code' : pluginId;
  const tooltip = isClaudeCode
    ? `Provided by plugin '${pluginId}' installed in Claude Code (read-only)`
    : `Provided by plugin '${pluginId}' (read-only)`;
  return (
    <Tooltip title={tooltip}>
      <span data-testid={`plugin-origin-badge-${pluginId}`}>
        <StatusPill variant={isClaudeCode ? 'claude-code' : 'plugin'} label={label} />
      </span>
    </Tooltip>
  );
}
