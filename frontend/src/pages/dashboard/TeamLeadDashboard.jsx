import { useEffect, useState } from 'react';
import { Grid, Box, List, ListItem, ListItemText } from '@mui/material';
import { Users, UserCheck, UserX, Clock, CalendarClock } from 'lucide-react';
import { dashboardAPI } from '../../services/services';
import { StatCard, Card, Loader, Avatar } from '../../components/ui';
import { colors } from '../../theme';
import { getFullName } from '../../utils/helpers';

const TeamLeadDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardAPI.teamLeadStats()
      .then(({ data: res }) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader message="Loading team dashboard..." />;

  const stats = data?.stats || {};

  return (
    <Box>
      <Grid container spacing={2} mb={3}>
        {[
          { title: 'Team Members', value: stats.teamSize, icon: Users, color: colors.primary },
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

      <Card title="Team Members Today">
        <List disablePadding>
          {(data?.teamMembers || []).map((emp) => (
            <ListItem key={emp.id} sx={{ px: 0 }}>
              <Avatar name={getFullName(emp.first_name, emp.last_name)} src={emp.avatar} sx={{ mr: 2 }} />
              <ListItemText
                primary={getFullName(emp.first_name, emp.last_name)}
                secondary={`${emp.designation || 'Employee'} · ${emp.attendance_status || 'absent'}`}
              />
            </ListItem>
          ))}
        </List>
      </Card>
    </Box>
  );
};

export default TeamLeadDashboard;