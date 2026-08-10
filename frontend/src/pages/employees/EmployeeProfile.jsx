import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Grid, Typography, Tabs, Tab, Divider,
} from '@mui/material';
import { toast } from 'react-toastify';
import { employeeAPI, documentAPI } from '../../services/services';
import { useAuth } from '../../context/AuthContext';
import {
  PageHeader, Card, Avatar, StatusBadge, Loader, DataTable, EmptyState,
} from '../../components/ui';
import { colors } from '../../theme';
import { formatDate, formatCurrency, getFullName, getErrorMessage, downloadBlob } from '../../utils/helpers';

const TabPanel = ({ children, value, index }) => (
  <Box hidden={value !== index} pt={3}>{value === index && children}</Box>
);

const EmployeeProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isEmployee } = useAuth();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    employeeAPI.getById(id)
      .then(({ data }) => {
        if (isEmployee && String(data.data.id) !== String(user?.empId)) {
          toast.error('Access denied');
          navigate('/dashboard');
          return;
        }
        setEmployee(data.data);
      })
      .catch((err) => {
        toast.error(getErrorMessage(err));
        navigate('/employees');
      })
      .finally(() => setLoading(false));
  }, [id, isEmployee, user?.empId, navigate]);

  const handleDocDownload = async (doc) => {
    try {
      const { data } = await documentAPI.download(doc.id);
      downloadBlob(data, doc.title || 'document');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  if (loading) return <Loader />;
  if (!employee) return <EmptyState title="Employee not found" description="The employee you're looking for doesn't exist." />;

  const InfoRow = ({ label, value }) => (
    <Box display="flex" justifyContent="space-between" py={1.5} borderBottom={`1px solid ${colors.border}`}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={500}>{value || '—'}</Typography>
    </Box>
  );

  return (
    <Box>
      <PageHeader
        title={getFullName(employee.first_name, employee.last_name)}
        subtitle={`${employee.designation || 'Employee'} · ${employee.department_name || 'N/A'}`}
        breadcrumb={[
          { label: 'Employees', path: '/employees' },
          { label: getFullName(employee.first_name, employee.last_name) },
        ]}
      />

      <Card sx={{ mb: 3 }}>
        <Box display="flex" alignItems="center" gap={3} flexWrap="wrap">
          <Avatar name={getFullName(employee.first_name, employee.last_name)} src={employee.avatar} size={80} />
          <Box flex={1}>
            <Typography variant="h5" fontWeight={700}>{getFullName(employee.first_name, employee.last_name)}</Typography>
            <Typography color="text.secondary">{employee.email}</Typography>
            <Box display="flex" gap={1} mt={1}>
              <StatusBadge status={employee.is_active ? 'active' : 'inactive'} />
              <StatusBadge status={employee.role} label={employee.role?.toUpperCase()} />
            </Box>
          </Box>
          <Box textAlign="right">
            <Typography variant="caption" color="text.secondary">Employee ID</Typography>
            <Typography fontWeight={600}>{employee.employee_id}</Typography>
          </Box>
        </Box>
      </Card>

      <Card padding={0}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2, borderBottom: `1px solid ${colors.border}` }}>
          {['Personal', 'Professional', 'Bank', 'Salary', 'Attendance', 'Projects', 'Leaves', 'Documents'].map((label, i) => (
            <Tab key={label} label={label} />
          ))}
        </Tabs>

        <Box px={3} pb={3}>
          <TabPanel value={tab} index={0}>
            <InfoRow label="Phone" value={employee.phone} />
            <InfoRow label="Date of Birth" value={formatDate(employee.date_of_birth)} />
            <InfoRow label="Gender" value={employee.gender} />
            <InfoRow label="Address" value={[employee.address, employee.city, employee.state, employee.pincode].filter(Boolean).join(', ')} />
            <InfoRow label="Emergency Contact" value={employee.emergency_contact_name ? `${employee.emergency_contact_name} (${employee.emergency_contact_phone})` : null} />
          </TabPanel>

          <TabPanel value={tab} index={1}>
            <InfoRow label="Department" value={employee.department_name} />
            <InfoRow label="Designation" value={employee.designation} />
            <InfoRow label="Employment Type" value={employee.employment_type} />
            <InfoRow label="Joining Date" value={formatDate(employee.joining_date)} />
            <InfoRow label="Reporting Manager" value={employee.manager_name} />
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
                <Typography variant="body2" color="text.secondary">{p.status} · {p.completion_percentage}% complete</Typography>
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
    </Box>
  );
};

export default EmployeeProfile;
