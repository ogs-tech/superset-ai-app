import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { PluginOriginBadge } from '../../../src/renderer/components/PluginOriginBadge.js';
import { renderWithTheme } from '../test-utils.js';

describe('<PluginOriginBadge>', () => {
  it('shows the plugin id for a workspace-managed plugin', () => {
    renderWithTheme(<PluginOriginBadge pluginId="superpowers" />);
    expect(screen.getByTestId('plugin-origin-badge-superpowers')).toHaveTextContent('superpowers');
  });

  it('shows "via Claude Code" for a claude-code plugin', () => {
    renderWithTheme(<PluginOriginBadge pluginId="feature-dev" provenance="claude-code" />);
    const badge = screen.getByTestId('plugin-origin-badge-feature-dev');
    expect(badge).toHaveTextContent(/via claude code/i);
  });
});
