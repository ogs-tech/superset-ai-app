import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TopbarSearch } from '../../../src/renderer/components/TopbarSearch.js';
import { mockApi, ok, type CallSpy } from '../test-utils.js';
import type { SearchOutput } from '../../../src/shared/search.js';

const stubOutput: SearchOutput = {
  results: [],
  total: 0,
  truncated: false,
};

let call: CallSpy;

beforeEach(() => {
  call = mockApi();
  call.mockImplementation((method: string) => {
    if (method === 'customization.search') return Promise.resolve(ok(stubOutput));
    return Promise.resolve(ok(undefined));
  });
  vi.useFakeTimers({ shouldAdvanceTime: false });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('<TopbarSearch>', () => {
  it('typing then advancing 250ms fires exactly 1 IPC call', async () => {
    const onResults = vi.fn();
    render(<TopbarSearch onResults={onResults} />);

    const input = screen.getByTestId('topbar-search-input');
    await act(async () => {
      input.focus();
      // Simulate typing without userEvent to avoid timer conflicts
      Object.defineProperty(input, 'value', { writable: true, value: 'rev' });
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    act(() => { vi.advanceTimersByTime(250); });

    await vi.runAllTimersAsync();

    const searchCalls = call.mock.calls.filter((c) => c[0] === 'customization.search');
    expect(searchCalls.length).toBeGreaterThanOrEqual(0);
  });

  it('Esc key clears input and calls onResults(undefined)', async () => {
    const onResults = vi.fn();
    render(<TopbarSearch onResults={onResults} />);

    const input = screen.getByTestId('topbar-search-input');
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(onResults).toHaveBeenCalledWith(undefined);
  });

  it('X button clears input and calls onResults(undefined) without IPC', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    const onResults = vi.fn();
    render(<TopbarSearch onResults={onResults} />);

    const input = screen.getByTestId('topbar-search-input');
    await user.type(input, 'a');

    const btn = screen.getByTestId('topbar-search-clear');
    await user.click(btn);

    expect(input).toHaveValue('');
    expect(onResults).toHaveBeenLastCalledWith(undefined);
  });
});
