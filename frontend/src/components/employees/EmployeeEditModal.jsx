import { useEffect } from 'react';
import { Grid, Typography } from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { Modal, Input, Select, Button } from '../ui';

const toDateInput = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

const EmployeeEditModal = ({
  open,
  onClose,
  employee,
  departments = [],
  managers = [],
  isAdminMode = false,
  onSubmit,
  loading = false,
}) => {
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm();

  useEffect(() => {
    if (!employee || !open) return;
    reset({
      firstName: employee.first_name || '',
      lastName: employee.last_name || '',
      phone: employee.phone || '',
      dateOfBirth: toDateInput(employee.date_of_birth),
      gender: employee.gender || '',
      address: employee.address || '',
      city: employee.city || '',
      state: employee.state || '',
      country: employee.country || 'India',
      pincode: employee.pincode || '',
      emergencyContactName: employee.emergency_contact_name || '',
      emergencyContactPhone: employee.emergency_contact_phone || '',
      departmentId: employee.department_id || '',
      designation: employee.designation || '',
      employmentType: employee.employment_type || 'full-time',
      joiningDate: toDateInput(employee.joining_date),
      reportingManagerId: employee.reporting_manager_id || '',
      bankName: employee.bank_name || '',
      bankAccountNumber: employee.bank_account_number || '',
      bankIfsc: employee.bank_ifsc || '',
      bankBranch: employee.bank_branch || '',
      bankAccountHolder: employee.bank_account_holder || '',
      panNumber: employee.pan_number || '',
      aadharNumber: employee.aadhar_number || '',
      employmentStatus: employee.employment_status || 'ACTIVE',
    });
  }, [employee, open, reset]);

  const handleFormSubmit = (formData) => {
    const payload = {
      first_name: formData.firstName,
      last_name: formData.lastName,
      phone: formData.phone,
      date_of_birth: formData.dateOfBirth || null,
      gender: formData.gender || null,
      address: formData.address || null,
      city: formData.city || null,
      state: formData.state || null,
      country: formData.country || null,
      pincode: formData.pincode || null,
      emergency_contact_name: formData.emergencyContactName || null,
      emergency_contact_phone: formData.emergencyContactPhone || null,
    };

    if (isAdminMode) {
      Object.assign(payload, {
        department_id: formData.departmentId || null,
        designation: formData.designation || null,
        employment_type: formData.employmentType || null,
        joining_date: formData.joiningDate || null,
        reporting_manager_id: formData.reportingManagerId || null,
        bank_name: formData.bankName || null,
        bank_account_number: formData.bankAccountNumber || null,
        bank_ifsc: formData.bankIfsc || null,
        bank_branch: formData.bankBranch || null,
        bank_account_holder: formData.bankAccountHolder || null,
        pan_number: formData.panNumber || null,
        aadhar_number: formData.aadharNumber || null,
        employment_status: formData.employmentStatus || null,
      });
    }

    onSubmit(payload);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isAdminMode ? 'Edit Employee' : 'Edit Profile'}
      subtitle="Update personal and professional details"
      maxWidth="md"
      actions={
        <>
          <Button variant="outlined" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit(handleFormSubmit)} loading={loading}>Save Changes</Button>
        </>
      }
    >
      <Grid container spacing={2}>
        <Grid size={12}>
          <Typography variant="subtitle2" color="primary" fontWeight={700}>Personal Information</Typography>
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
                  { value: '', label: 'Select' },
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

        {isAdminMode && (
          <>
            <Grid size={12}>
              <Typography variant="subtitle2" color="primary" fontWeight={700} mt={1}>Professional Information</Typography>
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
              <Input label="Designation" {...register('designation')} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller
                name="employmentType"
                control={control}
                render={({ field }) => (
                  <Select
                    label="Employment Type"
                    value={field.value || 'full-time'}
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
              <Input label="Joining Date" type="date" InputLabelProps={{ shrink: true }} {...register('joiningDate')} />
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
          </>
        )}
      </Grid>
    </Modal>
  );
};

export default EmployeeEditModal;
