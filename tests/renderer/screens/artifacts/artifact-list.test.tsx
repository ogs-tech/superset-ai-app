import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ArtifactList } from '../../../../src/renderer/screens/artifacts/ArtifactList.js';
import { mockApi, ok, type CallSpy } from '../../test-utils.js';
import type { Artifact, ArtifactType, Template } from '../../../../src/shared/artifact.js';

const buildArtifact = (type: ArtifactType, name: string): Artifact => ({
  id: `${type}/${name}`,
  frontmatter: {
    name,
    type,
    description: 'sample',
    scopes: ['personal'],
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

  it('renders each item with name', async () => {
    setupHappy([buildArtifact('skill', 'foo')]);
    render(<ArtifactList />);

    await waitFor(() => expect(screen.getByText('foo')).toBeInTheDocument());
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

    await waitFor(() => expect(screen.getByText('foo')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /deletar/i }));

    expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /confirmar/i }));

    await waitFor(() =>
      expect(call).toHaveBeenCalledWith('artifact.delete', {
        id: 'skill/foo',
        removeSymlinks: true,
      }),
    );

    await waitFor(() => expect(screen.queryByText('foo')).not.toBeInTheDocument());
  });

  it('cancel on confirm dialog does NOT call artifact.delete', async () => {
    const user = userEvent.setup();
    const artifact = buildArtifact('skill', 'foo');
    setupHappy([artifact]);
    render(<ArtifactList />);

    await waitFor(() => expect(screen.getByText('foo')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /deletar/i }));
    await user.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(call.mock.calls.find((c) => c[0] === 'artifact.delete')).toBeUndefined();
  });

  describe('global-instruction tab', () => {
    const defaultTemplate: Template = {
      id: 'global-instruction/default',
      type: 'global-instruction',
      name: 'default',
      description: 'Personal global instructions',
      frontmatter: {
        name: 'default',
        type: 'global-instruction',
        description: 'Personal global instructions',
        scopes: ['personal'],
        version: '0.1.0',
      },
      body: '# Global instructions template\n',
    };

    const setupGlobalInstruction = (existing: Artifact[] = []): void => {
      call.mockImplementation((method: string, params: unknown) => {
        if (method === 'artifact.list') {
          const type = (params as { type: ArtifactType }).type;
          return Promise.resolve(ok(type === 'global-instruction' ? existing : []));
        }
        if (method === 'template.list') {
          return Promise.resolve(ok([defaultTemplate]));
        }
        return Promise.resolve(ok(undefined));
      });
    };

    it('renders a single unified slot and no "Novo" button', async () => {
      const user = userEvent.setup();
      setupGlobalInstruction();
      render(<ArtifactList />);

      await user.click(await screen.findByRole('tab', { name: /global instructions/i }));

      const slot = await screen.findByTestId('global-instruction-slot');
      expect(within(slot).getByText(/global instructions/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /novo a partir de template/i })).not.toBeInTheDocument();
    });

    it('marks slot as "(não configurado)" when no artifact exists and "(configurado)" when it does', async () => {
      const user = userEvent.setup();
      setupGlobalInstruction();
      render(<ArtifactList />);

      await user.click(await screen.findByRole('tab', { name: /global instructions/i }));

      await waitFor(() => {
        const slot = screen.getByTestId('global-instruction-slot');
        expect(within(slot).getByText(/não configurado/i)).toBeInTheDocument();
      });

      call.mockClear();
      const existing: Artifact = {
        ...buildArtifact('global-instruction', 'default'),
        frontmatter: {
          ...buildArtifact('global-instruction', 'default').frontmatter,
          name: 'default',
        },
      };
      setupGlobalInstruction([existing]);

      // Trigger reload by switching tabs and back
      await user.click(screen.getByRole('tab', { name: /^skills$/i }));
      await user.click(screen.getByRole('tab', { name: /global instructions/i }));

      await waitFor(() => {
        const slot = screen.getByTestId('global-instruction-slot');
        expect(within(slot).getByText(/^\(configurado\)$/i)).toBeInTheDocument();
      });
    });

    it('clicking Editar with no existing record fetches template and opens editor in create mode', async () => {
      const user = userEvent.setup();
      setupGlobalInstruction();
      render(<ArtifactList />);

      await user.click(await screen.findByRole('tab', { name: /global instructions/i }));

      const slot = await screen.findByTestId('global-instruction-slot');
      await user.click(within(slot).getByRole('button', { name: /editar/i }));

      await waitFor(() =>
        expect(call).toHaveBeenCalledWith('template.list', { type: 'global-instruction' }),
      );

      const editor = await screen.findByTestId('artifact-editor');
      expect(within(editor).getByRole('heading', { name: /novo artifact/i })).toBeInTheDocument();
    });

    it('clicking Editar with an existing record opens editor in edit mode without fetching templates', async () => {
      const user = userEvent.setup();
      const existing: Artifact = {
        ...buildArtifact('global-instruction', 'default'),
        frontmatter: {
          ...buildArtifact('global-instruction', 'default').frontmatter,
          name: 'default',
        },
      };
      setupGlobalInstruction([existing]);
      render(<ArtifactList />);

      await user.click(await screen.findByRole('tab', { name: /global instructions/i }));

      const slot = await screen.findByTestId('global-instruction-slot');
      await user.click(within(slot).getByRole('button', { name: /editar/i }));

      const editor = await screen.findByTestId('artifact-editor');
      expect(within(editor).getByRole('heading', { name: /editar default/i })).toBeInTheDocument();
      expect(call.mock.calls.find((c) => c[0] === 'template.list')).toBeUndefined();
    });
  });
});
