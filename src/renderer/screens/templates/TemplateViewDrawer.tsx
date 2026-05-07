import { Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import ReactMarkdown from 'react-markdown';
import { DetailDrawer } from '../../components/DetailDrawer.js';
import type { Template } from '../../../shared/template.js';

interface TemplateViewDrawerProps {
  template: Template | null;
  onClose: () => void;
  onEdit: (template: Template) => void;
}

export function TemplateViewDrawer({
  template,
  onClose,
  onEdit,
}: TemplateViewDrawerProps): React.ReactElement {
  return (
    <DetailDrawer
      open={template !== null}
      onClose={onClose}
      title={template?.frontmatter.name ?? ''}
      subtitle={template?.frontmatter.description}
      badges={
        template ? (
          <>
            <Chip
              size="small"
              variant="outlined"
              label={template.frontmatter.targetType}
            />
            <Chip
              size="small"
              variant="outlined"
              label={`v${template.frontmatter.version}`}
            />
          </>
        ) : undefined
      }
      testId="template"
    >
      {template && (
        <Stack spacing={2}>
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<EditIcon fontSize="small" />}
              onClick={() => onEdit(template)}
            >
              Edit
            </Button>
          </Stack>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Body
            </Typography>
            <Box sx={{ mt: 1, '& p': { my: 0.5 } }}>
              <ReactMarkdown>{template.body}</ReactMarkdown>
            </Box>
          </Paper>
        </Stack>
      )}
    </DetailDrawer>
  );
}
