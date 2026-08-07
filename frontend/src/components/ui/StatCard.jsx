import { Box, Typography } from '@mui/material';
import Card from './Card';
import { colors } from '../../theme';

const StatCard = ({ title, value, subtitle, icon: Icon, color = colors.primary, trend, loading }) => (
  <Card hover sx={{ height: '100%' }}>
    <Box display="flex" justifyContent="space-between" alignItems="flex-start">
      <Box>
        <Typography variant="body2" color="text.secondary" fontWeight={500} mb={1}>
          {title}
        </Typography>
        <Typography variant="h4" fontWeight={700} color="text.primary">
          {loading ? '—' : value}
        </Typography>
        {subtitle && (
          <Typography variant="caption" color="text.secondary" mt={0.5} display="block">
            {subtitle}
          </Typography>
        )}
        {trend && (
          <Typography
            variant="caption"
            sx={{ color: trend.positive ? colors.success : colors.danger, fontWeight: 500, mt: 0.5, display: 'block' }}
          >
            {trend.positive ? '↑' : '↓'} {trend.value}
          </Typography>
        )}
      </Box>
      {Icon && (
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: `${color}15`,
            color,
          }}
        >
          <Icon size={24} />
        </Box>
      )}
    </Box>
  </Card>
);

export default StatCard;
