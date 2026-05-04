import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { App } from '../../src/renderer/App.js';
import { mockApi, ok, type CallSpy } from './test-utils.js';
import type { Settings } from '../../src/shared/settings.js';

const validSettings: Settings = {
  workspacePath: '/ws',
  adapters: {
    claude: { enabled: true },
    copilot: { enabled: false, exclusiveSkillsWithClaude: false },
  },
  linkedRepos: [],
  ui: { theme: 'system' },
};

let call: CallSpy;

beforeEach(() => {
  call = mockApi();
});

const route = (overrides: Record<string, unknown>) => {
  call.mockImplementation((method: string) => {
    if (method in overrides) return Promise.resolve(overrides[method]);
    return Promise.resolve(ok(undefined));
  });
};

describe('<App> bootstrap router', () => {
  it('renders <Onboarding> when settings.get returns null', async () => {
    route({ 'settings.get': ok(null) });
    render(<App />);
    await waitFor(() =>
      expect(screen.getByTestId('onboarding-screen')).toBeInTheDocument(),
    );
  });

  it('renders <Main> when settings has a valid workspacePath', async () => {
    route({
      'settings.get': ok(validSettings),
      'workspace.exists': ok(true),
      'repo.list': ok([]),
    });
    render(<App />);
    await waitFor(() =>
      expect(screen.getByTestId('main-screen')).toBeInTheDocument(),
    );
  });

  it('renders <WorkspaceMissing> when workspacePath does not exist', async () => {
    route({
      'settings.get': ok({ ...validSettings, workspacePath: '/missing' }),
      'workspace.exists': ok(false),
    });
    render(<App />);
    await waitFor(() =>
      expect(screen.getByTestId('workspace-missing-screen')).toBeInTheDocument(),
    );
  });
});
