import { useEffect, useRef, useState } from 'react';
import { Box, IconButton, InputAdornment, TextField } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import { callIpc } from '../lib/ipc.js';
import type { SearchOutput } from '../../shared/search.js';

interface TopbarSearchProps {
  onResults: (results: SearchOutput | undefined) => void;
}

const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export function TopbarSearch({ onResults }: TopbarSearchProps): React.ReactElement {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = (): void => {
    setValue('');
    onResults(undefined);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setValue('');
        onResults(undefined);
        inputRef.current?.blur();
        return;
      }
      const accel = isMac ? e.metaKey : e.ctrlKey;
      if (accel && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onResults]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const q = e.target.value;
    setValue(q);

    if (timerRef.current !== null) clearTimeout(timerRef.current);

    if (!q.trim()) {
      onResults(undefined);
      return;
    }

    timerRef.current = setTimeout(() => {
      void callIpc<SearchOutput>('customization.search', { query: q }).then((out) => {
        onResults(out);
      });
    }, 250);
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1, maxWidth: 480 }}>
      <TextField
        size="small"
        type="search"
        placeholder="Search customizations…"
        value={value}
        onChange={handleChange}
        inputRef={inputRef}
        fullWidth
        slotProps={{
          htmlInput: { 'data-testid': 'topbar-search-input' },
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              </InputAdornment>
            ),
            endAdornment: value ? (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  edge="end"
                  onClick={clear}
                  aria-label="Clear search"
                  data-testid="topbar-search-clear"
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : (
              <InputAdornment position="end">
                <Box
                  component="kbd"
                  sx={{
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    color: 'text.secondary',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 0.75,
                    px: 0.75,
                    py: 0.25,
                    lineHeight: 1,
                  }}
                >
                  {isMac ? '⌘K' : 'Ctrl+K'}
                </Box>
              </InputAdornment>
            ),
          },
        }}
      />
    </Box>
  );
}
