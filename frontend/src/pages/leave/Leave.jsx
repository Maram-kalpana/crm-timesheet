import { useEffect, useState } from 'react';
import { Grid, Box, Typography } from '@mui/material';
import { Plus, CalendarDays } from 'lucide-react';
import { toast } from 'react-toastify';
import { useForm, Controller } from 'react-hook-form';
import { useAuth } from '../../context/AuthContext';
import { leaveAPI } from '../../services/services';
import {
  Card, StatCard, DataTable, Button, Modal, Input, Select,
  StatusBadge, Loader, ConfirmDialog,
} from '../../components/ui';
import { formatDate, getErrorMessage } from '../../utils/helpers';

const Leave = () => {
  const { isAdminOnly, isHr, isTeamLead } = useAuth();
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

  const canApplyLeave = !isAdminOnly;
  const canApproveLeave = (row) => {
    if (!row || row.status !== 'pending') return false;
    if (isAdminOnly) return true;
    if (isHr) return false;
    if (isTeamLead) return true;
    return false;
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
      <Box display="flex" gap={2} mb={2} alignItems="stretch" flexWrap="nowrap">
        {(stats?.stats || []).map((s) => (
          <Box key={s.name} sx={{ flex: 1, minWidth: 0 }}>
            <StatCard
              title={s.name}
              value={`${s.remaining ?? (s.total_days - s.used_days)} left`}
              subtitle={`Used ${s.used_days} of ${s.total_days}`}
              icon={CalendarDays}
            />
          </Box>
        ))}
        {canApplyLeave && (
          <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            <Button startIcon={<Plus size={18} />} onClick={() => setModalOpen(true)}>
              Apply Leave
            </Button>
          </Box>
        )}
      </Box>

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
            if (!canApproveLeave(row)) return [];
            return [
              { label: 'Approve', onClick: () => setConfirmAction({ type: 'approve', id: row.id }) },
              { label: 'Reject', onClick: () => setConfirmAction({ type: 'reject', id: row.id }) },
            ];
          }}
        />
      </Card>

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