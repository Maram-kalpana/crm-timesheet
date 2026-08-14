import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Grid, Typography, Box } from '@mui/material';
import { Wallet, FileText, Send } from 'lucide-react';
import { timesheetAPI } from '../../services/services';
import { Card, StatCard, Loader, Button } from '../../components/ui';
import { getErrorMessage } from '../../utils/helpers';

const AccountantDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ total: 0, pending: 0, sent: 0, totalDue: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    timesheetAPI.getAll()
      .then(({ data }) => {
        const list = data.data || [];
        const pending = list.filter((t) => !t.sent_to_client_at);
        const sent = list.filter((t) => t.sent_to_client_at);
        const totalDue = pending.reduce((sum, t) => sum + (parseFloat(t.total_wage) || 0), 0);
        setStats({
          total: list.length,
          pending: pending.length,
          sent: sent.length,
          totalDue,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader />;

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={0.5}>Accountant Dashboard</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Review submitted timesheets, calculate billing, and send invoices to clients.
      </Typography>

      <Grid container spacing={3} mb={3}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title="Total Timesheets" value={stats.total} icon={FileText} color="#2563EB" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title="Pending Billing" value={stats.pending} icon={Wallet} color="#F59E0B" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title="Sent to Clients" value={stats.sent} icon={Send} color="#10B981" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title="Amount Due (Pending)" value={`$${stats.totalDue.toFixed(2)}`} icon={Wallet} color="#EF4444" />
        </Grid>
      </Grid>

      <Card>
        <Typography variant="subtitle1" fontWeight={600} mb={1}>Quick Actions</Typography>
        <Typography variant="body2" color="text.secondary" mb={2}>
          Open the Timesheet page to review submissions, select timesheets by client/period, and send billing emails.
        </Typography>
        <Button onClick={() => navigate('/payroll')}>Go to Client Billing</Button>
      </Card>
    </Box>
  );
};

export default AccountantDashboard;
