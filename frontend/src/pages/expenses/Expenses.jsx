import { useEffect, useState } from 'react';
import {
  Box, Typography, Drawer, IconButton, TextField,
} from '@mui/material';
import { Plus, X, Check, Ban, Download, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../context/AuthContext';
import { useLocalization } from '../../context/LocalizationContext';
import { expenseAPI } from '../../services/services';
import {
  Card, Button, SearchBar, StatusBadge, Loader, EmptyState, Input, ConfirmDialog, DataTable,
} from '../../components/ui';
import { getErrorMessage, downloadBlob } from '../../utils/helpers';
import { getFileUrl } from '../../utils/fileUrl';

const Expenses = () => {
  const { isAdminOnly, isAccountant, user } = useAuth();
  const { formatCurrency, formatDate, currency: companyCurrency } = useLocalization();
  const canReview = isAdminOnly || isAccountant;

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [receiptFile, setReceiptFile] = useState(null);
  const [approveId, setApproveId] = useState(null);
  const [rejectId, setRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: {
      category: '',
      amount: '',
      expenseDate: new Date().toISOString().slice(0, 10),
      description: '',
    },
  });

  const fetchExpenses = async (page = 1) => {
    setLoading(true);
    try {
      const { data } = await expenseAPI.getAll({
        page,
        limit: pagination.limit,
        from: dateFrom || undefined,
        to: dateTo || undefined,
      });
      setRows(data.data || []);
      setPagination(data.pagination || { total: 0, page: 1, limit: 10, totalPages: 1 });
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo]);

  const filtered = rows.filter((row) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (row.employee_name || '').toLowerCase().includes(q) ||
      (row.category || '').toLowerCase().includes(q) ||
      (row.description || '').toLowerCase().includes(q)
    );
  });

  const openCreate = () => {
    reset({
      category: '',
      amount: '',
      expenseDate: new Date().toISOString().slice(0, 10),
      description: '',
    });
    setReceiptFile(null);
    setDrawerOpen(true);
  };

  const onCreate = async (form) => {
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('category', form.category);
      fd.append('amount', form.amount);
      fd.append('expenseDate', form.expenseDate);
      if (form.description) fd.append('description', form.description);
      if (companyCurrency) fd.append('currency', companyCurrency);
      if (receiptFile) fd.append('receipt', receiptFile);
      await expenseAPI.create(fd);
      toast.success('Expense submitted');
      setDrawerOpen(false);
      fetchExpenses(pagination.page);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async () => {
    setActionLoading(true);
    try {
      await expenseAPI.updateStatus(approveId, { status: 'approved' });
      toast.success('Expense approved');
      setApproveId(null);
      fetchExpenses(pagination.page);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error('Rejection reason is required');
      return;
    }
    setActionLoading(true);
    try {
      await expenseAPI.updateStatus(rejectId, { status: 'rejected', rejectionReason: rejectReason.trim() });
      toast.success('Expense rejected');
      setRejectId(null);
      setRejectReason('');
      fetchExpenses(pagination.page);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    setActionLoading(true);
    try {
      await expenseAPI.delete(deleteId);
      toast.success('Expense deleted');
      setDeleteId(null);
      fetchExpenses(pagination.page);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setActionLoading(false);
    }
  };

  const downloadReceipt = async (row) => {
    try {
      const { data } = await expenseAPI.downloadReceipt(row.id);
      const name = row.receipt_url ? row.receipt_url.split('/').pop() : `receipt-${row.id}`;
      downloadBlob(data, name);
    } catch {
      const url = getFileUrl(row.receipt_url);
      if (url) window.open(url, '_blank');
      else toast.error('Receipt not available');
    }
  };

  const columns = [
    { field: 'employee_name', headerName: 'Employee', minWidth: 140 },
    {
      field: 'expense_date',
      headerName: 'Date',
      minWidth: 120,
      renderCell: ({ value }) => formatDate(value),
    },
    { field: 'category', headerName: 'Category', minWidth: 120 },
    {
      field: 'amount',
      headerName: 'Amount',
      minWidth: 120,
      renderCell: ({ row }) => formatCurrency(row.amount, row.currency),
    },
    {
      field: 'description',
      headerName: 'Description',
      minWidth: 180,
      renderCell: ({ value }) => value || '—',
    },
    {
      field: 'status',
      headerName: 'Status',
      minWidth: 110,
      renderCell: ({ value }) => <StatusBadge status={value} />,
    },
    {
      field: 'receipt_url',
      headerName: 'Receipt',
      minWidth: 90,
      renderCell: ({ row }) => (row.receipt_url ? (
        <IconButton size="small" onClick={() => downloadReceipt(row)} aria-label="Download receipt">
          <Download size={16} />
        </IconButton>
      ) : '—'),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      minWidth: 140,
      renderCell: ({ row }) => (
        <Box display="flex" gap={0.5}>
          {canReview && row.status === 'pending' && (
            <>
              <IconButton size="small" color="success" onClick={() => setApproveId(row.id)} aria-label="Approve">
                <Check size={16} />
              </IconButton>
              <IconButton size="small" color="error" onClick={() => { setRejectId(row.id); setRejectReason(''); }} aria-label="Reject">
                <Ban size={16} />
              </IconButton>
            </>
          )}
          {(isAdminOnly || (row.employee_id === user?.empId && row.status === 'pending')) && (
            <IconButton size="small" onClick={() => setDeleteId(row.id)} aria-label="Delete">
              <Trash2 size={16} />
            </IconButton>
          )}
        </Box>
      ),
    },
  ];

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1.5}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Expenses</Typography>
          <Typography variant="body2" color="text.secondary">
            Submit and review company expenses
          </Typography>
        </Box>
        <Button startIcon={<Plus size={16} />} onClick={openCreate}>Add Expense</Button>
      </Box>

      <Card>
        <Box mb={2} display="flex" gap={1.5} flexWrap="wrap" alignItems="center">
          <Box sx={{ flex: 1, minWidth: 220 }}>
            <SearchBar value={search} onChange={setSearch} placeholder="Search employee, category, description" />
          </Box>
          <Input
            label="From"
            type="date"
            InputLabelProps={{ shrink: true }}
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            sx={{ width: 170 }}
          />
          <Input
            label="To"
            type="date"
            InputLabelProps={{ shrink: true }}
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            sx={{ width: 170 }}
          />
        </Box>
        {loading ? (
          <Loader />
        ) : filtered.length === 0 ? (
          <EmptyState title="No expenses" description="Submitted expenses will appear here." />
        ) : (
          <DataTable
            columns={columns}
            rows={filtered}
            pagination={pagination}
            onPageChange={(page) => fetchExpenses(page)}
            onRowsPerPageChange={(limit) => {
              setPagination((p) => ({ ...p, limit, page: 1 }));
              fetchExpenses(1);
            }}
          />
        )}
      </Card>

      <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Box sx={{ width: { xs: 320, sm: 420 }, p: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6" fontWeight={700}>Add Expense</Typography>
            <IconButton onClick={() => setDrawerOpen(false)}><X size={18} /></IconButton>
          </Box>
          <form onSubmit={handleSubmit(onCreate)}>
            <Box display="flex" flexDirection="column" gap={2}>
              <Input
                label="Category"
                error={errors.category?.message}
                {...register('category', { required: 'Category is required' })}
              />
              <Input
                label="Amount"
                type="number"
                inputProps={{ min: 0, step: '0.01' }}
                error={errors.amount?.message}
                {...register('amount', { required: 'Amount is required' })}
              />
              <Input
                label="Date"
                type="date"
                InputLabelProps={{ shrink: true }}
                error={errors.expenseDate?.message}
                {...register('expenseDate', { required: 'Date is required' })}
              />
              <Input
                label="Description"
                multiline
                rows={3}
                {...register('description')}
              />
              <Button variant="outlined" component="label">
                {receiptFile ? receiptFile.name : 'Upload receipt (optional)'}
                <input
                  type="file"
                  hidden
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xlsx,.xls"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                />
              </Button>
              <Button type="submit" loading={submitting}>Submit Expense</Button>
            </Box>
          </form>
        </Box>
      </Drawer>

      <ConfirmDialog
        open={Boolean(approveId)}
        onClose={() => setApproveId(null)}
        onConfirm={handleApprove}
        title="Approve expense"
        message="Approve this expense claim?"
        confirmLabel="Approve"
        loading={actionLoading}
      />

      <ConfirmDialog
        open={Boolean(rejectId)}
        onClose={() => { setRejectId(null); setRejectReason(''); }}
        onConfirm={handleReject}
        title="Reject expense"
        message="Provide a short reason for rejection."
        confirmLabel="Reject"
        danger
        loading={actionLoading}
      >
        <TextField
          fullWidth
          size="small"
          label="Rejection reason"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          sx={{ mt: 2 }}
        />
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete expense"
        message="Delete this expense? This cannot be undone."
        confirmLabel="Delete"
        danger
        loading={actionLoading}
      />
    </Box>
  );
};

export default Expenses;
