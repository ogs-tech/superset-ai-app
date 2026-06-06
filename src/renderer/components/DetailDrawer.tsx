import type { ReactNode } from 'react';
import { Box, Drawer, IconButton, Stack, Typography } from '@mui/material';
import type { PaperProps } from '@mui/material';
import { X } from 'lucide-react';
import { Icon } from './ds/Icon.js';
import { Kicker } from './ds/Kicker.js';
import { shadow, fonts } from '../tokens.js';

interface DetailDrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  badges?: ReactNode;
  children: ReactNode;
  testId: string;
  width?: number | string;
}

export function DetailDrawer({
  open,
  onClose,
  title,
  subtitle,
  badges,
  children,
  testId,
  width = 560,
}: DetailDrawerProps): React.ReactElement {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: (theme) => ({
            width: { xs: '100%', sm: width },
            boxShadow: shadow.lg,
            borderLeft: `1px solid ${theme.palette.divider}`,
          }),
          'data-testid': `detail-drawer-${testId}`,
        } as PaperProps,
      }}
    >
      <Stack
        direction="row"
        sx={{
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 1,
          px: 2,
          py: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: 'center', flexWrap: 'wrap' }}
          >
            <Typography
              variant="h6"
              component="h2"
              sx={{ wordBreak: 'break-word', fontFamily: fonts.mono }}
            >
              {title}
            </Typography>
            {badges}
          </Stack>
          {subtitle && (
            <Box sx={{ mt: 0.5 }}>
              <Kicker>{subtitle}</Kicker>
            </Box>
          )}
        </Box>
        <IconButton aria-label="Close" onClick={onClose} size="small">
          <Icon glyph={X} size={16} />
        </IconButton>
      </Stack>
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: 2 }}>{children}</Box>
    </Drawer>
  );
}
