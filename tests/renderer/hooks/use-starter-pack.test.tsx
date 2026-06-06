import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useStarterPack } from '../../../src/renderer/hooks/use-starter-pack.js';
import { mockApi, ok, type CallSpy } from '../test-utils.js';

const OFFICIAL_REPO = 'anthropics/claude-plugins-official';

interface Plugin {
  name: string;
  description: string;
  source: unknown;
}

const FEATURE_DEV: Plugin = {
  name: 'feature-dev',
  description: 'Build features',
  source: { kind: 'github' },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * Stateful fake of the IPC backend: `plugin.list` reflects whatever has been
 * installed so far, exactly like the real main process. `gate` lets a test hold
 * an install open to simulate navigating away mid-install.
 */
function setupApi(
  call: CallSpy,
  plugins: Plugin[],
  gate?: Promise<void>,
): { installed: Set<string> } {
  const installed = new Set<string>();
  call.mockImplementation((method: string, params?: { plugin?: Plugin }) => {
    switch (method) {
      case 'marketplace.list':
        return Promise.resolve(
          ok([
            {
              id: 'official',
              source: { kind: 'github', repo: OFFICIAL_REPO },
              manifest: { plugins },
            },
          ]),
        );
      case 'plugin.list':
        return Promise.resolve(ok([...installed].map((id) => ({ id }))));
      case 'global-instruction.get':
        return Promise.resolve(ok({ id: 'default' }));
      case 'plugin.installFromMarketplace': {
        const name = params?.plugin?.name;
        const finish = () => {
          if (name) installed.add(name);
          return ok(undefined);
        };
        return gate ? gate.then(finish) : Promise.resolve(finish());
      }
      default:
        return Promise.resolve(ok(undefined));
    }
  });
  return { installed };
}

/** Prod-like client: a warm, non-zero staleTime is what hides the seeding side
 * effect on remount, so the bug only reproduces with these defaults. */
function warmClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 30_000, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

function wrapperFor(client: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

let call: CallSpy;

beforeEach(() => {
  call = mockApi();
});

describe('useStarterPack', () => {
  it('derives done from server-installed plugins', async () => {
    setupApi(call, [FEATURE_DEV]);
    const client = warmClient();
    const { result } = renderHook(() => useStarterPack(), {
      wrapper: wrapperFor(client),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.stateFor('feature-dev')).toBe('idle');

    await act(async () => {
      await result.current.install([FEATURE_DEV]);
    });

    await waitFor(() =>
      expect(result.current.stateFor('feature-dev')).toBe('done'),
    );
  });

  it('keeps install state after the screen unmounts and remounts (warm cache)', async () => {
    setupApi(call, [FEATURE_DEV]);
    const client = warmClient();
    const wrapper = wrapperFor(client);

    const first = renderHook(() => useStarterPack(), { wrapper });
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    await act(async () => {
      await first.result.current.install([FEATURE_DEV]);
    });
    await waitFor(() =>
      expect(first.result.current.stateFor('feature-dev')).toBe('done'),
    );

    // Navigate away (Início -> Plugins) then back: the screen is a different
    // component type, so React unmounts and remounts StarterPackScreen.
    first.unmount();
    const second = renderHook(() => useStarterPack(), { wrapper });

    await waitFor(() =>
      expect(second.result.current.stateFor('feature-dev')).toBe('done'),
    );
  });

  it('finishes an install that was in flight when the screen unmounted', async () => {
    const gate = deferred<void>();
    setupApi(call, [FEATURE_DEV], gate.promise);
    const client = warmClient();
    const wrapper = wrapperFor(client);

    const first = renderHook(() => useStarterPack(), { wrapper });
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));

    // Kick off the install but DON'T await — it is still in flight.
    let installDone: Promise<unknown>;
    act(() => {
      installDone = first.result.current.install([FEATURE_DEV]);
    });
    await waitFor(() =>
      expect(first.result.current.stateFor('feature-dev')).toBe('loading'),
    );

    // Navigate away mid-install.
    first.unmount();

    // The install resolves while nothing is mounted.
    await act(async () => {
      gate.resolve();
      await installDone;
    });

    // Come back: the finished install must be reflected, not lost.
    const second = renderHook(() => useStarterPack(), { wrapper });
    await waitFor(() =>
      expect(second.result.current.stateFor('feature-dev')).toBe('done'),
    );
  });

  it('shows loading state for an in-flight install across remount', async () => {
    const gate = deferred<void>();
    setupApi(call, [FEATURE_DEV], gate.promise);
    const client = warmClient();
    const wrapper = wrapperFor(client);

    const first = renderHook(() => useStarterPack(), { wrapper });
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));

    let installDone: Promise<unknown>;
    act(() => {
      installDone = first.result.current.install([FEATURE_DEV]);
    });
    await waitFor(() =>
      expect(first.result.current.stateFor('feature-dev')).toBe('loading'),
    );

    first.unmount();
    const second = renderHook(() => useStarterPack(), { wrapper });

    // The loading indicator survives navigation because the in-flight set
    // lives in the query cache, above the screen.
    await waitFor(() =>
      expect(second.result.current.stateFor('feature-dev')).toBe('loading'),
    );

    await act(async () => {
      gate.resolve();
      await installDone;
    });
    await waitFor(() =>
      expect(second.result.current.stateFor('feature-dev')).toBe('done'),
    );
  });
});
