import { Box, Typography } from '@mui/material';
import { Inbox } from 'lucide-react';
import Button from './Button';
import { colors } from '../../theme';

const EmptyState = ({ icon: Icon = Inbox, title, description, action, actionLabel }) => (
  <Box
    display="flex"
    flexDirection="column"
    alignItems="center"
    justifyContent="center"
    py={6}
    px={3}
    textAlign="center"
  >
    <Box
      sx={{
        width: 64,
        height: 64,
        borderRadius: 4,
        bgcolor: `${colors.primary}10`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        mb: 2,
      }}
    >
      <Icon size={32} color={colors.primary} />
    </Box>
    <Typography variant="h6" fontWeight={600} mb={1}>{title}</Typography>
    <Typography variant="body2" color="text.secondary" mb={action ? 3 : 0} maxWidth={400}>
      {description}
    </Typography>
    {action && (
      <Button onClick={action}>{actionLabel || 'Get Started'}</Button>
    )}
  </Box>
);

export default EmptyState;
