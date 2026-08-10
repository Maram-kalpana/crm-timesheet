import { useEffect, useState } from 'react';
import {
  Box, Typography, TextField, Grid,
} from '@mui/material';
import { LogOut } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import { resignationAPI } from '../../services/services';
import {
  PageHeader, Card, Button, DataTable, StatusBadge, Loader, EmptyState, Modal, Input, ConfirmDialog,
} from '../../components/ui';
import { formatDate, getErrorMessage } from '../../utils/helpers';

const Resignations = () => {
  const { isAdminOnly, isHr, user } = useAuth();
  const canManage = isAdminOnly || isHr;
  const [resignations, setResignations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ reason: '', lastWorkingDate: '' });
  const [actionId, setActionId] = useState(null);
  const [actionType, setActionType] = useState(null);

  const fetchResignations = async () => {
    setLoading(true);
    try {
      const { data } = canManage ? await resignationAPI.getAll() : await resignationAPI.getMy();
      setResignations(data.data || []);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchResignations(); }, [canManage]);

  const handleSubmit = async () => {
    if (!form.reason || !form.lastWorkingDate) {
      toast.error('Please fill all fields');
      return;
    }
    setSubmitting(true);
    try {
      await resignationAPI.submit(form);
      toast.success('Resignation submitted');
      setModalOpen(false);
      setForm({ reason: '', lastWorkingDate: '' });
      fetchResignations();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAction = async () => {
    if (!actionId || !actionType) return;
    try {
      if (actionType === 'approve') await resignationAPI.approve(actionId);
      else if (actionType === 'reject') await resignationAPI.reject(actionId, {});
      else if (actionType === 'complete') await resignationAPI.complete(actionId);
      toast.success(`Resignation ${actionType}d`);
      fetchResignations();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
    setActionId(null);
    setActionType(null);
  };

  const columns = canManage ? [
    { field: 'employee', headerName: 'Employee', renderCell: ({ row }) => `${row.first_name} ${row.last_name}` },
    { field: 'employee_id', headerName: 'Emp ID' },
    { field: 'department_name', headerName: 'Department' },
    { field: 'last_working_date', headerName: 'Last Working Day', renderCell: ({ value }) => formatDate(value) },
    { field: 'status', headerName: 'Status', renderCell: ({ value }) => <StatusBadge status={value} /> },
    {
      field: 'actions',
      headerName: 'Actions',
      renderCell: ({ row }) => (
        <Box display="flex" gap={1}>
          {isAdminOnly && row.status === 'pending' && (
            <>
              <Button size="small" onClick={() => { setActionId(row.id); setActionType('approve'); }}>Approve</Button>
              <Button size="small" variant="outlined" color="error" onClick={() => { setActionId(row.id); setActionType('reject'); }}>Reject</Button>
            </>
          )}
          {isAdminOnly && row.status === 'approved' && (
            <Button size="small" onClick={() => { setActionId(row.id); setActionType('complete'); }}>Complete Exit</Button>
          )}
        </Box>
      ),
    },
  ] : [
    { field: 'reason', headerName: 'Reason' },
    { field: 'last_working_date', headerName: 'Last Working Day', renderCell: ({ value }) => formatDate(value) },
    { field: 'status', headerName: 'Status', renderCell: ({ value }) => <StatusBadge status={value} /> },
    { field: 'created_at', headerName: 'Submitted', renderCell: ({ value }) => formatDate(value) },
  ];

  if (loading) return <Loader />;

  const hasActive = resignations.some((r) => ['pending', 'approved'].includes(r.status));

  return (
    <Box>
      <PageHeader
        title="Resignations"
        subtitle={canManage ? 'Manage employee resignation requests' : 'Submit and track your resignation'}
        breadcrumb={[{ label: 'Resignations', path: '/resignations' }]}
        action={!canManage && !hasActive ? (
          <Button startIcon={<LogOut size={18} />} onClick={() => setModalOpen(true)}>Submit Resignation</Button>
        ) : null}
      />

      {!resignations.length ? (
        <EmptyState
          icon={LogOut}
          title="No resignation requests"
          description={canManage ? 'No pending or past resignations.' : 'You have not submitted a resignation.'}
          action={!canManage && !hasActive ? (
            <Button onClick={() => setModalOpen(true)}>Submit Resignation</Button>
          ) : null}
        />
      ) : (
        <Card>
          <DataTable columns={columns} rows={resignations} />
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Submit Resignation">
        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }}>
            <TextField
              label="Reason"
              multiline
              rows={3}
              fullWidth
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Input
              label="Last Working Date"
              type="date"
              value={form.lastWorkingDate}
              onChange={(e) => setForm({ ...form, lastWorkingDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Button fullWidth loading={submitting} onClick={handleSubmit}>Submit</Button>
          </Grid>
        </Grid>
      </Modal>

      <ConfirmDialog
        open={!!actionId}
        onClose={() => { setActionId(null); setActionType(null); }}
        onConfirm={handleAction}
        title={`${actionType?.charAt(0).toUpperCase()}${actionType?.slice(1)} Resignation`}
        message={`Are you sure you want to ${actionType} this resignation?`}
        confirmLabel={actionType === 'complete' ? 'Complete Exit' : actionType}
        danger={actionType === 'reject' || actionType === 'complete'}
      />
    </Box>
  );
};

export default Resignations;
