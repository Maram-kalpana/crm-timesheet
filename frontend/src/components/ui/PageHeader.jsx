import { Box } from '@mui/material';

const PageHeader = ({ action, children }) => (
  <Box mb={3}>
    {action && (
      <Box display="flex" justifyContent="flex-end" mb={children ? 2 : 0}>
        {action}
      </Box>
    )}
    {children && <Box>{children}</Box>}
  </Box>
);

export default PageHeader;