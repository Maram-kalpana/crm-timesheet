import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Grid, Typography, Tabs, Tab, Divider, IconButton,
} from '@mui/material';
import { Pencil, Trash2, Upload, Camera } from 'lucide-react';
import { toast } from 'react-toastify';
import { useForm } from 'react-hook-form';
import { employeeAPI, documentAPI, authAPI, departmentAPI } from '../../services/services';
import { useAuth } from '../../context/AuthContext';
import EmployeeEditModal from '../../components/employees/EmployeeEditModal';
import {
  PageHeader, Card, Avatar, StatusBadge, Loader, DataTable, EmptyState, Input, Button, ConfirmDialog,
} from '../../components/ui';
import { colors } from '../../theme';
import { formatDate, formatCurrency, getFullName, getErrorMessage, downloadBlob } from '../../utils/helpers';

const TabPanel = ({ children, value, index }) => (
  <Box hidden={value !== index} pt={3}>{value === index && children}</Box>
);

const EmployeeProfile = ({ isProfileRoute = false }) => {
  const { id: paramId } = useParams();
  const navigate = useNavigate();
  const { user, isEmployee, isAdminOnly, isHr, isTeamLead, fetchUser } = useAuth();
  const id = isProfileRoute ? user?.empId : paramId;

  const [employee, setEmployee] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const [changingPassword, setChangingPassword] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef(null);

  const isOwnProfile = String(user?.empId) === String(id);
  const canAdminEdit = (isAdminOnly || isHr) && !isOwnProfile;
  const canEdit = isOwnProfile || canAdminEdit;
  const canDelete = isAdminOnly && !isOwnProfile && employee?.role !== 'admin';

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const loadEmployee = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data } = await employeeAPI.getById(id);
      if (isEmployee && !isOwnProfile && !isProfileRoute) {
        toast.error('Access denied');
        navigate('/dashboard');
        return;
      }
      setEmployee(data.data);
    } catch (err) {
      toast.error(getErrorMessage(err));
      navigate(isProfileRoute || isOwnProfile ? '/dashboard' : '/employees');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployee();
  }, [id]);

  useEffect(() => {
    departmentAPI.getAll().then(({ data }) => setDepartments(data.data || [])).catch(() => {});
    if (canAdminEdit) {
      employeeAPI.getAll({ limit: 200, status: 'active' })
        .then(({ data }) => {
          const list = data.data || [];
          const managerRoles = ['hr', 'team_lead', 'manager'];
          if (isAdminOnly) managerRoles.unshift('admin');
          setManagers(list.filter((e) => managerRoles.includes(e.role)));
        })
        .catch(() => setManagers([]));
    }
  }, [canAdminEdit, isAdminOnly]);

  const handleDocDownload = async (doc) => {
    try {
      const { data } = await documentAPI.download(doc.id);
      downloadBlob(data, doc.title || 'document');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDocUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !employee) return;
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append('document', file);
        fd.append('employeeId', employee.id);
        fd.append('type', 'other');
        fd.append('title', file.name);
        await documentAPI.upload(fd);
      }
      toast.success('Document(s) uploaded');
      loadEmployee();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
    e.target.value = '';
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !employee) return;
    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      const { data } = await employeeAPI.uploadAvatar(employee.id, fd);
      setEmployee((prev) => ({ ...prev, avatar: data.avatar }));
      if (isOwnProfile) await fetchUser();
      toast.success('Avatar updated');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUploadingAvatar(false);
      e.target.value = '';
    }
  };

  const onChangePassword = async (formData) => {
    if (formData.newPassword !== formData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    setChangingPassword(true);
    try {
      await authAPI.changePassword({
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
      });
      toast.success('Password changed successfully');
      reset();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSaveEdit = async (payload) => {
    setSaving(true);
    try {
      await employeeAPI.update(employee.id, payload);
      toast.success('Profile updated successfully');
      setEditOpen(false);
      await loadEmployee();
      if (isOwnProfile) await fetchUser();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    setDeleting(true);
    try {
      await employeeAPI.delete(employee.id);
      toast.success('Employee deactivated');
      setDeleteOpen(false);
      navigate('/employees');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <Loader />;
  if (!employee) return <EmptyState title="Profile not found" description="The profile you're looking for doesn't exist." />;

  const InfoRow = ({ label, value }) => (
    <Box display="flex" justifyContent="space-between" py={1.5} borderBottom={`1px solid ${colors.border}`}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={500} textAlign="right">{value || '—'}</Typography>
    </Box>
  );

  const canSeeEmployeesList = isAdminOnly || isHr || isTeamLead;
  const breadcrumb = isProfileRoute || isOwnProfile
    ? [{ label: 'Profile', path: '/profile' }]
    : [
      ...(canSeeEmployeesList ? [{ label: 'Employees', path: '/employees' }] : []),
      { label: getFullName(employee.first_name, employee.last_name) },
    ];

  const tabs = ['Personal', 'Professional', 'Bank', 'Salary', 'Attendance', 'Projects', 'Leaves', 'Documents'];

  return (
    <Box>
      <PageHeader
        title={isProfileRoute || isOwnProfile ? 'My Profile' : getFullName(employee.first_name, employee.last_name)}
        subtitle={`${employee.designation || 'Employee'} · ${employee.department_name || 'N/A'}`}
        breadcrumb={breadcrumb}
        action={
          <Box display="flex" gap={1}>
            {canEdit && (
              <Button variant="outlined" startIcon={<Pencil size={16} />} onClick={() => setEditOpen(true)}>
                Edit
              </Button>
            )}
            {canDelete && (
              <Button variant="outlined" color="error" startIcon={<Trash2 size={16} />} onClick={() => setDeleteOpen(true)}>
                Deactivate
              </Button>
            )}
          </Box>
        }
      />

      <Card sx={{ mb: 3 }}>
        <Box display="flex" alignItems="center" gap={3} flexWrap="wrap">
          <Box position="relative">
            <Avatar name={getFullName(employee.first_name, employee.last_name)} src={employee.avatar} size={80} />
            {canEdit && (
              <>
                <input ref={avatarInputRef} type="file" hidden accept="image/*" onChange={handleAvatarUpload} />
                <IconButton
                  size="small"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  sx={{
                    position: 'absolute', bottom: 0, right: 0,
                    bgcolor: colors.primary, color: '#fff',
                    '&:hover': { bgcolor: colors.primary },
                  }}
                >
                  <Camera size={14} />
                </IconButton>
              </>
            )}
          </Box>
          <Box flex={1}>
            <Typography variant="h5" fontWeight={700}>{getFullName(employee.first_name, employee.last_name)}</Typography>
            <Typography color="text.secondary">{employee.email}</Typography>
            <Box display="flex" gap={1} mt={1} flexWrap="wrap">
              <StatusBadge status={employee.is_active ? 'active' : 'inactive'} />
              <StatusBadge status={employee.role} label={employee.role?.replace('_', ' ').toUpperCase()} />
            </Box>
          </Box>
          <Box textAlign="right">
            <Typography variant="caption" color="text.secondary">Employee ID</Typography>
            <Typography fontWeight={600}>{employee.employee_id}</Typography>
          </Box>
        </Box>
      </Card>

      {(isProfileRoute || isOwnProfile) && (
        <Card title="Change Password" sx={{ mb: 3 }}>
          <Box component="form" onSubmit={handleSubmit(onChangePassword)}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <Input label="Current Password" type="password" error={errors.currentPassword?.message} {...register('currentPassword', { required: 'Required' })} />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Input label="New Password" type="password" error={errors.newPassword?.message} {...register('newPassword', { required: 'Required', minLength: { value: 6, message: 'Min 6 characters' } })} />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Input label="Confirm New Password" type="password" error={errors.confirmPassword?.message} {...register('confirmPassword', { required: 'Required' })} />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Button type="submit" loading={changingPassword}>Update Password</Button>
              </Grid>
            </Grid>
          </Box>
        </Card>
      )}

      <Card padding={0}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2, borderBottom: `1px solid ${colors.border}` }}>
          {tabs.map((label) => (
            <Tab key={label} label={label} />
          ))}
        </Tabs>

        <Box px={3} pb={3}>
          <TabPanel value={tab} index={0}>
            <InfoRow label="Phone" value={employee.phone} />
            <InfoRow label="Date of Birth" value={formatDate(employee.date_of_birth)} />
            <InfoRow label="Gender" value={employee.gender} />
            <InfoRow label="Address" value={employee.address} />
            <InfoRow label="City" value={employee.city} />
            <InfoRow label="State" value={employee.state} />
            <InfoRow label="Country" value={employee.country} />
            <InfoRow label="Pincode" value={employee.pincode} />
            <InfoRow label="Emergency Contact" value={employee.emergency_contact_name ? `${employee.emergency_contact_name} (${employee.emergency_contact_phone})` : null} />
          </TabPanel>

          <TabPanel value={tab} index={1}>
            <InfoRow label="Department" value={employee.department_name} />
            <InfoRow label="Designation" value={employee.designation} />
            <InfoRow label="Employment Type" value={employee.employment_type} />
            <InfoRow label="Joining Date" value={formatDate(employee.joining_date)} />
            <InfoRow label="Reporting Manager" value={employee.manager_name} />
            <InfoRow label="Employment Status" value={employee.employment_status} />
          </TabPanel>

          <TabPanel value={tab} index={2}>
            <InfoRow label="Bank Name" value={employee.bank_name} />
            <InfoRow label="Account Holder" value={employee.bank_account_holder} />
            <InfoRow label="Account Number" value={employee.bank_account_number} />
            <InfoRow label="IFSC Code" value={employee.bank_ifsc} />
            <InfoRow label="Branch" value={employee.bank_branch} />
            <InfoRow label="PAN" value={employee.pan_number} />
            <InfoRow label="Aadhar" value={employee.aadhar_number} />
          </TabPanel>

          <TabPanel value={tab} index={3}>
            {employee.salary ? (
              <>
                <InfoRow label="Basic Salary" value={formatCurrency(employee.salary.basic_salary)} />
                <InfoRow label="HRA" value={formatCurrency(employee.salary.hra)} />
                <InfoRow label="Transport" value={formatCurrency(employee.salary.transport_allowance)} />
                <InfoRow label="Medical" value={formatCurrency(employee.salary.medical_allowance)} />
                <InfoRow label="Special Allowance" value={formatCurrency(employee.salary.special_allowance)} />
                <Divider sx={{ my: 2 }} />
                <InfoRow label="PF Deduction" value={formatCurrency(employee.salary.pf_deduction)} />
                <InfoRow label="Tax Deduction" value={formatCurrency(employee.salary.tax_deduction)} />
                <InfoRow label="Other Deductions" value={formatCurrency(employee.salary.other_deductions)} />
              </>
            ) : <EmptyState title="No salary data" description="Salary structure not configured." />}
          </TabPanel>

          <TabPanel value={tab} index={4}>
            <DataTable
              columns={[
                { field: 'date', headerName: 'Date', renderCell: ({ value }) => formatDate(value) },
                { field: 'status', headerName: 'Status', renderCell: ({ value }) => <StatusBadge status={value} /> },
                { field: 'working_hours', headerName: 'Hours', renderCell: ({ value }) => value ? `${value}h` : '—' },
              ]}
              rows={employee.attendance || []}
              emptyTitle="No attendance records"
            />
          </TabPanel>

          <TabPanel value={tab} index={5}>
            {(employee.projects || []).map((p) => (
              <Box key={p.id} py={1.5} borderBottom={`1px solid ${colors.border}`}>
                <Typography fontWeight={500}>{p.name}</Typography>
                <Typography variant="body2" color="text.secondary">{p.status}</Typography>
              </Box>
            ))}
            {!employee.projects?.length && <EmptyState title="No projects" />}
          </TabPanel>

          <TabPanel value={tab} index={6}>
            <DataTable
              columns={[
                { field: 'leave_type_name', headerName: 'Type' },
                { field: 'start_date', headerName: 'From', renderCell: ({ value }) => formatDate(value) },
                { field: 'end_date', headerName: 'To', renderCell: ({ value }) => formatDate(value) },
                { field: 'days', headerName: 'Days' },
                { field: 'status', headerName: 'Status', renderCell: ({ value }) => <StatusBadge status={value} /> },
              ]}
              rows={employee.leaves || []}
              emptyTitle="No leave records"
            />
          </TabPanel>

          <TabPanel value={tab} index={7}>
            {(isAdminOnly || isHr) && !isOwnProfile && (
              <Box mb={2}>
                <input type="file" id="emp-profile-doc" hidden multiple onChange={handleDocUpload} />
                <label htmlFor="emp-profile-doc">
                  <Button component="span" variant="outlined" size="small" startIcon={<Upload size={16} />}>Upload Document</Button>
                </label>
              </Box>
            )}
            {(employee.documents || []).map((d) => (
              <Box key={d.id} display="flex" justifyContent="space-between" py={1.5} borderBottom={`1px solid ${colors.border}`}>
                <Box>
                  <Typography fontWeight={500}>{d.title}</Typography>
                  <Typography variant="caption" color="text.secondary">{d.type.replace('_', ' ')}</Typography>
                </Box>
                <Typography component="button" onClick={() => handleDocDownload(d)} color="primary" variant="body2" sx={{ border: 'none', bgcolor: 'transparent', cursor: 'pointer' }}>Download</Typography>
              </Box>
            ))}
            {!employee.documents?.length && <EmptyState title="No documents" />}
          </TabPanel>
        </Box>
      </Card>

      <EmployeeEditModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        employee={employee}
        departments={departments}
        managers={managers}
        isAdminMode={canAdminEdit}
        onSubmit={handleSaveEdit}
        loading={saving}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDeactivate}
        title="Deactivate Employee"
        message={`Are you sure you want to deactivate ${getFullName(employee.first_name, employee.last_name)}? They will no longer be able to log in.`}
        confirmLabel="Deactivate"
        danger
        loading={deleting}
      />
    </Box>
  );
};

export default EmployeeProfile;
