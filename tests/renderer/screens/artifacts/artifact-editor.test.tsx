import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ArtifactEditor } from '../../../../src/renderer/screens/artifacts/ArtifactEditor.js';
import { mockApi, ok, fail, type CallSpy } from '../../test-utils.js';
import type { Artifact } from '../../../../src/shared/artifact.js';

const baseArtifact = (): Artifact => ({
  id: '',
  frontmatter: {
    slug: 'foo',
    name: 'Foo',
    type: 'skill',
    description: 'sample',
    scope: 'personal',
    version: '0.1.0',
    createdAt: '',
    updatedAt: '',
  },
  body: '# Title\n\nSome **markdown** body.',
});

let call: CallSpy;

beforeEach(() => {
  call = mockApi();
});

describe('<ArtifactEditor>', () => {
  it('renders a textarea for the body', () => {
    render(
      <ArtifactEditor
        initial={baseArtifact()}
        isCreate={true}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByTestId('body-textarea')).toBeInTheDocument();
  });

  it('renders the markdown preview via react-markdown', () => {
    render(
      <ArtifactEditor
        initial={baseArtifact()}
        isCreate={true}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const preview = screen.getByTestId('markdown-preview');
    expect(preview.querySelector('h1')?.textContent).toBe('Title');
    expect(preview.querySelector('strong')?.textContent).toBe('markdown');
  });

  it('clicking Salvar dispatches artifact.save and shows success toast on ok envelope', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const initial = baseArtifact();
    call.mockResolvedValue(
      ok({ artifact: { ...initial, id: 'skill/foo' }, syncReport: [] }),
    );

    render(
      <ArtifactEditor
        initial={initial}
        isCreate={true}
        onSaved={onSaved}
        onCancel={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /salvar/i }));

    await waitFor(() =>
      expect(call).toHaveBeenCalledWith(
        'artifact.save',
        expect.objectContaining({ isCreate: true }),
      ),
    );

    expect(await screen.findByTestId('toast')).toHaveAttribute('data-variant', 'success');
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('shows error toast with the validation message when save fails', async () => {
    const user = userEvent.setup();
    call.mockResolvedValue(fail('validation', 'slug inválido'));

    render(
      <ArtifactEditor
        initial={baseArtifact()}
        isCreate={true}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /salvar/i }));

    const toast = await screen.findByTestId('toast');
    expect(toast).toHaveAttribute('data-variant', 'error');
    expect(toast).toHaveTextContent(/slug inválido/);
  });
});
