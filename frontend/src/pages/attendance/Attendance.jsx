import { useEffect, useState } from 'react';
import { Grid, Box, Typography, Chip } from '@mui/material';
import { LogIn, LogOut, MapPin, Camera, Clock, Download } from 'lucide-react';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import { useAuth } from '../../context/AuthContext';
import { attendanceAPI } from '../../services/services';
import {
  PageHeader, Card, Button, DataTable, StatusBadge, Loader, SearchBar, Select,
} from '../../components/ui';
import { colors } from '../../theme';
import { formatDate, formatDateTime, calculateWorkingTime, getErrorMessage, downloadBlob } from '../../utils/helpers';

const Attendance = () => {
  const { user, isAdmin } = useAuth();
  const [today, setToday] = useState(null);
  const [history, setHistory] = useState([]);
  const [allRecords, setAllRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [timer, setTimer] = useState('00:00:00');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selfiePreview, setSelfiePreview] = useState(null);

  const [historyPage, setHistoryPage] = useState(1);
  const [historyLimit, setHistoryLimit] = useState(10);
  const [allPage, setAllPage] = useState(1);
  const [allLimit, setAllLimit] = useState(10);

  const fetchData = async () => {
    try {
      const [todayRes, historyRes] = await Promise.all([
        attendanceAPI.today(),
        attendanceAPI.history({ month: dayjs().month() + 1, year: dayjs().year() }),
      ]);
      setToday(todayRes.data.data);
      setHistory(historyRes.data.data || []);
      if (isAdmin) {
        const allRes = await attendanceAPI.getAll({ search, status: statusFilter });
        setAllRecords(allRes.data.data || []);
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [isAdmin, search, statusFilter]);
  useEffect(() => { setHistoryPage(1); }, [history.length]);
  useEffect(() => { setAllPage(1); }, [search, statusFilter]);

  useEffect(() => {
    if (today?.clock_in && !today?.clock_out) {
      const interval = setInterval(() => setTimer(calculateWorkingTime(today.clock_in)), 1000);
      return () => clearInterval(interval);
    }
  }, [today]);

  const handleClockIn = async () => {
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('location', 'Office / Remote');
      if (selfiePreview) {
        const blob = await fetch(selfiePreview).then((r) => r.blob());
        formData.append('selfie', blob, 'selfie.jpg');
      }
      await attendanceAPI.clockIn(formData);
      toast.success('Clocked in successfully!');
      fetchData();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setActionLoading(false);
    }
  };

  const handleClockOut = async () => {
    setActionLoading(true);
    try {
      await attendanceAPI.clockOut();
      toast.success('Clocked out successfully!');
      fetchData();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setActionLoading(false);
    }
  };

  const handleSelfieCapture = (e) => {
    const file = e.target.files?.[0];
    if (file) setSelfiePreview(URL.createObjectURL(file));
  };

  const handleExport = async () => {
    try {
      const { data } = await attendanceAPI.export({ month: dayjs().month() + 1, year: dayjs().year() });
      downloadBlob(data, 'attendance.xlsx');
      toast.success('Exported successfully');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const columns = [
    { field: 'date', headerName: 'Date', renderCell: ({ value }) => formatDate(value) },
    { field: 'clock_in', headerName: 'Clock In', renderCell: ({ value }) => value ? formatDate(value, 'hh:mm A') : '—' },
    { field: 'clock_out', headerName: 'Clock Out', renderCell: ({ value }) => value ? formatDate(value, 'hh:mm A') : '—' },
    { field: 'working_hours', headerName: 'Hours', renderCell: ({ value }) => value ? `${value}h` : '—' },
    { field: 'status', headerName: 'Status', renderCell: ({ value }) => <StatusBadge status={value} /> },
  ];

  const adminColumns = [
    { field: 'employee_id', headerName: 'ID' },
    { field: 'first_name', headerName: 'Name', renderCell: ({ row }) => `${row.first_name} ${row.last_name}` },
    { field: 'department_name', headerName: 'Department' },
    ...columns.slice(1),
  ];

  if (loading) return <Loader />;

  const canClockIn = !today?.clock_in;
  const canClockOut = today?.clock_in && !today?.clock_out;

  const paginatedHistory = history.slice((historyPage - 1) * historyLimit, historyPage * historyLimit);
  const paginatedAllRecords = allRecords.slice((allPage - 1) * allLimit, allPage * allLimit);

  return (
    <Box>
      <PageHeader
        title="Attendance"
        subtitle="Track your daily attendance and working hours"
        breadcrumb={[{ label: 'Attendance', path: '/attendance' }]}
      />

      <Grid container spacing={3} mb={3}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card title="Today's Attendance">
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Box textAlign="center" p={3} bgcolor={colors.background} borderRadius={3}>
                  <Typography variant="h2" fontWeight={700} color="primary">{timer}</Typography>
                  <Typography variant="body2" color="text.secondary" mb={2}>Live Timer</Typography>
                  <StatusBadge status={today?.status || 'absent'} />
                </Box>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Box display="flex" flexDirection="column" gap={2}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <MapPin size={18} color={colors.text.secondary} />
                    <Typography variant="body2">{today?.location || 'Not checked in'}</Typography>
                  </Box>
                  <Box display="flex" gap={2}>
                    <Button startIcon={<LogIn size={18} />} onClick={handleClockIn} disabled={!canClockIn} loading={actionLoading && canClockIn}>
                      Clock In
                    </Button>
                    <Button variant="outlined" startIcon={<LogOut size={18} />} onClick={handleClockOut} disabled={!canClockOut} loading={actionLoading && canClockOut} color="error">
                      Clock Out
                    </Button>
                  </Box>
                  <Box>
                    <input type="file" accept="image/*" capture="user" id="selfie" hidden onChange={handleSelfieCapture} />
                    <label htmlFor="selfie">
                      <Button component="span" variant="text" startIcon={<Camera size={18} />} size="small">
                        {selfiePreview ? 'Selfie captured' : 'Capture Selfie'}
                      </Button>
                    </label>
                    {selfiePreview && (
                      <Box component="img" src={selfiePreview} alt="Selfie" sx={{ width: 80, height: 80, borderRadius: 2, mt: 1, objectFit: 'cover' }} />
                    )}
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Card title="Monthly Summary">
            <Box display="flex" flexDirection="column" gap={2}>
              {['present', 'late', 'absent', 'on-leave'].map((status) => {
                const count = history.filter((h) => h.status === status).length;
                return (
                  <Box key={status} display="flex" justifyContent="space-between" alignItems="center">
                    <StatusBadge status={status} />
                    <Chip label={count} size="small" />
                  </Box>
                );
              })}
            </Box>
          </Card>
        </Grid>
      </Grid>

      <Card title="Attendance History" subtitle={dayjs().format('MMMM YYYY')}>
        <DataTable
          columns={columns}
          rows={paginatedHistory}
          emptyTitle="No attendance records"
          pagination={{ total: history.length, page: historyPage, limit: historyLimit }}
          onPageChange={setHistoryPage}
          onRowsPerPageChange={(limit) => { setHistoryLimit(limit); setHistoryPage(1); }}
        />
      </Card>

      {isAdmin && (
        <Box mt={3}>
          <Card title="All Employees Today">
            <Box display="flex" gap={2} mb={2} alignItems="center" flexWrap="nowrap">
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <SearchBar
                  value={search}
                  onChange={setSearch}
                  placeholder="Search employees..."
                  fullWidth
                />
              </Box>
              <Box sx={{ width: 180, flexShrink: 0 }}>
                <Select
                  label="Status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  options={[
                    { value: '', label: 'All Status' },
                    { value: 'present', label: 'Present' },
                    { value: 'late', label: 'Late' },
                    { value: 'absent', label: 'Absent' },
                  ]}
                  fullWidth
                />
              </Box>
              <Button
                variant="outlined"
                startIcon={<Download size={18} />}
                onClick={handleExport}
                sx={{ flexShrink: 0 }}
              >
                Export
              </Button>
            </Box>
            <DataTable
              columns={adminColumns}
              rows={paginatedAllRecords}
              pagination={{ total: allRecords.length, page: allPage, limit: allLimit }}
              onPageChange={setAllPage}
              onRowsPerPageChange={(limit) => { setAllLimit(limit); setAllPage(1); }}
            />
          </Card>
        </Box>
      )}
    </Box>
  );
};

export default Attendance;