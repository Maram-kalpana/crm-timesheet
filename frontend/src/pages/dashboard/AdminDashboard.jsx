import { useEffect, useState } from 'react';
import { Grid, Box, Typography, List, ListItem, ListItemText, Chip } from '@mui/material';
import { Users, UserCheck, UserX, Clock, CalendarClock, FolderKanban, Megaphone, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { useAuth } from '../../context/AuthContext';
import { dashboardAPI } from '../../services/services';
import { StatCard, PageHeader, Card, Loader, Button, Avatar } from '../../components/ui';
import { colors } from '../../theme';
import { formatDate, getFullName } from '../../utils/helpers';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

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
  const trend = data?.attendanceTrend || [];
  const departments = data?.departmentStats || [];

  const lineData = {
    labels: trend.map((t) => formatDate(t.date, 'DD MMM')),
    datasets: [
      { label: 'Present', data: trend.map((t) => t.present), borderColor: colors.success, backgroundColor: `${colors.success}20`, fill: true, tension: 0.4 },
      { label: 'Absent', data: trend.map((t) => t.absent), borderColor: colors.danger, backgroundColor: `${colors.danger}20`, fill: true, tension: 0.4 },
    ],
  };

  const deptData = {
    labels: departments.map((d) => d.name),
    datasets: [{ data: departments.map((d) => d.count), backgroundColor: [colors.primary, colors.success, colors.warning, '#8B5CF6', '#EC4899'], borderWidth: 0 }],
  };

  return (
    <Box>
      <PageHeader
        title="Dashboard"
        subtitle="Welcome back! Here's what's happening today."
        breadcrumb={[{ label: 'Dashboard', path: '/dashboard' }]}
        action={
          <Button startIcon={<Plus size={18} />} onClick={() => navigate('/employees')}>
            Add Employee
          </Button>
        }
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

      <Grid container spacing={3} mb={3}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card title="Attendance Trend" subtitle="Last 30 days">
            <Box height={300}>
              {trend.length ? <Line data={lineData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} /> : (
                <Typography color="text.secondary" textAlign="center" pt={10}>No attendance data yet</Typography>
              )}
            </Box>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Card title="By Department">
            <Box height={300} display="flex" alignItems="center" justifyContent="center">
              {departments.length ? <Doughnut data={deptData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} /> : (
                <Typography color="text.secondary">No department data</Typography>
              )}
            </Box>
          </Card>
        </Grid>
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
          <Card title="Quick Actions">
            <Box display="flex" gap={2} flexWrap="wrap">
              {[
                { label: 'Mark Attendance', path: '/attendance' },
                { label: 'Manage Leaves', path: '/leave' },
                { label: 'View Projects', path: '/projects' },
                { label: 'Run Payroll', path: '/payroll' },
              ].map((a) => (
                <Button key={a.label} variant="outlined" onClick={() => navigate(a.path)}>{a.label}</Button>
              ))}
            </Box>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AdminDashboard;
