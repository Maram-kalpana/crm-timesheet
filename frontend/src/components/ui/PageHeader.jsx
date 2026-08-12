import { Box } from '@mui/material';

const PageHeader = ({ action, children }) => {
  if (!action && !children) return null;

  return (
    <Box mb={1.5}>
      {action && (
        <Box display="flex" justifyContent="flex-end" mb={children ? 1 : 0}>
          {action}
        </Box>
      )}
      {children && <Box>{children}</Box>}
    </Box>
  );
};

export default PageHeader;
