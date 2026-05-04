import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomizationList } from '../../../../src/renderer/screens/customizations/CustomizationList.js';
import { mockApi, ok, type CallSpy } from '../../test-utils.js';
import type { Customization, CustomizationType } from '../../../../src/shared/customization.js';
import type { Template } from '../../../../src/shared/template.js';

const buildCustomization = (type: CustomizationType, name: string): Customization => ({
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

const setupHappy = (customizations: Customization[] = []): void => {
  call.mockImplementation((method: string) => {
    if (method === 'customization.list') return Promise.resolve(ok(customizations));
    if (method === 'customization.delete') return Promise.resolve(ok({ ok: true }));
    return Promise.resolve(ok(undefined));
  });
};

describe('<CustomizationList>', () => {
  it('mounts on the skill tab and calls customization.list with type=skill', async () => {
    setupHappy();
    render(<CustomizationList />);

    await waitFor(() =>
      expect(call).toHaveBeenCalledWith('customization.list', { type: 'skill' }),
    );
  });

  it('renders each item with name', async () => {
    setupHappy([buildCustomization('skill', 'foo')]);
    render(<CustomizationList />);

    await waitFor(() => expect(screen.getByText('foo')).toBeInTheDocument());
  });

  it('switching to references tab calls customization.list with type=reference', async () => {
    const user = userEvent.setup();
    setupHappy();
    render(<CustomizationList />);

    await user.click(await screen.findByRole('tab', { name: /references/i }));

    await waitFor(() =>
      expect(call).toHaveBeenCalledWith('customization.list', { type: 'reference' }),
    );
  });

  it('confirms before delete and calls customization.delete with removeSymlinks=true on confirm', async () => {
    const user = userEvent.setup();
    const customization = buildCustomization('skill', 'foo');
    setupHappy([customization]);
    render(<CustomizationList />);

    await waitFor(() => expect(screen.getByText('foo')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /delete/i }));

    expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /confirm/i }));

    await waitFor(() =>
      expect(call).toHaveBeenCalledWith('customization.delete', {
        id: 'skill/foo',
        removeSymlinks: true,
      }),
    );

    await waitFor(() => expect(screen.queryByText('foo')).not.toBeInTheDocument());
  });

  it('cancel on confirm dialog does NOT call customization.delete', async () => {
    const user = userEvent.setup();
    const customization = buildCustomization('skill', 'foo');
    setupHappy([customization]);
    render(<CustomizationList />);

    await waitFor(() => expect(screen.getByText('foo')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /delete/i }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(call.mock.calls.find((c) => c[0] === 'customization.delete')).toBeUndefined();
  });

  describe('duplicate', () => {
    it('renders a "Duplicate" button on each customization row', async () => {
      setupHappy([buildCustomization('skill', 'foo')]);
      render(<CustomizationList />);

      const row = await screen.findByTestId('customization-item-skill/foo');
      expect(within(row).getByRole('button', { name: /duplicate/i })).toBeInTheDocument();
    });

    it('clicking Duplicate opens editor in create mode with name suffixed "-copy"', async () => {
      const user = userEvent.setup();
      setupHappy([buildCustomization('skill', 'foo')]);
      render(<CustomizationList />);

      const row = await screen.findByTestId('customization-item-skill/foo');
      await user.click(within(row).getByRole('button', { name: /duplicate/i }));

      const editor = await screen.findByTestId('customization-editor');
      expect(within(editor).getByRole('heading', { name: /new customization/i })).toBeInTheDocument();
      expect(screen.getByDisplayValue('foo-copy')).toBeInTheDocument();
    });

    it('clicking Duplicate copies body, description, scopes, version, tags', async () => {
      const user = userEvent.setup();
      const source: Customization = {
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
      render(<CustomizationList />);

      const row = await screen.findByTestId('customization-item-skill/foo');
      await user.click(within(row).getByRole('button', { name: /duplicate/i }));

      expect(await screen.findByDisplayValue('my desc')).toBeInTheDocument();
      expect(screen.getByDisplayValue('1.2.3')).toBeInTheDocument();
      expect(screen.getByTestId('body-textarea')).toHaveValue('# my body\n');
    });

    it('uses "-copy-2", "-copy-3" when "-copy" suffix already exists', async () => {
      const user = userEvent.setup();
      setupHappy([
        buildCustomization('skill', 'foo'),
        buildCustomization('skill', 'foo-copy'),
        buildCustomization('skill', 'foo-copy-2'),
      ]);
      render(<CustomizationList />);

      const row = await screen.findByTestId('customization-item-skill/foo');
      await user.click(within(row).getByRole('button', { name: /duplicate/i }));

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

    const setupGlobalInstruction = (existing: Customization[] = []): void => {
      call.mockImplementation((method: string, params: unknown) => {
        if (method === 'customization.list') {
          const type = (params as { type: CustomizationType }).type;
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
      render(<CustomizationList />);

      await user.click(await screen.findByRole('tab', { name: /global instructions/i }));

      const slot = await screen.findByTestId('global-instruction-slot');
      expect(within(slot).getByText(/global instructions/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /new from template/i })).not.toBeInTheDocument();
    });

    it('marks slot as "(not configured)" when no customization exists and "(configured)" when it does', async () => {
      const user = userEvent.setup();
      setupGlobalInstruction();
      render(<CustomizationList />);

      await user.click(await screen.findByRole('tab', { name: /global instructions/i }));

      await waitFor(() => {
        const slot = screen.getByTestId('global-instruction-slot');
        expect(within(slot).getByText(/not configured/i)).toBeInTheDocument();
      });

      call.mockClear();
      const existing: Customization = {
        ...buildCustomization('global-instruction', 'default'),
        frontmatter: {
          ...buildCustomization('global-instruction', 'default').frontmatter,
          name: 'default',
        },
      };
      setupGlobalInstruction([existing]);

      // Trigger reload by switching tabs and back
      await user.click(screen.getByRole('tab', { name: /^skills$/i }));
      await user.click(screen.getByRole('tab', { name: /global instructions/i }));

      await waitFor(() => {
        const slot = screen.getByTestId('global-instruction-slot');
        expect(within(slot).getByText(/^\(configured\)$/i)).toBeInTheDocument();
      });
    });

    it('clicking Edit with no existing record fetches template and opens editor in create mode', async () => {
      const user = userEvent.setup();
      setupGlobalInstruction();
      render(<CustomizationList />);

      await user.click(await screen.findByRole('tab', { name: /global instructions/i }));

      const slot = await screen.findByTestId('global-instruction-slot');
      await user.click(within(slot).getByRole('button', { name: /edit/i }));

      await waitFor(() =>
        expect(call).toHaveBeenCalledWith('template.list', { targetType: 'global-instruction' }),
      );

      const editor = await screen.findByTestId('customization-editor');
      expect(within(editor).getByRole('heading', { name: /new customization/i })).toBeInTheDocument();
    });

    it('clicking Edit with an existing record opens editor in edit mode without fetching templates', async () => {
      const user = userEvent.setup();
      const existing: Customization = {
        ...buildCustomization('global-instruction', 'default'),
        frontmatter: {
          ...buildCustomization('global-instruction', 'default').frontmatter,
          name: 'default',
        },
      };
      setupGlobalInstruction([existing]);
      render(<CustomizationList />);

      await user.click(await screen.findByRole('tab', { name: /global instructions/i }));

      const slot = await screen.findByTestId('global-instruction-slot');
      await user.click(within(slot).getByRole('button', { name: /edit/i }));

      const editor = await screen.findByTestId('customization-editor');
      expect(within(editor).getByRole('heading', { name: /edit default/i })).toBeInTheDocument();
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
        if (method === 'customization.list') return Promise.resolve(ok([]));
        if (method === 'template.list') return Promise.resolve(ok(templates));
        if (method === 'template.delete') return Promise.resolve(ok({ ok: true }));
        return Promise.resolve(ok(undefined));
      });
    };

    it('lists templates from template.list (no isBuiltIn distinction) on the template tab', async () => {
      const user = userEvent.setup();
      setupTemplateTab();
      render(<CustomizationList />);

      await user.click(await screen.findByRole('tab', { name: /^templates$/i }));

      const list = await screen.findByTestId('template-list');
      const skillRow = within(list).getByTestId('template-item-template/new-skill');
      expect(within(skillRow).getByText('new-skill')).toBeInTheDocument();
      expect(within(skillRow).getByText('(skill)')).toBeInTheDocument();
      expect(within(skillRow).getByRole('button', { name: /edit/i })).toBeInTheDocument();
      expect(within(skillRow).getByRole('button', { name: /delete/i })).toBeInTheDocument();

      const agentRow = within(list).getByTestId('template-item-template/new-agent');
      expect(within(agentRow).getByText('(agent)')).toBeInTheDocument();
    });

    it('clicking "New template" opens TemplateEditor in create mode', async () => {
      const user = userEvent.setup();
      setupTemplateTab([]);
      render(<CustomizationList />);

      await user.click(await screen.findByRole('tab', { name: /^templates$/i }));
      await user.click(await screen.findByTestId('new-template-button'));

      expect(await screen.findByTestId('template-editor')).toBeInTheDocument();
    });

    it('confirms before deleting a template and calls template.delete on confirm', async () => {
      const user = userEvent.setup();
      setupTemplateTab([skillTemplate]);
      render(<CustomizationList />);

      await user.click(await screen.findByRole('tab', { name: /^templates$/i }));
      const row = await screen.findByTestId('template-item-template/new-skill');
      await user.click(within(row).getByRole('button', { name: /delete/i }));

      expect(screen.getByTestId('confirm-delete-template-dialog')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /confirm/i }));

      await waitFor(() =>
        expect(call).toHaveBeenCalledWith('template.delete', { id: 'template/new-skill' }),
      );
    });

    it('does not fetch templates on non-template tabs', async () => {
      setupTemplateTab();
      render(<CustomizationList />);

      await waitFor(() =>
        expect(call).toHaveBeenCalledWith('customization.list', { type: 'skill' }),
      );

      expect(call.mock.calls.find((c) => c[0] === 'template.list')).toBeUndefined();
    });
  });
});
