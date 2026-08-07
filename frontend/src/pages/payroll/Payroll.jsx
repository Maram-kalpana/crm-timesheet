import { useEffect, useState } from 'react';
import { Grid, Box, Typography, Divider } from '@mui/material';
import { Download, Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import { useAuth } from '../../context/AuthContext';
import { payrollAPI } from '../../services/services';
import {
  PageHeader, Card, StatCard, DataTable, Button, Select, StatusBadge, Loader, Modal,
} from '../../components/ui';
import { colors } from '../../theme';
import { formatCurrency, formatDate, getErrorMessage, downloadBlob, monthNames } from '../../utils/helpers';

const Payroll = () => {
  const { isAdmin } = useAuth();
  const [payslips, setPayslips] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [month, setMonth] = useState(dayjs().month() + 1);
  const [year, setYear] = useState(dayjs().year());
  const [generating, setGenerating] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (isAdmin) {
        const { data } = await payrollAPI.getSummary({ month, year });
        setPayslips(data.data.payslips);
        setSummary(data.data.summary);
      } else {
        const { data } = await payrollAPI.getMy();
        setPayslips(data.data);
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [month, year, isAdmin]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await payrollAPI.generate({ month, year });
      toast.success('Payslips generated');
      fetchData();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (id) => {
    try {
      const { data } = await payrollAPI.download(id);
      downloadBlob(data, `payslip_${id}.pdf`);
      toast.success('Downloaded');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const viewPayslip = async (id) => {
    try {
      const { data } = await payrollAPI.getById(id);
      setSelectedPayslip(data.data);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const columns = [
    ...(isAdmin ? [{ field: 'first_name', headerName: 'Employee', renderCell: ({ row }) => `${row.first_name} ${row.last_name}` }] : []),
    { field: 'month', headerName: 'Period', renderCell: ({ row }) => `${monthNames[row.month - 1]} ${row.year}` },
    { field: 'gross_salary', headerName: 'Gross', renderCell: ({ value }) => formatCurrency(value) },
    { field: 'net_salary', headerName: 'Net', renderCell: ({ value }) => formatCurrency(value) },
    { field: 'status', headerName: 'Status', renderCell: ({ value }) => <StatusBadge status={value === 'generated' ? 'active' : 'pending'} label={value} /> },
    {
      field: 'actions',
      headerName: 'Actions',
      renderCell: ({ row }) => (
        <Box display="flex" gap={1}>
          <Button size="small" variant="text" onClick={() => viewPayslip(row.id)}>View</Button>
          <Button size="small" variant="text" startIcon={<Download size={14} />} onClick={() => handleDownload(row.id)}>PDF</Button>
        </Box>
      ),
    },
  ];

  if (loading) return <Loader />;

  const PayslipRow = ({ label, value, highlight }) => (
    <Box display="flex" justifyContent="space-between" py={1}>
      <Typography variant="body2" color={highlight ? 'text.primary' : 'text.secondary'} fontWeight={highlight ? 600 : 400}>{label}</Typography>
      <Typography variant="body2" fontWeight={highlight ? 700 : 500}>{value}</Typography>
    </Box>
  );

  return (
    <Box>
      <PageHeader
        title="Payroll"
        subtitle="Salary management and payslips"
        breadcrumb={[{ label: 'Payroll', path: '/payroll' }]}
      />

      {isAdmin && (
        <Box display="flex" gap={2} mb={3} alignItems="center" flexWrap="nowrap">
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Select
              label="Month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              options={monthNames.map((m, i) => ({ value: i + 1, label: m }))}
              fullWidth
            />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Select
              label="Year"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              options={[2024, 2025, 2026].map((y) => ({ value: y, label: String(y) }))}
              fullWidth
            />
          </Box>
          <Button onClick={handleGenerate} loading={generating} sx={{ flexShrink: 0 }}>
            Generate Payslips
          </Button>
        </Box>
      )}

      {isAdmin && summary && (
        <Grid container spacing={2} mb={3}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard title="Total Employees" value={summary.totalEmployees} icon={Wallet} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard title="Total Gross" value={formatCurrency(summary.totalGross)} icon={TrendingUp} color={colors.success} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard title="Total Net" value={formatCurrency(summary.totalNet)} icon={Wallet} color={colors.primary} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard title="Deductions" value={formatCurrency(summary.totalDeductions)} icon={TrendingDown} color={colors.danger} />
          </Grid>
        </Grid>
      )}

      <Card title="Payslips">
        <DataTable columns={columns} rows={payslips} emptyTitle="No payslips found" />
      </Card>

      <Modal
        open={!!selectedPayslip}
        onClose={() => setSelectedPayslip(null)}
        title="Payslip Preview"
        subtitle={selectedPayslip ? `${monthNames[selectedPayslip.month - 1]} ${selectedPayslip.year}` : ''}
        maxWidth="sm"
        actions={
          selectedPayslip && (
            <Button startIcon={<Download size={16} />} onClick={() => handleDownload(selectedPayslip.id)}>Download PDF</Button>
          )
        }
      >
        {selectedPayslip && (
          <Box>
            <Typography fontWeight={600} mb={2}>{selectedPayslip.first_name} {selectedPayslip.last_name}</Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>{selectedPayslip.designation} · {selectedPayslip.department_name}</Typography>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" fontWeight={600} mb={1}>Earnings</Typography>
            <PayslipRow label="Basic Salary" value={formatCurrency(selectedPayslip.basic_salary)} />
            <PayslipRow label="HRA" value={formatCurrency(selectedPayslip.hra)} />
            <PayslipRow label="Transport" value={formatCurrency(selectedPayslip.transport_allowance)} />
            <PayslipRow label="Medical" value={formatCurrency(selectedPayslip.medical_allowance)} />
            <PayslipRow label="Special Allowance" value={formatCurrency(selectedPayslip.special_allowance)} />
            <PayslipRow label="Gross Salary" value={formatCurrency(selectedPayslip.gross_salary)} highlight />
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" fontWeight={600} mb={1}>Deductions</Typography>
            <PayslipRow label="PF" value={formatCurrency(selectedPayslip.pf_deduction)} />
            <PayslipRow label="Tax" value={formatCurrency(selectedPayslip.tax_deduction)} />
            <PayslipRow label="Other" value={formatCurrency(selectedPayslip.other_deductions)} />
            <Divider sx={{ my: 2 }} />
            <PayslipRow label="Net Salary" value={formatCurrency(selectedPayslip.net_salary)} highlight />
          </Box>
        )}
      </Modal>
    </Box>
  );
};

export default Payroll;