import { Box, Typography } from '@mui/material';
import Breadcrumb from './Breadcrumb';

const PageHeader = ({ title, subtitle, breadcrumb, action, children }) => (
  <Box mb={2}>
    {breadcrumb?.length > 0 && (
      <Box mb={1}>
        <Breadcrumb items={breadcrumb} />
      </Box>
    )}
    {(title || action) && (
      <Box display="flex" alignItems="flex-start" justifyContent="space-between" gap={2} flexWrap="wrap">
        <Box>
          {title && <Typography variant="h5" fontWeight={700}>{title}</Typography>}
          {subtitle && (
            <Typography variant="body2" color="text.secondary" mt={0.25}>{subtitle}</Typography>
          )}
        </Box>
        {action && <Box flexShrink={0}>{action}</Box>}
      </Box>
    )}
    {!title && action && (
      <Box display="flex" justifyContent="flex-end">{action}</Box>
    )}
    {children && <Box mt={title || action ? 1.5 : 0}>{children}</Box>}
  </Box>
);

export default PageHeader;
