import { useEffect, useState } from 'react';
import { Grid, Box, Typography, List, ListItem, ListItemText, Chip } from '@mui/material';
import { Users, UserCheck, UserX, Clock, CalendarClock, FolderKanban, Megaphone, CheckSquare, CalendarDays, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { dashboardAPI } from '../../services/services';
import { StatCard, PageHeader, Card, Loader, Avatar } from '../../components/ui';
import { colors } from '../../theme';
import { formatDate, getFullName } from '../../utils/helpers';

const AdminDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    dashboardAPI.adminStats()
      .then(({ data: res }) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader message="Loading dashboard..." />;

  const stats = data?.stats || {};

  const quickActions = [
    { label: 'Mark Attendance', path: '/attendance', icon: CheckSquare, color: colors.primary },
    { label: 'Manage Leaves', path: '/leave', icon: CalendarDays, color: colors.success },
    { label: 'View Projects', path: '/projects', icon: FolderKanban, color: colors.warning },
    { label: 'Run Payroll', path: '/payroll', icon: Wallet, color: '#8B5CF6' },
  ];

  return (
    <Box>
      <PageHeader
        title="Dashboard"
        subtitle="Welcome back! Here's what's happening today."
        breadcrumb={[{ label: 'Dashboard', path: '/dashboard' }]}
      />

      <Grid container spacing={2} mb={3}>
        {[
          { title: 'Total Employees', value: stats.totalEmployees, icon: Users, color: colors.primary },
          { title: 'Present Today', value: stats.present, icon: UserCheck, color: colors.success },
          { title: 'Absent Today', value: stats.absent, icon: UserX, color: colors.danger },
          { title: 'Late Today', value: stats.late, icon: Clock, color: colors.warning },
          { title: 'Pending Leaves', value: stats.pendingLeaves, icon: CalendarClock, color: '#8B5CF6' },
        ].map((s) => (
          <Grid key={s.title} size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }}>
            <StatCard {...s} />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card title="Recent Joinees">
            <List disablePadding>
              {(data?.recentJoinees || []).map((emp) => (
                <ListItem key={emp.id} sx={{ px: 0 }}>
                  <Avatar name={getFullName(emp.first_name, emp.last_name)} src={emp.avatar} sx={{ mr: 2 }} />
                  <ListItemText
                    primary={getFullName(emp.first_name, emp.last_name)}
                    secondary={`${emp.designation || 'Employee'} · ${emp.department_name || 'N/A'}`}
                  />
                  <Chip label={formatDate(emp.joining_date)} size="small" variant="outlined" />
                </ListItem>
              ))}
            </List>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card title="Announcements" action={<Megaphone size={20} color={colors.primary} />}>
            {(data?.announcements || []).map((a) => (
              <Box key={a.id} mb={2} pb={2} borderBottom={`1px solid ${colors.border}`}>
                <Typography fontWeight={600}>{a.title}</Typography>
                <Typography variant="body2" color="text.secondary" noWrap>{a.content}</Typography>
                <Typography variant="caption" color="text.secondary">{formatDate(a.created_at)}</Typography>
              </Box>
            ))}
          </Card>
        </Grid>
        <Grid size={{ xs: 12 }}>
          <Typography variant="subtitle1" fontWeight={700} mb={2}>Quick Actions</Typography>
          <Grid container spacing={2}>
            {quickActions.map((qa) => (
              <Grid key={qa.label} size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }}>
                <Box onClick={() => navigate(qa.path)} sx={{ cursor: 'pointer' }}>
                  <StatCard title={qa.label} icon={qa.icon} color={qa.color} />
                </Box>
              </Grid>
            ))}
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AdminDashboard;