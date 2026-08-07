import { Box, CircularProgress, Typography } from '@mui/material';
import { colors } from '../../theme';

const Loader = ({ fullScreen = false, message = 'Loading...' }) => (
  <Box
    display="flex"
    flexDirection="column"
    alignItems="center"
    justifyContent="center"
    gap={2}
    minHeight={fullScreen ? '100vh' : 200}
    bgcolor={fullScreen ? colors.background : 'transparent'}
  >
    <CircularProgress size={40} />
    {message && (
      <Typography variant="body2" color="text.secondary">{message}</Typography>
    )}
  </Box>
);

export default Loader;
