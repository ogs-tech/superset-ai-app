import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PublishPluginDialog } from '../../../../src/renderer/screens/plugins/PublishPluginDialog.js';
import { mockApi, ok, type CallSpy } from '../../test-utils.js';

let call: CallSpy;

const renderDialog = (
  props: Partial<React.ComponentProps<typeof PublishPluginDialog>> = {},
) => {
  const onClose = vi.fn();
  const onSuccess = vi.fn();
  const result = render(
    <PublishPluginDialog
      open
      pluginId="my-plugin"
      currentVersion="1.2.3"
      hasPublishInfo={false}
      scope="personal"
      onClose={onClose}
      onSuccess={onSuccess}
      {...props}
    />,
  );
  return { onClose, onSuccess, ...result };
};

const inputOf = (testId: string): HTMLInputElement =>
  within(screen.getByTestId(testId)).getByRole('textbox') as HTMLInputElement;

beforeEach(() => {
  call = mockApi();
  call.mockImplementation((method: string) => {
    if (method === 'credentials.hasGithubToken') return Promise.resolve(ok({ hasToken: true }));
    if (method === 'plugin.publish') return Promise.resolve(ok(undefined));
    return Promise.resolve(ok(undefined));
  });
});

describe('<PublishPluginDialog> — first publish', () => {
  it('prefills repo name, version and an auto-generated commit message', async () => {
    renderDialog();

    await waitFor(() => expect(inputOf('publish-repo-name-input').value).toBe('my-plugin'));
    expect(inputOf('publish-version-input').value).toBe('1.2.3');
    expect(inputOf('publish-commit-message-input').value).toBe('chore: publish v1.2.3');
  });

  it('updates the commit message as the version changes', async () => {
    const user = userEvent.setup();
    renderDialog();

    const version = inputOf('publish-version-input');
    await waitFor(() => expect(version.value).toBe('1.2.3'));

    await user.clear(version);
    await user.type(version, '2.0.0');

    expect(inputOf('publish-commit-message-input').value).toBe('chore: publish v2.0.0');
  });
});

describe('<PublishPluginDialog> — republish', () => {
  it('starts with an empty version and no repo-name field', async () => {
    renderDialog({ hasPublishInfo: true });

    await screen.findByTestId('publish-version-input');
    expect(inputOf('publish-version-input').value).toBe('');
    expect(screen.queryByTestId('publish-repo-name-input')).toBeNull();
  });
});

describe('<PublishPluginDialog> — reopening resets the form', () => {
  it('restores initial values after close + reopen, discarding edits', async () => {
    const user = userEvent.setup();
    const { rerender } = renderDialog();

    const version = inputOf('publish-version-input');
    await waitFor(() => expect(version.value).toBe('1.2.3'));
    await user.clear(version);
    await user.type(version, '9.9.9');
    expect(inputOf('publish-version-input').value).toBe('9.9.9');

    const baseProps = {
      pluginId: 'my-plugin',
      currentVersion: '1.2.3',
      hasPublishInfo: false,
      scope: 'personal' as const,
      onClose: vi.fn(),
      onSuccess: vi.fn(),
    };
    rerender(<PublishPluginDialog open={false} {...baseProps} />);
    rerender(<PublishPluginDialog open {...baseProps} />);

    await waitFor(() => expect(inputOf('publish-version-input').value).toBe('1.2.3'));
  });
});
