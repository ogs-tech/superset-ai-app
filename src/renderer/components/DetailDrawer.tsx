import type { ReactNode } from 'react';
import { Box, Drawer, IconButton, Stack, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

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
  // Extracted to a const so it is no longer a "fresh" object literal: TS excess-property
  // checks only apply to literals passed directly, so `data-testid` (not in MUI v9's
  // tightened SlotProps) is accepted while still rendering on the Paper element.
  const paperSlotProps = {
    sx: { width: { xs: '100%', sm: width } },
    'data-testid': `detail-drawer-${testId}`,
  };

  return (
    <Drawer anchor="right" open={open} onClose={onClose} slotProps={{ paper: paperSlotProps }}>
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
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="h6" component="h2" sx={{ wordBreak: 'break-word' }}>
              {title}
            </Typography>
            {badges}
          </Stack>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        <IconButton aria-label="Close" onClick={onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: 2 }}>{children}</Box>
    </Drawer>
  );
}
