import { useEffect, useState } from 'react';
import { Grid, Box, Typography, Stepper, Step, StepLabel } from '@mui/material';
import { Plus, Check, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { useForm, Controller } from 'react-hook-form';
import { useAuth } from '../../context/AuthContext';
import { leaveAPI } from '../../services/services';
import {
  PageHeader, Card, StatCard, DataTable, Button, Modal, Input, Select,
  StatusBadge, Loader, ConfirmDialog,
} from '../../components/ui';
import { colors } from '../../theme';
import { formatDate, getErrorMessage } from '../../utils/helpers';
import { CalendarDays } from 'lucide-react';

const Leave = () => {
  const { isAdmin, isManager } = useAuth();
  const [leaves, setLeaves] = useState([]);
  const [stats, setStats] = useState(null);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [leavesRes, statsRes, typesRes] = await Promise.all([
        leaveAPI.getAll({ status: statusFilter }),
        leaveAPI.getStats(),
        leaveAPI.getTypes(),
      ]);
      setLeaves(leavesRes.data.data);
      setStats(statsRes.data.data);
      setTypes(typesRes.data.data);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [statusFilter]);

  const onSubmit = async (data) => {
    setSubmitting(true);
    try {
      await leaveAPI.create({
        leaveTypeId: data.leaveTypeId,
        startDate: data.startDate,
        endDate: data.endDate,
        reason: data.reason,
      });
      toast.success('Leave request submitted');
      setModalOpen(false);
      reset();
      fetchData();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      await leaveAPI.approve(id, {});
      toast.success('Leave approved');
      fetchData();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
    setConfirmAction(null);
  };

  const handleReject = async (id) => {
    try {
      await leaveAPI.reject(id, { reason: 'Rejected by manager' });
      toast.success('Leave rejected');
      fetchData();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
    setConfirmAction(null);
  };

  const columns = [
    { field: 'first_name', headerName: 'Employee', renderCell: ({ row }) => `${row.first_name} ${row.last_name}` },
    { field: 'leave_type_name', headerName: 'Type' },
    { field: 'start_date', headerName: 'From', renderCell: ({ value }) => formatDate(value) },
    { field: 'end_date', headerName: 'To', renderCell: ({ value }) => formatDate(value) },
    { field: 'days', headerName: 'Days' },
    { field: 'status', headerName: 'Status', renderCell: ({ value }) => <StatusBadge status={value} /> },
  ];

  if (loading) return <Loader />;

  return (
    <Box>
      <PageHeader
        title="Leave Management"
        subtitle="Apply for leave and track approvals"
        breadcrumb={[{ label: 'Leave', path: '/leave' }]}
        action={<Button startIcon={<Plus size={18} />} onClick={() => setModalOpen(true)}>Apply Leave</Button>}
      />

      <Grid container spacing={2} mb={3}>
        {(stats?.stats || []).map((s) => (
          <Grid key={s.name} size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard
              title={s.name}
              value={`${s.remaining ?? (s.total_days - s.used_days)} left`}
              subtitle={`Used ${s.used_days} of ${s.total_days}`}
              icon={CalendarDays}
            />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3} mb={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card title="Leave Requests">
            <Box mb={2}>
              <Select
                label="Filter Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={[
                  { value: '', label: 'All' },
                  { value: 'pending', label: 'Pending' },
                  { value: 'approved', label: 'Approved' },
                  { value: 'rejected', label: 'Rejected' },
                ]}
                sx={{ minWidth: 160 }}
              />
            </Box>
            <DataTable
              columns={columns}
              rows={leaves}
              actions={(row) => {
                if (!row || row.status !== 'pending' || !(isAdmin || isManager)) return [];
                return [
                  { label: 'Approve', onClick: () => setConfirmAction({ type: 'approve', id: row.id }) },
                  { label: 'Reject', onClick: () => setConfirmAction({ type: 'reject', id: row.id }) },
                ];
              }}
            />
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card title="Leave Calendar">
            {(stats?.calendar || []).map((c, i) => (
              <Box key={i} py={1.5} borderBottom={`1px solid ${colors.border}`}>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" fontWeight={500}>{c.leave_type}</Typography>
                  <StatusBadge status={c.status} />
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {formatDate(c.start_date)} — {formatDate(c.end_date)}
                </Typography>
              </Box>
            ))}
            {!stats?.calendar?.length && (
              <Typography color="text.secondary" variant="body2">No upcoming leaves</Typography>
            )}
          </Card>

          <Box mt={3}>
            <Card title="Approval Workflow">
              <Stepper activeStep={1} orientation="vertical">
                {['Submit Request', 'Manager Review', 'HR Approval', 'Completed'].map((label) => (
                  <Step key={label}>
                    <StepLabel>{label}</StepLabel>
                  </Step>
                ))}
              </Stepper>
            </Card>
          </Box>
        </Grid>
      </Grid>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Apply for Leave"
        actions={
          <>
            <Button variant="outlined" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit(onSubmit)} loading={submitting}>Submit</Button>
          </>
        }
      >
        <Box display="flex" flexDirection="column" gap={2}>
          <Controller
            name="leaveTypeId"
            control={control}
            rules={{ required: 'Required' }}
            render={({ field }) => (
              <Select
                label="Leave Type"
                value={field.value || ''}
                onChange={field.onChange}
                error={errors.leaveTypeId?.message}
                options={types.map((t) => ({ value: t.id, label: `${t.name} (${t.days_allowed} days)` }))}
              />
            )}
          />
          <Input label="Start Date" type="date" InputLabelProps={{ shrink: true }} error={errors.startDate?.message} {...register('startDate', { required: 'Required' })} />
          <Input label="End Date" type="date" InputLabelProps={{ shrink: true }} error={errors.endDate?.message} {...register('endDate', { required: 'Required' })} />
          <Input label="Reason" multiline rows={3} error={errors.reason?.message} {...register('reason', { required: 'Required' })} />
        </Box>
      </Modal>

      <ConfirmDialog
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => confirmAction?.type === 'approve' ? handleApprove(confirmAction.id) : handleReject(confirmAction.id)}
        title={confirmAction?.type === 'approve' ? 'Approve Leave' : 'Reject Leave'}
        message={`Are you sure you want to ${confirmAction?.type} this leave request?`}
        confirmLabel={confirmAction?.type === 'approve' ? 'Approve' : 'Reject'}
        danger={confirmAction?.type === 'reject'}
      />
    </Box>
  );
};

export default Leave;
