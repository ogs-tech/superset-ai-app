import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ArtifactList } from '../../../../src/renderer/screens/artifacts/ArtifactList.js';
import { mockApi, ok, type CallSpy } from '../../test-utils.js';
import type { Artifact, ArtifactType } from '../../../../src/shared/artifact.js';

const buildArtifact = (type: ArtifactType, slug: string): Artifact => ({
  id: `${type}/${slug}`,
  frontmatter: {
    slug,
    name: `${slug.toUpperCase()}`,
    type,
    description: 'sample',
    scope: 'personal',
    version: '0.1.0',
    createdAt: '2026-04-26T10:00:00.000Z',
    updatedAt: '2026-04-26T10:00:00.000Z',
  },
  body: '# X\n',
});

let call: CallSpy;

beforeEach(() => {
  call = mockApi();
});

const setupHappy = (artifacts: Artifact[] = []): void => {
  call.mockImplementation((method: string) => {
    if (method === 'artifact.list') return Promise.resolve(ok(artifacts));
    if (method === 'artifact.delete') return Promise.resolve(ok({ ok: true }));
    return Promise.resolve(ok(undefined));
  });
};

describe('<ArtifactList>', () => {
  it('mounts on the skill tab and calls artifact.list with type=skill', async () => {
    setupHappy();
    render(<ArtifactList />);

    await waitFor(() =>
      expect(call).toHaveBeenCalledWith('artifact.list', { type: 'skill' }),
    );
  });

  it('renders each item with name and slug', async () => {
    setupHappy([buildArtifact('skill', 'foo')]);
    render(<ArtifactList />);

    await waitFor(() => expect(screen.getByText('FOO')).toBeInTheDocument());
    expect(screen.getByText('foo')).toBeInTheDocument();
  });

  it('switching to references tab calls artifact.list with type=reference', async () => {
    const user = userEvent.setup();
    setupHappy();
    render(<ArtifactList />);

    await user.click(await screen.findByRole('tab', { name: /references/i }));

    await waitFor(() =>
      expect(call).toHaveBeenCalledWith('artifact.list', { type: 'reference' }),
    );
  });

  it('confirms before delete and calls artifact.delete with removeSymlinks=true on confirm', async () => {
    const user = userEvent.setup();
    const artifact = buildArtifact('skill', 'foo');
    setupHappy([artifact]);
    render(<ArtifactList />);

    await waitFor(() => expect(screen.getByText('FOO')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /deletar/i }));

    expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /confirmar/i }));

    await waitFor(() =>
      expect(call).toHaveBeenCalledWith('artifact.delete', {
        id: 'skill/foo',
        removeSymlinks: true,
      }),
    );

    await waitFor(() => expect(screen.queryByText('FOO')).not.toBeInTheDocument());
  });

  it('cancel on confirm dialog does NOT call artifact.delete', async () => {
    const user = userEvent.setup();
    const artifact = buildArtifact('skill', 'foo');
    setupHappy([artifact]);
    render(<ArtifactList />);

    await waitFor(() => expect(screen.getByText('FOO')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /deletar/i }));
    await user.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(call.mock.calls.find((c) => c[0] === 'artifact.delete')).toBeUndefined();
  });
});
