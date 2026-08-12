import { useEffect, useState } from 'react';
import { Grid, Box, Typography, Chip } from '@mui/material';
import { LogIn, LogOut, MapPin, Download, ImageOff } from 'lucide-react';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import { useAuth } from '../../context/AuthContext';
import { attendanceAPI } from '../../services/services';
import {
  PageHeader, Card, Button, DataTable, StatusBadge, Loader, SearchBar, Select, CameraCapture,
} from '../../components/ui';
import { colors } from '../../theme';
import { formatDate, calculateWorkingTime, getErrorMessage, downloadBlob, monthNames } from '../../utils/helpers';
import { getFileUrl, getMapsUrl } from '../../utils/fileUrl';

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

const LocationCell = ({ location }) => {
  const mapsUrl = getMapsUrl(location);
  if (!location) return <Typography variant="caption" color="text.secondary">—</Typography>;
  return mapsUrl ? (
    <Box
      component="a"
      href={mapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: colors.primary, textDecoration: 'none' }}
    >
      <MapPin size={14} />
      <Typography variant="caption">View</Typography>
    </Box>
  ) : (
    <Typography variant="caption">{location}</Typography>
  );
};

const PhotoCell = ({ selfieUrl }) => {
  const url = getFileUrl(selfieUrl);
  if (!url) {
    return (
      <Box sx={{ width: 32, height: 32, borderRadius: 0, bgcolor: colors.background, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ImageOff size={14} color={colors.text.secondary} />
      </Box>
    );
  }
  return (
    <Box component="a" href={url} target="_blank" rel="noopener noreferrer">
      <Box
        component="img"
        src={url}
        alt="Selfie"
        sx={{ width: 32, height: 32, borderRadius: 0, objectFit: 'cover', border: `1px solid ${colors.border}` }}
      />
    </Box>
  );
};

const Attendance = () => {
  const { isAdminOnly, isHr, isTeamLead } = useAuth();
  const canViewOrg = isAdminOnly || isHr || isTeamLead;
  const canClockInOut = !isAdminOnly;
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
  const [cameraAction, setCameraAction] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (canClockInOut) {
        const todayRes = await attendanceAPI.today();
        setToday(todayRes.data.data);
      }

      if (canViewOrg) {
        const allRes = await attendanceAPI.getAll({ search, status: statusFilter, month, year, limit: 500 });
        setAllRecords(allRes.data.data || []);
      } else {
        const historyRes = await attendanceAPI.history({ month, year, limit: 100 });
        setHistory(historyRes.data.data || []);
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [canViewOrg, canClockInOut, search, statusFilter, month, year]);
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
    { field: 'selfie_url', headerName: 'In Photo', renderCell: ({ value }) => <PhotoCell selfieUrl={value} /> },
    { field: 'location', headerName: 'In Location', renderCell: ({ value }) => <LocationCell location={value} /> },
    { field: 'clock_in', headerName: 'Clock In', renderCell: ({ value }) => value ? formatDate(value, 'hh:mm A') : '—' },
    { field: 'clock_out', headerName: 'Clock Out', renderCell: ({ value }) => value ? formatDate(value, 'hh:mm A') : '—' },
    { field: 'clock_out_selfie_url', headerName: 'Out Photo', renderCell: ({ value }) => <PhotoCell selfieUrl={value} /> },
    { field: 'clock_out_location', headerName: 'Out Location', renderCell: ({ value }) => <LocationCell location={value} /> },
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
  const todayInSelfieUrl = getFileUrl(today?.selfie_url);
  const todayInMapsUrl = getMapsUrl(today?.location);
  const todayOutSelfieUrl = getFileUrl(today?.clock_out_selfie_url);
  const todayOutMapsUrl = getMapsUrl(today?.clock_out_location);

  const rows = canViewOrg ? allRecords : history;
  const paginatedRows = rows.slice((page - 1) * limit, page * limit);

  return (
    <Box>
      <PageHeader
        title="Attendance"
        subtitle={
          isAdminOnly ? 'View organization attendance records'
            : isTeamLead ? 'View your team attendance records'
              : isHr ? 'View employee attendance records'
                : 'Track your daily attendance and working hours'
        }
        breadcrumb={[{ label: 'Attendance', path: '/attendance' }]}
      />

      <Grid container spacing={3} mb={3}>
        {canClockInOut && (
          <Grid size={{ xs: 12, lg: 8 }}>
            <Card title="Today's Attendance">
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Box textAlign="center" p={3} bgcolor={colors.background} borderRadius={0}>
                    <Typography variant="h2" fontWeight={700} color="primary">{timer}</Typography>
                    <Typography variant="body2" color="text.secondary" mb={2}>Live Timer</Typography>
                    <StatusBadge status={today?.status || 'absent'} />
                  </Box>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Box display="flex" flexDirection="column" gap={2}>
                    {todayInSelfieUrl && (
                      <Box display="flex" alignItems="center" gap={1.5}>
                        <Box
                          component="img"
                          src={todayInSelfieUrl}
                          alt="Clock-in selfie"
                          sx={{ width: 48, height: 48, borderRadius: 0, objectFit: 'cover', border: `1px solid ${colors.border}` }}
                        />
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block">Clocked in</Typography>
                          {todayInMapsUrl && (
                            <Box
                              component="a"
                              href={todayInMapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: colors.primary, textDecoration: 'none' }}
                            >
                              <MapPin size={14} />
                              <Typography variant="caption">View location</Typography>
                            </Box>
                          )}
                        </Box>
                      </Box>
                    )}
                    {!todayInSelfieUrl && (
                      <Box display="flex" alignItems="center" gap={1}>
                        <MapPin size={18} color={colors.text.secondary} />
                        <Typography variant="body2">Not checked in</Typography>
                      </Box>
                    )}

                    {todayOutSelfieUrl && (
                      <Box display="flex" alignItems="center" gap={1.5}>
                        <Box
                          component="img"
                          src={todayOutSelfieUrl}
                          alt="Clock-out selfie"
                          sx={{ width: 48, height: 48, borderRadius: 0, objectFit: 'cover', border: `1px solid ${colors.border}` }}
                        />
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block">Clocked out</Typography>
                          {todayOutMapsUrl && (
                            <Box
                              component="a"
                              href={todayOutMapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: colors.primary, textDecoration: 'none' }}
                            >
                              <MapPin size={14} />
                              <Typography variant="caption">View location</Typography>
                            </Box>
                          )}
                        </Box>
                      </Box>
                    )}

                    <Box display="flex" gap={2}>
                      <Button startIcon={<LogIn size={18} />} onClick={() => openCamera('in')} disabled={!canClockIn}>
                        Clock In
                      </Button>
                      <Button variant="outlined" startIcon={<LogOut size={18} />} onClick={() => openCamera('out')} disabled={!canClockOut} color="error">
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
        )}

        <Grid size={{ xs: 12, lg: canClockInOut ? 4 : 12 }}>
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
          {canViewOrg && (
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
              options={[2024, 2025, 2026, 2027].map((y) => ({ value: y, label: String(y) }))}
              fullWidth
            />
          </Box>
          {canViewOrg && (
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
          {(isAdminOnly || isHr) && (
            <Button variant="outlined" startIcon={<Download size={18} />} onClick={handleExport} sx={{ flexShrink: 0 }}>
              Export
            </Button>
          )}
        </Box>

        <DataTable
          columns={canViewOrg ? adminColumns : columns}
          rows={paginatedRows}
          emptyTitle="No attendance records"
          pagination={{ total: rows.length, page, limit }}
          onPageChange={setPage}
          onRowsPerPageChange={(newLimit) => { setLimit(newLimit); setPage(1); }}
        />
      </Card>

      {canClockInOut && (
        <CameraCapture
          open={cameraOpen}
          onClose={closeCamera}
          onConfirm={handleCameraConfirm}
          confirmLoading={actionLoading}
          title={cameraAction === 'in' ? 'Clock In — Capture Selfie' : 'Clock Out — Capture Selfie'}
        />
      )}
    </Box>
  );
};

export default Attendance;
