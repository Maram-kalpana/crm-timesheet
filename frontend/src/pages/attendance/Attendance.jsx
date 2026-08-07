import { useEffect, useState } from 'react';
import { Grid, Box, Typography, Chip } from '@mui/material';
import { LogIn, LogOut, MapPin, Clock, Download } from 'lucide-react';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import { useAuth } from '../../context/AuthContext';
import { attendanceAPI } from '../../services/services';
import {
  PageHeader, Card, Button, DataTable, StatusBadge, Loader, SearchBar, Select, CameraCapture,
} from '../../components/ui';
import { colors } from '../../theme';
import { formatDate, calculateWorkingTime, getErrorMessage, downloadBlob, monthNames } from '../../utils/helpers';

const getLocationString = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        resolve(`${latitude.toFixed(6)},${longitude.toFixed(6)}`);
      },
      () => reject(new Error('Location access denied. Please allow location permission.')),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });

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
  const [month, setMonth] = useState(dayjs().month() + 1);
  const [year, setYear] = useState(dayjs().year());

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraAction, setCameraAction] = useState(null); // 'in' | 'out'

  const fetchData = async () => {
    try {
      const todayRes = await attendanceAPI.today();
      setToday(todayRes.data.data);

      if (isAdmin) {
        const allRes = await attendanceAPI.getAll({ search, status: statusFilter, month, year });
        setAllRecords(allRes.data.data || []);
      } else {
        const historyRes = await attendanceAPI.history({ month, year });
        setHistory(historyRes.data.data || []);
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [isAdmin, search, statusFilter, month, year]);
  useEffect(() => { setPage(1); }, [search, statusFilter, month, year]);

  useEffect(() => {
    if (today?.clock_in && !today?.clock_out) {
      const interval = setInterval(() => setTimer(calculateWorkingTime(today.clock_in)), 1000);
      return () => clearInterval(interval);
    }
  }, [today]);

  const openCamera = (action) => {
    setCameraAction(action);
    setCameraOpen(true);
  };

  const closeCamera = () => {
    setCameraOpen(false);
    setCameraAction(null);
  };

  const handleCameraConfirm = async (selfieBlob) => {
    setActionLoading(true);
    try {
      const location = await getLocationString();

      const formData = new FormData();
      formData.append('location', location);
      formData.append('selfie', selfieBlob, 'selfie.jpg');

      if (cameraAction === 'in') {
        await attendanceAPI.clockIn(formData);
        toast.success('Clocked in successfully!');
      } else {
        await attendanceAPI.clockOut(formData);
        toast.success('Clocked out successfully!');
      }

      closeCamera();
      fetchData();
    } catch (error) {
      toast.error(error.message || getErrorMessage(error));
    } finally {
      setActionLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const { data } = await attendanceAPI.export({ month, year });
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
    ...columns,
  ];

  if (loading) return <Loader />;

  const canClockIn = !today?.clock_in;
  const canClockOut = today?.clock_in && !today?.clock_out;

  const rows = isAdmin ? allRecords : history;
  const paginatedRows = rows.slice((page - 1) * limit, page * limit);

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
                    <Button
                      startIcon={<LogIn size={18} />}
                      onClick={() => openCamera('in')}
                      disabled={!canClockIn}
                    >
                      Clock In
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<LogOut size={18} />}
                      onClick={() => openCamera('out')}
                      disabled={!canClockOut}
                      color="error"
                    >
                      Clock Out
                    </Button>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    A live photo and your location are captured automatically when you clock in or out.
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Card title="Monthly Summary">
            <Box display="flex" flexDirection="column" gap={2}>
              {['present', 'late', 'absent', 'on-leave'].map((status) => {
                const count = rows.filter((h) => h.status === status).length;
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

      <Card title="Attendance History" subtitle={`${monthNames[month - 1]} ${year}`}>
        <Box display="flex" gap={2} mb={2} alignItems="center" flexWrap="nowrap">
          {isAdmin && (
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <SearchBar value={search} onChange={setSearch} placeholder="Search employees..." fullWidth />
            </Box>
          )}
          <Box sx={{ width: 160, flexShrink: 0 }}>
            <Select
              label="Month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              options={monthNames.map((m, i) => ({ value: i + 1, label: m }))}
              fullWidth
            />
          </Box>
          <Box sx={{ width: 120, flexShrink: 0 }}>
            <Select
              label="Year"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              options={[2024, 2025, 2026].map((y) => ({ value: y, label: String(y) }))}
              fullWidth
            />
          </Box>
          {isAdmin && (
            <Box sx={{ width: 160, flexShrink: 0 }}>
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
          )}
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
          columns={isAdmin ? adminColumns : columns}
          rows={paginatedRows}
          emptyTitle="No attendance records"
          pagination={{ total: rows.length, page, limit }}
          onPageChange={setPage}
          onRowsPerPageChange={(newLimit) => { setLimit(newLimit); setPage(1); }}
        />
      </Card>

      <CameraCapture
        open={cameraOpen}
        onClose={closeCamera}
        onConfirm={handleCameraConfirm}
        confirmLoading={actionLoading}
        title={cameraAction === 'in' ? 'Clock In — Capture Selfie' : 'Clock Out — Capture Selfie'}
      />
    </Box>
  );
};

export default Attendance;