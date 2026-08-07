import { useEffect, useState } from 'react';
import { Grid, Box, Typography, LinearProgress, Chip } from '@mui/material';
import { Clock, CalendarDays, FolderKanban, Wallet, Megaphone, Palmtree } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { dashboardAPI } from '../../services/services';
import { StatCard, PageHeader, Card, Loader, StatusBadge, Button } from '../../components/ui';
import { colors } from '../../theme';
import { formatDate, formatCurrency, calculateWorkingTime } from '../../utils/helpers';

const EmployeeDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timer, setTimer] = useState('00:00:00');
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    dashboardAPI.employeeStats()
      .then(({ data: res }) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const att = data?.todayAttendance;
    if (att?.clock_in && !att?.clock_out) {
      const interval = setInterval(() => setTimer(calculateWorkingTime(att.clock_in)), 1000);
      return () => clearInterval(interval);
    }
  }, [data?.todayAttendance]);

  if (loading) return <Loader message="Loading your dashboard..." />;

  const att = data?.todayAttendance;

  return (
    <Box>
      <PageHeader
        title={`Good ${new Date().getHours() < 12 ? 'morning' : 'afternoon'}, ${user?.firstName}!`}
        subtitle="Here's your overview for today."
        breadcrumb={[{ label: 'Dashboard', path: '/dashboard' }]}
      />

      <Grid container spacing={2} mb={3}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title="Today's Status" value={att?.status || 'Not Clocked In'} icon={Clock} color={colors.primary} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title="Working Hours" value={att?.clock_out ? `${att.working_hours}h` : timer} icon={Clock} color={colors.success} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title="Active Projects" value={data?.projects?.length || 0} icon={FolderKanban} color={colors.warning} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Leave Balance"
            value={(data?.leaveBalances || []).reduce((s, b) => s + (b.total_days - b.used_days), 0)}
            icon={CalendarDays}
            color="#8B5CF6"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card title="Today's Attendance">
            <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
              <Box>
                <StatusBadge status={att?.status || 'absent'} />
                <Typography variant="body2" color="text.secondary" mt={1}>
                  Clock In: {att?.clock_in ? formatDate(att.clock_in, 'hh:mm A') : '—'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Clock Out: {att?.clock_out ? formatDate(att.clock_out, 'hh:mm A') : '—'}
                </Typography>
              </Box>
              <Button onClick={() => navigate('/attendance')}>Go to Attendance</Button>
            </Box>
          </Card>

          <Box mt={3}>
            <Card title="Assigned Projects">
              {(data?.projects || []).map((p) => (
                <Box key={p.id} mb={2}>
                  <Box display="flex" justifyContent="space-between" mb={0.5}>
                    <Typography fontWeight={500}>{p.name}</Typography>
                    <Typography variant="body2" color="text.secondary">{p.completion_percentage}%</Typography>
                  </Box>
                  <LinearProgress variant="determinate" value={p.completion_percentage} sx={{ borderRadius: 2, height: 8 }} />
                </Box>
              ))}
              {!data?.projects?.length && <Typography color="text.secondary">No active projects</Typography>}
            </Card>
          </Box>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card title="Leave Balance">
            {(data?.leaveBalances || []).map((b) => (
              <Box key={b.id} display="flex" justifyContent="space-between" py={1} borderBottom={`1px solid ${colors.border}`}>
                <Typography variant="body2">{b.leave_type_name}</Typography>
                <Chip label={`${b.total_days - b.used_days} / ${b.total_days}`} size="small" color="primary" variant="outlined" />
              </Box>
            ))}
          </Card>

          <Box mt={3}>
            <Card title="Recent Payslips">
              {(data?.payslips || []).map((p) => (
                <Box key={p.id} display="flex" justifyContent="space-between" py={1}>
                  <Typography variant="body2">{formatDate(`${p.year}-${p.month}-01`, 'MMM YYYY')}</Typography>
                  <Typography fontWeight={600}>{formatCurrency(p.net_salary)}</Typography>
                </Box>
              ))}
              <Button variant="text" size="small" onClick={() => navigate('/payroll')}>View All</Button>
            </Card>
          </Box>

          <Box mt={3}>
            <Card title="Upcoming Holidays">
              {(data?.holidays || []).map((h) => (
                <Box key={h.id} display="flex" alignItems="center" gap={1} py={1}>
                  <Palmtree size={16} color={colors.success} />
                  <Box>
                    <Typography variant="body2" fontWeight={500}>{h.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{formatDate(h.date)}</Typography>
                  </Box>
                </Box>
              ))}
            </Card>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default EmployeeDashboard;
