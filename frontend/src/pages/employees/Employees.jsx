import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Grid, Stepper, Step, StepLabel, Typography, ToggleButton, ToggleButtonGroup,
  Checkbox, FormControlLabel, FormGroup,
} from '@mui/material';
import { Plus, Upload, FileText, Trash2, Pencil } from 'lucide-react';
import { toast } from 'react-toastify';
import { useForm, Controller } from 'react-hook-form';
import { useAuth } from '../../context/AuthContext';
import { employeeAPI, departmentAPI, documentAPI } from '../../services/services';
import EmployeeEditModal from '../../components/employees/EmployeeEditModal';
import {
  PageHeader, DataTable, SearchBar, Select, Button, Modal, Input, Avatar, StatusBadge, Loader, ConfirmDialog,
} from '../../components/ui';
import { getFullName, getErrorMessage, downloadBlob } from '../../utils/helpers';

const STEPS = ['Employee Type', 'Profile & Salary', 'Documents'];

const EMPLOYEE_TYPES = [
  { value: 'employee', label: 'Employee' },
  { value: 'team_lead', label: 'Team Lead' },
  { value: 'hr', label: 'HR' },
  { value: 'accountant', label: 'Accountant' },
];

const Employees = () => {
  const { isAdminOnly, isHr, isTeamLead } = useAuth();
  const canManage = isAdminOnly || isHr || isTeamLead;
  const canCreateAllTypes = isAdminOnly;
  const navigate = useNavigate();

  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [assignable, setAssignable] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 });

  const [modalOpen, setModalOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [createdEmployeeId, setCreatedEmployeeId] = useState(null);
  const [employeeType, setEmployeeType] = useState('employee');
  const [selectedTeamIds, setSelectedTeamIds] = useState([]);
  const [credentialsInfo, setCredentialsInfo] = useState(null);
  const [editEmployee, setEditEmployee] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deactivateId, setDeactivateId] = useState(null);
  const [deactivating, setDeactivating] = useState(false);

  const { register, handleSubmit, reset, control, watch, formState: { errors } } = useForm();
  const [pendingFiles, setPendingFiles] = useState([]);
  const passwordValue = watch('password');

  useEffect(() => {
    if (!canManage) navigate('/dashboard');
  }, [canManage, navigate]);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const { data } = await employeeAPI.getAll({
        search, department, status, page: pagination.page, limit: pagination.limit,
      });
      setEmployees(data.data);
      setPagination((p) => ({ ...p, total: data.pagination.total }));
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    departmentAPI.getAll().then(({ data }) => setDepartments(data.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!modalOpen && !editEmployee) return;
    employeeAPI.getAll({ limit: 200, status: 'active' })
      .then(({ data }) => {
        const list = data.data || [];
        const managerRoles = ['hr', 'team_lead', 'manager'];
        if (isAdminOnly) managerRoles.unshift('admin');
        setManagers(list.filter((e) => managerRoles.includes(e.role)));
      })
      .catch(() => setManagers([]));
  }, [modalOpen, editEmployee, isAdminOnly]);

  useEffect(() => { fetchEmployees(); }, [search, department, status, pagination.page, pagination.limit]);

  const loadAssignable = async () => {
    if (!canCreateAllTypes) return;
    try {
      const { data } = await employeeAPI.getAssignable({ search: '' });
      setAssignable(data.data || []);
    } catch {
      setAssignable([]);
    }
  };

  useEffect(() => {
    if (modalOpen && employeeType === 'team_lead') loadAssignable();
  }, [modalOpen, employeeType]);

  const resetModal = () => {
    setModalOpen(false);
    setActiveStep(0);
    setCreatedEmployeeId(null);
    setEmployeeType('employee');
    setSelectedTeamIds([]);
    setPendingFiles([]);
    setCredentialsInfo(null);
    reset();
  };

  const onSubmitProfile = async (formData) => {
    if (!canCreateAllTypes && employeeType !== 'employee') {
      toast.error('Only admin can create HR or Team Lead accounts');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        employeeType,
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        gender: formData.gender,
        dateOfBirth: formData.dateOfBirth,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        pincode: formData.pincode,
        emergencyContactName: formData.emergencyContactName,
        emergencyContactPhone: formData.emergencyContactPhone,
        departmentId: formData.departmentId,
        designation: formData.designation,
        joiningDate: formData.joiningDate,
        employmentType: formData.employmentType || 'full-time',
        reportingManagerId: formData.reportingManagerId || null,
        panNumber: formData.panNumber,
        aadharNumber: formData.aadharNumber,
        bankAccountHolder: formData.bankAccountHolder,
        bankAccountNumber: formData.bankAccountNumber,
        bankName: formData.bankName,
        bankIfsc: formData.bankIfsc,
        bankBranch: formData.bankBranch,
        basicSalary: formData.basicSalary,
        hra: formData.hra,
        transportAllowance: formData.transportAllowance,
        medicalAllowance: formData.medicalAllowance,
        specialAllowance: formData.specialAllowance,
        pfDeduction: formData.pfDeduction,
        taxDeduction: formData.taxDeduction,
        otherDeductions: formData.otherDeductions,
        teamMemberIds: employeeType === 'team_lead' ? selectedTeamIds : [],
      };

      const { data } = await employeeAPI.create(payload);
      setCreatedEmployeeId(data.id);
      setCredentialsInfo({
        employeeCode: data.employeeCode,
        emailSent: data.emailSent,
        tempPassword: data.tempPassword,
        emailMessage: data.emailMessage,
      });
      toast.success(data.emailSent ? 'Employee created — credentials emailed' : 'Employee created');
      setActiveStep(2);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    setPendingFiles((prev) => [...prev, ...files.map((file) => ({ file, type: 'other' }))]);
  };

  const finishAndClose = async () => {
    setSubmitting(true);
    try {
      for (const item of pendingFiles) {
        const fd = new FormData();
        fd.append('employeeId', createdEmployeeId);
        fd.append('type', item.type);
        fd.append('title', item.file.name);
        fd.append('document', item.file);
        await documentAPI.upload(fd);
      }
      toast.success('Employee setup complete');
      resetModal();
      fetchEmployees();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleTeamMember = (id) => {
    setSelectedTeamIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleExport = async () => {
    try {
      const { data } = await employeeAPI.export();
      downloadBlob(data, 'employees.xlsx');
      toast.success('Exported successfully');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleSaveEdit = async (payload) => {
    if (!editEmployee) return;
    setSavingEdit(true);
    try {
      await employeeAPI.update(editEmployee.id, payload);
      toast.success('Employee updated');
      setEditEmployee(null);
      fetchEmployees();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateId) return;
    setDeactivating(true);
    try {
      await employeeAPI.delete(deactivateId);
      toast.success('Employee deactivated');
      setDeactivateId(null);
      fetchEmployees();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeactivating(false);
    }
  };

  const openEdit = async (row) => {
    try {
      const { data } = await employeeAPI.getById(row.id);
      setEditEmployee(data.data);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const columns = [
    {
      field: 'first_name',
      headerName: 'Employee',
      renderCell: ({ row }) => (
        <Box display="flex" alignItems="center" gap={1.5}>
          <Avatar name={getFullName(row.first_name, row.last_name)} src={row.avatar} size={36} />
          <Box>
            <Box fontWeight={500}>{getFullName(row.first_name, row.last_name)}</Box>
            <Box fontSize="0.75rem" color="text.secondary">{row.employee_id}</Box>
          </Box>
        </Box>
      ),
    },
    { field: 'email', headerName: 'Email' },
    { field: 'role', headerName: 'Role', renderCell: ({ value }) => <StatusBadge status={value?.replace('_', ' ') || 'employee'} /> },
    { field: 'department_name', headerName: 'Department' },
    { field: 'designation', headerName: 'Designation' },
    {
      field: 'is_active',
      headerName: 'Status',
      renderCell: ({ value }) => <StatusBadge status={value ? 'active' : 'inactive'} />,
    },
  ];

  const modalActions = () => {
    if (activeStep === 0) {
      return (
        <>
          <Button variant="outlined" onClick={resetModal}>Cancel</Button>
          <Button onClick={() => setActiveStep(1)}>Next</Button>
        </>
      );
    }
    if (activeStep === 1) {
      return (
        <>
          <Button variant="text" onClick={() => setActiveStep(0)}>Back</Button>
          <Button onClick={handleSubmit(onSubmitProfile)} loading={submitting}>Create Employee</Button>
        </>
      );
    }
    return (
      <>
        <Button variant="text" onClick={finishAndClose}>Skip & Finish</Button>
        <Button onClick={finishAndClose} loading={submitting}>Finish</Button>
      </>
    );
  };

  const availableTypes = canCreateAllTypes
    ? EMPLOYEE_TYPES
    : EMPLOYEE_TYPES.filter((t) => t.value === 'employee');

  return (
    <Box>
      <PageHeader
        title="Employees"
        subtitle={isTeamLead ? 'Your team members' : 'Manage your workforce'}
        breadcrumb={[{ label: 'Employees', path: '/employees' }]}
      />

      <Box display="flex" gap={2} mb={3} alignItems="center" flexWrap="nowrap">
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Search employees..." fullWidth />
        </Box>
        <Box sx={{ width: 180, flexShrink: 0 }}>
          <Select
            label="Department"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            options={[{ value: '', label: 'All Departments' }, ...departments.map((d) => ({ value: d.id, label: d.name }))]}
            fullWidth
          />
        </Box>
        <Box sx={{ width: 140, flexShrink: 0 }}>
          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={[
              { value: '', label: 'All' },
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ]}
            fullWidth
          />
        </Box>
        {(isAdminOnly || isHr) && (
          <Button startIcon={<Plus size={18} />} onClick={() => setModalOpen(true)} sx={{ flexShrink: 0 }}>
            Add Employee
          </Button>
        )}
      </Box>

      <DataTable
        columns={columns}
        rows={employees}
        loading={loading}
        pagination={pagination}
        onPageChange={(page) => setPagination((p) => ({ ...p, page }))}
        onRowsPerPageChange={(limit) => setPagination((p) => ({ ...p, limit, page: 1 }))}
        onExport={isAdminOnly || isHr ? handleExport : undefined}
        actions={(row) => row ? [
          { label: 'View Profile', onClick: () => navigate(`/employees/${row.id}`) },
          ...(isAdminOnly || isHr ? [{ label: 'Edit', onClick: () => openEdit(row) }] : []),
          ...(isAdminOnly && row.role !== 'admin' ? [{ label: 'Deactivate', onClick: () => setDeactivateId(row.id) }] : []),
        ] : []}
      />

      <EmployeeEditModal
        open={!!editEmployee}
        onClose={() => setEditEmployee(null)}
        employee={editEmployee}
        departments={departments}
        managers={managers}
        isAdminMode
        onSubmit={handleSaveEdit}
        loading={savingEdit}
      />

      <ConfirmDialog
        open={!!deactivateId}
        onClose={() => setDeactivateId(null)}
        onConfirm={handleDeactivate}
        title="Deactivate Employee"
        message="Are you sure you want to deactivate this employee? They will no longer be able to log in."
        confirmLabel="Deactivate"
        danger
        loading={deactivating}
      />

      <Modal
        open={modalOpen}
        onClose={resetModal}
        title="Add Employee"
        subtitle={STEPS[activeStep]}
        maxWidth="md"
        actions={modalActions()}
      >
        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {STEPS.map((label) => (
            <Step key={label}><StepLabel>{label}</StepLabel></Step>
          ))}
        </Stepper>

        {activeStep === 0 && (
          <Box>
            <Typography variant="body2" color="text.secondary" mb={2}>Select employee type</Typography>
            <ToggleButtonGroup
              exclusive
              value={employeeType}
              onChange={(_, v) => v && setEmployeeType(v)}
              fullWidth
            >
              {availableTypes.map((t) => (
                <ToggleButton key={t.value} value={t.value} sx={{ flex: 1, py: 2 }}>
                  {t.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
        )}

        {activeStep === 1 && (
          <Grid container spacing={2}>
            <Grid size={12}>
              <Typography variant="subtitle2" color="primary" fontWeight={700}>Login Credentials</Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Input label="Email" type="email" error={errors.email?.message} {...register('email', { required: 'Required' })} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Input
                label="Password"
                type="password"
                error={errors.password?.message}
                {...register('password', {
                  required: 'Password is required',
                  minLength: { value: 6, message: 'Min 6 characters' },
                })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Input
                label="Confirm Password"
                type="password"
                error={errors.confirmPassword?.message}
                {...register('confirmPassword', {
                  required: 'Please confirm password',
                  validate: (val) => val === passwordValue || 'Passwords do not match',
                })}
              />
            </Grid>

            <Grid size={12}>
              <Typography variant="subtitle2" color="primary" fontWeight={700} mt={1}>Personal Information</Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Input label="First Name" error={errors.firstName?.message} {...register('firstName', { required: 'Required' })} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Input label="Last Name" error={errors.lastName?.message} {...register('lastName', { required: 'Required' })} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Input label="Phone" error={errors.phone?.message} {...register('phone', { required: 'Required' })} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Input label="Date of Birth" type="date" InputLabelProps={{ shrink: true }} {...register('dateOfBirth')} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller
                name="gender"
                control={control}
                render={({ field }) => (
                  <Select
                    label="Gender"
                    value={field.value || ''}
                    onChange={field.onChange}
                    options={[
                      { value: 'male', label: 'Male' },
                      { value: 'female', label: 'Female' },
                      { value: 'other', label: 'Other' },
                    ]}
                  />
                )}
              />
            </Grid>
            <Grid size={12}>
              <Input label="Address" {...register('address')} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Input label="City" {...register('city')} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Input label="State" {...register('state')} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Input label="Pincode" {...register('pincode')} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Input label="Emergency Contact Name" {...register('emergencyContactName')} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Input label="Emergency Contact Phone" {...register('emergencyContactPhone')} />
            </Grid>

            <Grid size={12}>
              <Typography variant="subtitle2" color="primary" fontWeight={700} mt={1}>Professional Information</Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller
                name="departmentId"
                control={control}
                rules={{ required: 'Required' }}
                render={({ field }) => (
                  <Select
                    label="Department"
                    value={field.value || ''}
                    onChange={field.onChange}
                    options={departments.map((d) => ({ value: d.id, label: d.name }))}
                  />
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Input label="Designation" error={errors.designation?.message} {...register('designation', { required: 'Required' })} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller
                name="employmentType"
                control={control}
                defaultValue="full-time"
                render={({ field }) => (
                  <Select
                    label="Employment Type"
                    value={field.value}
                    onChange={field.onChange}
                    options={[
                      { value: 'full-time', label: 'Full Time' },
                      { value: 'part-time', label: 'Part Time' },
                      { value: 'contract', label: 'Contract' },
                      { value: 'intern', label: 'Intern' },
                    ]}
                  />
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Input label="Joining Date" type="date" InputLabelProps={{ shrink: true }} error={errors.joiningDate?.message} {...register('joiningDate', { required: 'Required' })} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller
                name="reportingManagerId"
                control={control}
                render={({ field }) => (
                  <Select
                    label="Reporting Manager"
                    value={field.value || ''}
                    onChange={field.onChange}
                    options={[
                      { value: '', label: 'None' },
                      ...managers.map((m) => ({
                        value: m.id,
                        label: `${m.first_name} ${m.last_name} (${m.employee_id})`,
                      })),
                    ]}
                  />
                )}
              />
            </Grid>

            <Grid size={12}>
              <Typography variant="subtitle2" color="primary" fontWeight={700} mt={1}>Bank & Government Details</Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Input label="Bank Name" {...register('bankName')} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Input label="Account Number" {...register('bankAccountNumber')} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Input label="IFSC Code" {...register('bankIfsc')} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Input label="Branch" {...register('bankBranch')} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Input label="Account Holder Name" {...register('bankAccountHolder')} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Input label="PAN" {...register('panNumber')} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Input label="Aadhaar" {...register('aadharNumber')} />
            </Grid>

            <Grid size={12}>
              <Typography variant="subtitle2" color="primary" fontWeight={700} mt={1}>Salary Structure</Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Input label="Basic Salary" type="number" {...register('basicSalary')} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Input label="HRA" type="number" {...register('hra')} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Input label="Transport Allowance" type="number" {...register('transportAllowance')} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Input label="Medical Allowance" type="number" {...register('medicalAllowance')} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Input label="Special Allowance" type="number" {...register('specialAllowance')} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Input label="PF Deduction" type="number" {...register('pfDeduction')} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Input label="Tax Deduction" type="number" {...register('taxDeduction')} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Input label="Other Deductions" type="number" {...register('otherDeductions')} />
            </Grid>

            {employeeType === 'team_lead' && (
              <Grid size={12}>
                <Typography variant="subtitle2" mb={1} mt={1}>Team Members</Typography>
                <FormGroup sx={{ maxHeight: 200, overflow: 'auto', border: '1px solid #E5E7EB', borderRadius: 2, p: 1 }}>
                  {assignable.map((emp) => (
                    <FormControlLabel
                      key={emp.id}
                      control={
                        <Checkbox
                          checked={selectedTeamIds.includes(emp.id)}
                          onChange={() => toggleTeamMember(emp.id)}
                        />
                      }
                      label={`${emp.first_name} ${emp.last_name} (${emp.employee_id})`}
                    />
                  ))}
                  {!assignable.length && (
                    <Typography variant="caption" color="text.secondary" p={1}>No unassigned employees available</Typography>
                  )}
                </FormGroup>
              </Grid>
            )}

            <Grid size={12}>
              <Typography variant="caption" color="text.secondary">
                Employee ID is generated automatically. Login email and password will be used for the employee account.
              </Typography>
            </Grid>
          </Grid>
        )}

        {activeStep === 2 && (
          <Box>
            {credentialsInfo && (
              <Box mb={2} p={2} bgcolor="#F0FDF4" borderRadius={2}>
                <Typography variant="subtitle2" color="success.main">Employee Created</Typography>
                <Typography variant="body2">ID: {credentialsInfo.employeeCode}</Typography>
                <Typography variant="body2">{credentialsInfo.emailMessage}</Typography>
                {credentialsInfo.tempPassword && (
                  <Typography variant="body2" mt={1}>
                    Temporary password (SMTP not configured): <strong>{credentialsInfo.tempPassword}</strong>
                  </Typography>
                )}
              </Box>
            )}
            <input type="file" id="emp-doc-upload" hidden multiple onChange={handleFileSelect} />
            <label htmlFor="emp-doc-upload">
              <Button component="span" variant="outlined" startIcon={<Upload size={18} />}>
                Upload Documents
              </Button>
            </label>
            <Box mt={2} display="flex" flexDirection="column" gap={1}>
              {pendingFiles.map((item, index) => (
                <Box key={index} display="flex" alignItems="center" justifyContent="space-between" p={1.5} border="1px solid #E5E7EB" borderRadius={2}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <FileText size={18} />
                    <Typography variant="body2">{item.file.name}</Typography>
                  </Box>
                  <Button size="small" variant="text" color="error" onClick={() => setPendingFiles((p) => p.filter((_, i) => i !== index))}>
                    <Trash2 size={16} />
                  </Button>
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </Modal>
    </Box>
  );
};

export default Employees;
