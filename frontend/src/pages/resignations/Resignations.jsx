import { useEffect, useState } from 'react';
import {
  Box, TextField, Grid, Typography, Divider,
} from '@mui/material';
import { LogOut, Eye } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import { resignationAPI } from '../../services/services';
import {
  Card, Button, DataTable, StatusBadge, Loader, EmptyState, Modal, Input, ConfirmDialog, Avatar,
} from '../../components/ui';
import { formatDate, getFullName, getErrorMessage } from '../../utils/helpers';
import { colors } from '../../theme';

const todayStr = () => new Date().toISOString().split('T')[0];

const Resignations = () => {
  const { isAdminOnly, isHr, user } = useAuth();
  const canManage = isAdminOnly || isHr;
  const [resignations, setResignations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ reason: '', lastWorkingDate: '' });
  const [formErrors, setFormErrors] = useState({});
  const [actionId, setActionId] = useState(null);
  const [actionType, setActionType] = useState(null);
  const [reviewRow, setReviewRow] = useState(null);

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

  const validateForm = () => {
    const errors = {};
    if (!form.reason.trim()) errors.reason = 'Please share a reason for resigning';
    else if (form.reason.trim().length < 10) errors.reason = 'Please provide a bit more detail (min 10 characters)';
    if (!form.lastWorkingDate) errors.lastWorkingDate = 'Last working date is required';
    else if (form.lastWorkingDate < todayStr()) errors.lastWorkingDate = 'Last working date cannot be in the past';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const closeSubmitModal = () => {
    setModalOpen(false);
    setForm({ reason: '', lastWorkingDate: '' });
    setFormErrors({});
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      await resignationAPI.submit(form);
      toast.success('Resignation submitted');
      closeSubmitModal();
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
      setReviewRow(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
    setActionId(null);
    setActionType(null);
  };

  const startAction = (row, type) => {
    setActionId(row.id);
    setActionType(type);
  };

  const columns = canManage ? [
    {
      field: 'employee',
      headerName: 'Employee',
      renderCell: ({ row }) => (
        <Box display="flex" alignItems="center" gap={1.5}>
          <Avatar name={getFullName(row.first_name, row.last_name)} size={36} />
          <Box>
            <Box fontWeight={500}>{getFullName(row.first_name, row.last_name)}</Box>
            <Box fontSize="0.75rem" color="text.secondary">{row.employee_id}</Box>
          </Box>
        </Box>
      ),
    },
    { field: 'department_name', headerName: 'Department' },
    {
      field: 'reason',
      headerName: 'Reason',
      renderCell: ({ value }) => (
        <Typography
          variant="body2"
          sx={{
            maxWidth: 220,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={value}
        >
          {value}
        </Typography>
      ),
    },
    { field: 'last_working_date', headerName: 'Last Working Day', renderCell: ({ value }) => formatDate(value) },
    { field: 'status', headerName: 'Status', renderCell: ({ value }) => <StatusBadge status={value} /> },
    {
      field: 'actions',
      headerName: 'Actions',
      renderCell: ({ row }) => (
        <Box display="flex" gap={1}>
          <Button size="small" variant="outlined" startIcon={<Eye size={14} />} onClick={() => setReviewRow(row)}>
            Review
          </Button>
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
      {!canManage && !hasActive && (
        <Box display="flex" justifyContent="flex-end" mb={2}>
          <Button startIcon={<LogOut size={18} />} onClick={() => setModalOpen(true)}>Submit Resignation</Button>
        </Box>
      )}

      {!canManage && hasActive && (
        <Box mb={2} p={2} bgcolor="#FFF7ED" borderRadius={2} border="1px solid #FED7AA">
          <Typography variant="body2" color="#9A3412">
            You have an active resignation request. You can submit a new one once it's resolved.
          </Typography>
        </Box>
      )}

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
        <Card padding={0}>
          <DataTable columns={columns} rows={resignations} />
        </Card>
      )}

      {/* Submit resignation */}
      <Modal open={modalOpen} onClose={closeSubmitModal} title="Submit Resignation" subtitle="This will be sent to HR and Admin for review">
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12 }}>
            <TextField
              label="Reason for resigning"
              placeholder="Let us know why you're leaving and anything you'd like the team to know"
              multiline
              rows={4}
              fullWidth
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              error={!!formErrors.reason}
              helperText={formErrors.reason || `${form.reason.length}/500`}
              inputProps={{ maxLength: 500 }}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Input
              label="Last Working Date"
              type="date"
              value={form.lastWorkingDate}
              onChange={(e) => setForm({ ...form, lastWorkingDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
              inputProps={{ min: todayStr() }}
              error={formErrors.lastWorkingDate}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Divider sx={{ mb: 2 }} />
            <Box display="flex" gap={1.5}>
              <Button variant="outlined" fullWidth onClick={closeSubmitModal}>Cancel</Button>
              <Button fullWidth loading={submitting} onClick={handleSubmit}>Submit Resignation</Button>
            </Box>
          </Grid>
        </Grid>
      </Modal>

      {/* Manager review modal */}
      <Modal
        open={!!reviewRow}
        onClose={() => setReviewRow(null)}
        title="Review Resignation"
        subtitle={reviewRow ? getFullName(reviewRow.first_name, reviewRow.last_name) : ''}
      >
        {reviewRow && (
          <Box>
            <Box display="flex" alignItems="center" gap={2} mb={2.5}>
              <Avatar name={getFullName(reviewRow.first_name, reviewRow.last_name)} size={56} />
              <Box>
                <Typography fontWeight={700}>{getFullName(reviewRow.first_name, reviewRow.last_name)}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {reviewRow.employee_id} · {reviewRow.designation || '—'}
                </Typography>
              </Box>
              <Box ml="auto">
                <StatusBadge status={reviewRow.status} />
              </Box>
            </Box>

            <Box display="flex" justifyContent="space-between" py={1.2} borderBottom={`1px solid ${colors.border}`}>
              <Typography variant="body2" color="text.secondary">Department</Typography>
              <Typography variant="body2" fontWeight={500}>{reviewRow.department_name || '—'}</Typography>
            </Box>
            <Box display="flex" justifyContent="space-between" py={1.2} borderBottom={`1px solid ${colors.border}`}>
              <Typography variant="body2" color="text.secondary">Submitted</Typography>
              <Typography variant="body2" fontWeight={500}>{formatDate(reviewRow.created_at)}</Typography>
            </Box>
            <Box display="flex" justifyContent="space-between" py={1.2} borderBottom={`1px solid ${colors.border}`}>
              <Typography variant="body2" color="text.secondary">Last Working Day</Typography>
              <Typography variant="body2" fontWeight={500}>{formatDate(reviewRow.last_working_date)}</Typography>
            </Box>

            <Typography variant="subtitle2" color="text.secondary" fontWeight={700} mt={2.5} mb={1}>
              REASON
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {reviewRow.reason || '—'}
            </Typography>

            {isAdminOnly && reviewRow.status === 'pending' && (
              <Box display="flex" gap={1.5} mt={3}>
                <Button fullWidth onClick={() => startAction(reviewRow, 'approve')}>Approve</Button>
                <Button fullWidth variant="outlined" color="error" onClick={() => startAction(reviewRow, 'reject')}>Reject</Button>
              </Box>
            )}
            {isAdminOnly && reviewRow.status === 'approved' && (
              <Box mt={3}>
                <Button fullWidth onClick={() => startAction(reviewRow, 'complete')}>Complete Exit</Button>
              </Box>
            )}
          </Box>
        )}
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