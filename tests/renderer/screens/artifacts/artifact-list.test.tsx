import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ArtifactList } from '../../../../src/renderer/screens/artifacts/ArtifactList.js';
import { mockApi, ok, type CallSpy } from '../../test-utils.js';
import type { Artifact, ArtifactType } from '../../../../src/shared/artifact.js';
import type { Template } from '../../../../src/shared/template.js';

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

  describe('duplicate', () => {
    it('renders a "Duplicar" button on each artifact row', async () => {
      setupHappy([buildArtifact('skill', 'foo')]);
      render(<ArtifactList />);

      const row = await screen.findByTestId('artifact-item-skill/foo');
      expect(within(row).getByRole('button', { name: /duplicar/i })).toBeInTheDocument();
    });

    it('clicking Duplicar opens editor in create mode with name suffixed "-copy"', async () => {
      const user = userEvent.setup();
      setupHappy([buildArtifact('skill', 'foo')]);
      render(<ArtifactList />);

      const row = await screen.findByTestId('artifact-item-skill/foo');
      await user.click(within(row).getByRole('button', { name: /duplicar/i }));

      const editor = await screen.findByTestId('artifact-editor');
      expect(within(editor).getByRole('heading', { name: /novo artifact/i })).toBeInTheDocument();
      expect(screen.getByDisplayValue('foo-copy')).toBeInTheDocument();
    });

    it('clicking Duplicar copies body, description, scopes, version, tags', async () => {
      const user = userEvent.setup();
      const source: Artifact = {
        id: 'skill/foo',
        frontmatter: {
          name: 'foo',
          type: 'skill',
          description: 'my desc',
          scopes: ['personal', 'project'],
          version: '1.2.3',
          tags: ['a', 'b'],
          createdAt: '2026-04-26T10:00:00.000Z',
          updatedAt: '2026-04-26T10:00:00.000Z',
        },
        body: '# my body\n',
      };
      setupHappy([source]);
      render(<ArtifactList />);

      const row = await screen.findByTestId('artifact-item-skill/foo');
      await user.click(within(row).getByRole('button', { name: /duplicar/i }));

      expect(await screen.findByDisplayValue('my desc')).toBeInTheDocument();
      expect(screen.getByDisplayValue('1.2.3')).toBeInTheDocument();
      expect(screen.getByTestId('body-textarea')).toHaveValue('# my body\n');
    });

    it('uses "-copy-2", "-copy-3" when "-copy" suffix already exists', async () => {
      const user = userEvent.setup();
      setupHappy([
        buildArtifact('skill', 'foo'),
        buildArtifact('skill', 'foo-copy'),
        buildArtifact('skill', 'foo-copy-2'),
      ]);
      render(<ArtifactList />);

      const row = await screen.findByTestId('artifact-item-skill/foo');
      await user.click(within(row).getByRole('button', { name: /duplicar/i }));

      expect(await screen.findByDisplayValue('foo-copy-3')).toBeInTheDocument();
    });
  });

  describe('global-instruction tab', () => {
    const defaultTemplate: Template = {
      id: 'template/default',
      frontmatter: {
        name: 'default',
        targetType: 'global-instruction',
        description: 'Personal global instructions',
        scopes: ['personal'],
        version: '0.1.0',
        createdAt: '2026-05-04T00:00:00.000Z',
        updatedAt: '2026-05-04T00:00:00.000Z',
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
        expect(call).toHaveBeenCalledWith('template.list', { targetType: 'global-instruction' }),
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

  describe('template tab', () => {
    const skillTemplate: Template = {
      id: 'template/new-skill',
      frontmatter: {
        name: 'new-skill',
        targetType: 'skill',
        description: 'starter skill template',
        scopes: ['personal'],
        version: '0.1.0',
        createdAt: '2026-05-04T00:00:00.000Z',
        updatedAt: '2026-05-04T00:00:00.000Z',
      },
      body: '# default skill\n',
    };
    const agentTemplate: Template = {
      id: 'template/new-agent',
      frontmatter: {
        name: 'new-agent',
        targetType: 'agent',
        description: 'starter agent template',
        scopes: ['personal'],
        version: '0.1.0',
        createdAt: '2026-05-04T00:00:00.000Z',
        updatedAt: '2026-05-04T00:00:00.000Z',
      },
      body: '# default agent\n',
    };

    const setupTemplateTab = (templates: Template[] = [skillTemplate, agentTemplate]): void => {
      call.mockImplementation((method: string) => {
        if (method === 'artifact.list') return Promise.resolve(ok([]));
        if (method === 'template.list') return Promise.resolve(ok(templates));
        if (method === 'template.delete') return Promise.resolve(ok({ ok: true }));
        return Promise.resolve(ok(undefined));
      });
    };

    it('lists templates from template.list (no isBuiltIn distinction) on the template tab', async () => {
      const user = userEvent.setup();
      setupTemplateTab();
      render(<ArtifactList />);

      await user.click(await screen.findByRole('tab', { name: /^templates$/i }));

      const list = await screen.findByTestId('template-list');
      const skillRow = within(list).getByTestId('template-item-template/new-skill');
      expect(within(skillRow).getByText('new-skill')).toBeInTheDocument();
      expect(within(skillRow).getByText('(skill)')).toBeInTheDocument();
      expect(within(skillRow).getByRole('button', { name: /editar/i })).toBeInTheDocument();
      expect(within(skillRow).getByRole('button', { name: /deletar/i })).toBeInTheDocument();

      const agentRow = within(list).getByTestId('template-item-template/new-agent');
      expect(within(agentRow).getByText('(agent)')).toBeInTheDocument();
    });

    it('clicking "Novo template" opens TemplateEditor in create mode', async () => {
      const user = userEvent.setup();
      setupTemplateTab([]);
      render(<ArtifactList />);

      await user.click(await screen.findByRole('tab', { name: /^templates$/i }));
      await user.click(await screen.findByTestId('new-template-button'));

      expect(await screen.findByTestId('template-editor')).toBeInTheDocument();
    });

    it('confirms before deleting a template and calls template.delete on confirm', async () => {
      const user = userEvent.setup();
      setupTemplateTab([skillTemplate]);
      render(<ArtifactList />);

      await user.click(await screen.findByRole('tab', { name: /^templates$/i }));
      const row = await screen.findByTestId('template-item-template/new-skill');
      await user.click(within(row).getByRole('button', { name: /deletar/i }));

      expect(screen.getByTestId('confirm-delete-template-dialog')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /confirmar/i }));

      await waitFor(() =>
        expect(call).toHaveBeenCalledWith('template.delete', { id: 'template/new-skill' }),
      );
    });

    it('does not fetch templates on non-template tabs', async () => {
      setupTemplateTab();
      render(<ArtifactList />);

      await waitFor(() =>
        expect(call).toHaveBeenCalledWith('artifact.list', { type: 'skill' }),
      );

      expect(call.mock.calls.find((c) => c[0] === 'template.list')).toBeUndefined();
    });
  });
});
