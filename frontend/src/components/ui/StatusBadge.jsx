import { Chip } from '@mui/material';
import { statusColors } from '../../theme';

const StatusBadge = ({ status, label, size = 'small' }) => {
  const config = statusColors[status?.toLowerCase()] || {
    bg: '#F1F5F9',
    color: '#64748B',
    label: label || status,
  };

  return (
    <Chip
      label={label || config.label || status}
      size={size}
      sx={{
        bgcolor: config.bg,
        color: config.color,
        fontWeight: 500,
        border: 'none',
      }}
    />
  );
};

export default StatusBadge;
