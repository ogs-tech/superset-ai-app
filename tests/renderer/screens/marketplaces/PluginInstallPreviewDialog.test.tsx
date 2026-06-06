import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { PluginInstallPreviewDialog } from '../../../../src/renderer/screens/marketplaces/PluginInstallPreviewDialog.js';
import { mockApi, ok, fail, renderWithTheme, type CallSpy } from '../../test-utils.js';

let call: CallSpy;

const plugin = { name: 'Cool Plugin', description: 'Does cool things', source: {} };

const manifest = {
  id: 'cool-plugin',
  version: '2.0.0',
  artifacts: { skills: ['alpha'], agents: [], commands: [], hooks: 0, mcp: true, lsp: false },
};

const renderDialog = (
  props: Partial<React.ComponentProps<typeof PluginInstallPreviewDialog>> = {},
) =>
  renderWithTheme(
    <PluginInstallPreviewDialog
      open
      plugin={plugin}
      onCancel={vi.fn()}
      onConfirm={vi.fn()}
      installing={false}
      {...props}
    />,
  );

beforeEach(() => {
  call = mockApi();
});

describe('<PluginInstallPreviewDialog>', () => {
  it('fetches the manifest on open and renders the preview', async () => {
    call.mockImplementation((method: string) => {
      if (method === 'plugin.previewFromMarketplace') return Promise.resolve(ok(manifest));
      return Promise.resolve(ok(undefined));
    });

    renderDialog();

    expect(await screen.findByText('v2.0.0')).toBeInTheDocument();
    expect(screen.getByText('alpha')).toBeInTheDocument();
    expect(call).toHaveBeenCalledWith('plugin.previewFromMarketplace', { plugin });
  });

  it('shows an error when the manifest fetch fails', async () => {
    call.mockImplementation((method: string) => {
      if (method === 'plugin.previewFromMarketplace')
        return Promise.resolve(fail('io', 'manifest unreadable'));
      return Promise.resolve(ok(undefined));
    });

    renderDialog();

    const alert = await screen.findByTestId('plugin-preview-error');
    expect(alert).toHaveTextContent('manifest unreadable');
  });
});
