import { Box, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { Kicker } from './Kicker.js';

interface ScreenHeaderProps {
  title: ReactNode;
  kicker?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}

export function ScreenHeader({ title, kicker, subtitle, actions }: ScreenHeaderProps): React.ReactElement {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={2}
      sx={{
        justifyContent: 'space-between',
        alignItems: { xs: 'flex-start', sm: 'flex-end' },
        mb: 3,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        {kicker !== undefined && <Kicker>{kicker}</Kicker>}
        <Typography variant="h4" component="h1" sx={{ mt: kicker !== undefined ? 0.5 : 0 }}>
          {title}
        </Typography>
        {subtitle !== undefined && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {actions !== undefined && (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexShrink: 0 }}>
          {actions}
        </Stack>
      )}
    </Stack>
  );
}
