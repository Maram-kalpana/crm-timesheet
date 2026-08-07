import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Grid, Stepper, Step, StepLabel, Typography } from '@mui/material';
import { Plus, Upload, FileText, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { useForm, Controller } from 'react-hook-form';
import { useAuth } from '../../context/AuthContext';
import { employeeAPI, departmentAPI, payrollAPI, documentAPI } from '../../services/services';
import {
  PageHeader, DataTable, SearchBar, Select, Button, Modal, Input, Avatar, StatusBadge, Loader,
} from '../../components/ui';
import { getFullName, getErrorMessage, downloadBlob } from '../../utils/helpers';

const STEPS = ['Employee Info', 'Salary', 'Documents'];

const Employees = () => {
  const { isAdmin, isManager } = useAuth();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 });

  const [modalOpen, setModalOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [createdEmployeeId, setCreatedEmployeeId] = useState(null);

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm();
  const salaryForm = useForm();
  const [pendingFiles, setPendingFiles] = useState([]);

  useEffect(() => {
    if (!isAdmin && !isManager) navigate('/dashboard');
  }, [isAdmin, isManager, navigate]);

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

  useEffect(() => { fetchEmployees(); }, [search, department, status, pagination.page, pagination.limit]);

  const resetModal = () => {
    setModalOpen(false);
    setActiveStep(0);
    setCreatedEmployeeId(null);
    setPendingFiles([]);
    reset();
    salaryForm.reset();
  };

  // Step 1: create employee
  const onSubmitEmployee = async (formData) => {
    setSubmitting(true);
    try {
      const { data } = await employeeAPI.create({
        employeeId: formData.employeeId,
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        departmentId: formData.departmentId,
        designation: formData.designation,
        joiningDate: formData.joiningDate,
        role: formData.role || 'employee',
      });
      const newId = data?.data?.id || data?.employee?.id || data?.id;
      setCreatedEmployeeId(newId);
      toast.success('Employee created — now add salary details');
      setActiveStep(1);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  // Step 2: salary
  const onSubmitSalary = async (formData) => {
    setSubmitting(true);
    try {
      await payrollAPI.updateSalary(createdEmployeeId, {
        basicSalary: Number(formData.basicSalary) || 0,
        hra: Number(formData.hra) || 0,
        allowances: Number(formData.allowances) || 0,
        deductions: Number(formData.deductions) || 0,
      });
      toast.success('Salary details saved');
      setActiveStep(2);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const skipSalary = () => setActiveStep(2);

  // Step 3: documents
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    setPendingFiles((prev) => [...prev, ...files.map((file) => ({ file, type: 'Other' }))]);
  };

  const removeFile = (index) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const finishAndClose = async () => {
    setSubmitting(true);
    try {
      for (const item of pendingFiles) {
        const fd = new FormData();
        fd.append('employeeId', createdEmployeeId);
        fd.append('type', item.type);
        fd.append('file', item.file);
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

  const handleExport = async () => {
    try {
      const { data } = await employeeAPI.export();
      downloadBlob(data, 'employees.xlsx');
      toast.success('Exported successfully');
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
    { field: 'department_name', headerName: 'Department' },
    { field: 'designation', headerName: 'Designation' },
    { field: 'joining_date', headerName: 'Joined' },
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
          <Button onClick={handleSubmit(onSubmitEmployee)} loading={submitting}>Next: Salary</Button>
        </>
      );
    }
    if (activeStep === 1) {
      return (
        <>
          <Button variant="text" onClick={skipSalary}>Skip</Button>
          <Button onClick={salaryForm.handleSubmit(onSubmitSalary)} loading={submitting}>Next: Documents</Button>
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

  return (
    <Box>
      <PageHeader
        title="Employees"
        subtitle="Manage your workforce"
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
        <Button startIcon={<Plus size={18} />} onClick={() => setModalOpen(true)} sx={{ flexShrink: 0 }}>
          Add Employee
        </Button>
      </Box>

      <DataTable
        columns={columns}
        rows={employees}
        loading={loading}
        pagination={pagination}
        onPageChange={(page) => setPagination((p) => ({ ...p, page }))}
        onRowsPerPageChange={(limit) => setPagination((p) => ({ ...p, limit, page: 1 }))}
        onExport={handleExport}
        actions={(row) => row ? [
          { label: 'View Profile', onClick: () => navigate(`/employees/${row.id}`) },
        ] : []}
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
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Input label="Employee ID" error={errors.employeeId?.message} {...register('employeeId', { required: 'Required' })} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Input label="Email" type="email" error={errors.email?.message} {...register('email', { required: 'Required' })} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Input label="First Name" error={errors.firstName?.message} {...register('firstName', { required: 'Required' })} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Input label="Last Name" error={errors.lastName?.message} {...register('lastName', { required: 'Required' })} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Input label="Phone" {...register('phone')} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Input label="Password" type="password" error={errors.password?.message} {...register('password', { required: 'Required' })} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Input label="Designation" {...register('designation')} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Input label="Joining Date" type="date" InputLabelProps={{ shrink: true }} {...register('joiningDate')} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller
                name="departmentId"
                control={control}
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
              <Controller
                name="role"
                control={control}
                defaultValue="employee"
                render={({ field }) => (
                  <Select
                    label="Role"
                    value={field.value || 'employee'}
                    onChange={field.onChange}
                    options={[
                      { value: 'employee', label: 'Employee' },
                      { value: 'manager', label: 'Manager' },
                      { value: 'hr', label: 'HR' },
                      { value: 'admin', label: 'Admin' },
                    ]}
                  />
                )}
              />
            </Grid>
          </Grid>
        )}

        {activeStep === 1 && (
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Input label="Basic Salary" type="number" {...salaryForm.register('basicSalary')} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Input label="HRA" type="number" {...salaryForm.register('hra')} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Input label="Other Allowances" type="number" {...salaryForm.register('allowances')} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Input label="Deductions" type="number" {...salaryForm.register('deductions')} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Typography variant="caption" color="text.secondary">
                You can skip this and set salary later from the employee's profile.
              </Typography>
            </Grid>
          </Grid>
        )}

        {activeStep === 2 && (
          <Box>
            <input type="file" id="doc-upload" hidden multiple onChange={handleFileSelect} />
            <label htmlFor="doc-upload">
              <Button component="span" variant="outlined" startIcon={<Upload size={18} />}>
                Upload Documents
              </Button>
            </label>

            <Box mt={2} display="flex" flexDirection="column" gap={1}>
              {pendingFiles.map((item, index) => (
                <Box
                  key={index}
                  display="flex"
                  alignItems="center"
                  justifyContent="space-between"
                  p={1.5}
                  border="1px solid #E5E7EB"
                  borderRadius={2}
                >
                  <Box display="flex" alignItems="center" gap={1}>
                    <FileText size={18} />
                    <Typography variant="body2">{item.file.name}</Typography>
                  </Box>
                  <Button size="small" variant="text" color="error" onClick={() => removeFile(index)}>
                    <Trash2 size={16} />
                  </Button>
                </Box>
              ))}
              {!pendingFiles.length && (
                <Typography variant="caption" color="text.secondary">
                  No documents added yet. You can also upload these later from the employee's profile.
                </Typography>
              )}
            </Box>
          </Box>
        )}
      </Modal>
    </Box>
  );
};

export default Employees;