import { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import { useLocalization } from '../../context/LocalizationContext';
import { incomeAPI } from '../../services/services';
import {
  Card, SearchBar, Loader, EmptyState, Input, DataTable,
} from '../../components/ui';
import { getErrorMessage } from '../../utils/helpers';
import { toast } from 'react-toastify';

const Income = () => {
  const { isAdminOnly } = useAuth();
  const { formatCurrency, formatDate } = useLocalization();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [totals, setTotals] = useState({ amount: 0 });
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });

  const fetchIncome = async (page = 1) => {
    setLoading(true);
    try {
      const { data } = await incomeAPI.getAll({
        page,
        limit: pagination.limit,
        from: dateFrom || undefined,
        to: dateTo || undefined,
      });
      setRows(data.data || []);
      setTotals(data.totals || { amount: 0 });
      setPagination(data.pagination || { total: 0, page: 1, limit: 10, totalPages: 1 });
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdminOnly) return;
    fetchIncome(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, isAdminOnly]);

  const filtered = rows.filter((row) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const employees = Array.isArray(row.employee_details)
      ? row.employee_details.map((e) => `${e.employeeName || ''} ${e.employeeCode || ''}`).join(' ')
      : '';
    return (
      (row.client || '').toLowerCase().includes(q) ||
      (row.client_email || '').toLowerCase().includes(q) ||
      (row.transaction_id || '').toLowerCase().includes(q) ||
      (row.period_label || '').toLowerCase().includes(q) ||
      employees.toLowerCase().includes(q)
    );
  });

  const columns = [
    {
      field: 'payment_date',
      headerName: 'Date',
      minWidth: 120,
      renderCell: ({ value }) => formatDate(value),
    },
    { field: 'client', headerName: 'Client', minWidth: 140 },
    { field: 'client_email', headerName: 'Client Email', minWidth: 180 },
    { field: 'period_label', headerName: 'Period', minWidth: 140 },
    { field: 'transaction_id', headerName: 'Transaction ID', minWidth: 140 },
    {
      field: 'amount',
      headerName: 'Amount Received',
      minWidth: 140,
      renderCell: ({ row }) => formatCurrency(row.amount, row.currency),
    },
    {
      field: 'invoice_total',
      headerName: 'Invoice Total',
      minWidth: 130,
      renderCell: ({ row }) => formatCurrency(row.invoice_total, row.currency),
    },
    {
      field: 'employee_details',
      headerName: 'Timesheet Employees',
      minWidth: 220,
      renderCell: ({ value }) => {
        const list = Array.isArray(value) ? value : [];
        if (!list.length) return '—';
        return list.map((e) => e.employeeName || e.employeeCode).filter(Boolean).join(', ');
      },
    },
    {
      field: 'timesheet_count',
      headerName: 'Timesheets',
      minWidth: 100,
    },
    {
      field: 'notes',
      headerName: 'Notes',
      minWidth: 160,
      renderCell: ({ value }) => value || '—',
    },
  ];

  if (!isAdminOnly) {
    return (
      <EmptyState title="Access denied" description="Income is visible to administrators only." />
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1.5}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Income</Typography>
          <Typography variant="body2" color="text.secondary">
            Client payments recorded from timesheet billing
          </Typography>
        </Box>
        <Typography variant="subtitle1" fontWeight={700}>
          Total: {formatCurrency(totals.amount)}
        </Typography>
      </Box>

      <Card>
        <Box mb={2} display="flex" gap={1.5} flexWrap="wrap" alignItems="center">
          <Box sx={{ flex: 1, minWidth: 220 }}>
            <SearchBar value={search} onChange={setSearch} placeholder="Search client, email, transaction, period" />
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
          <EmptyState title="No income" description="Payments received from clients will appear here." />
        ) : (
          <DataTable
            columns={columns}
            rows={filtered}
            pagination={pagination}
            onPageChange={(page) => fetchIncome(page)}
            onRowsPerPageChange={(limit) => {
              setPagination((p) => ({ ...p, limit, page: 1 }));
              fetchIncome(1);
            }}
          />
        )}
      </Card>
    </Box>
  );
};

export default Income;
