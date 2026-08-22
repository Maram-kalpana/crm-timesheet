import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import {
  Box, Typography, Link as MuiLink, IconButton, Grid, Paper,
} from '@mui/material';
import {
  Mail, Lock, Eye, EyeOff, Building2, User, Phone, Shield, Hash,
} from 'lucide-react';
import { authAPI } from '../../services/services';
import { Button, Input } from '../../components/ui';
import { colors } from '../../theme';
import { getErrorMessage } from '../../utils/helpers';

const Register = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { register, handleSubmit, watch, formState: { errors } } = useForm();

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await authAPI.registerAdmin({
        name: data.name,
        companyName: data.companyName,
        companyEmail: data.companyEmail,
        phone: data.phone,
        registrationNumber: data.registrationNumber,
        password: data.password,
        confirmPassword: data.confirmPassword,
      });
      toast.success('Company registered. Please sign in.');
      navigate('/login', { state: { email: data.companyEmail } });
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', bgcolor: colors.background }}>
      <Box
        sx={{
          flex: 1, display: { xs: 'none', lg: 'flex' },
          flexDirection: 'column', justifyContent: 'center',
          background: `linear-gradient(135deg, ${colors.primary} 0%, #1E40AF 50%, #1E3A8A 100%)`,
          color: '#fff', p: 6, position: 'relative', overflow: 'hidden',
        }}
      >
        <Box sx={{ position: 'absolute', inset: 0, opacity: 0.1, background: 'radial-gradient(circle at 80% 20%, white 0%, transparent 50%)' }} />
        <Box sx={{ position: 'relative', zIndex: 1, maxWidth: 480 }}>
          <Box display="flex" alignItems="center" gap={2} mb={4}>
            <Box sx={{ width: 48, height: 48, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={28} />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight={700}>Company Registration</Typography>
              <Typography variant="body2" sx={{ opacity: 0.8 }}>Create your admin workspace</Typography>
            </Box>
          </Box>
          <Typography variant="h3" fontWeight={700} mb={2} lineHeight={1.2}>
            Register your company on HRMS
          </Typography>
          <Typography variant="body1" sx={{ opacity: 0.85, lineHeight: 1.7 }}>
            Set up your organization, then choose country and currency after your first sign-in.
          </Typography>
        </Box>
      </Box>

      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: { xs: 2, sm: 4 }, overflow: 'auto' }}>
        <Paper
          elevation={0}
          sx={{
            width: '100%', maxWidth: 480, p: { xs: 3, sm: 4 }, my: 4,
            borderRadius: 4,
            background: 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(20px)',
            border: `1px solid ${colors.border}`,
            boxShadow: '0 8px 32px rgba(37, 99, 235, 0.08)',
          }}
        >
          <Box mb={3}>
            <Typography variant="h5" fontWeight={700}>Register your company</Typography>
            <Typography variant="body2" color="text.secondary" mt={0.5}>
              Create the administrator account for your organization
            </Typography>
          </Box>

          <form onSubmit={handleSubmit(onSubmit)}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12 }}>
                <Input
                  label="Admin Name"
                  startIcon={<User size={18} />}
                  placeholder="John Doe"
                  error={errors.name?.message}
                  {...register('name', { required: 'Admin name is required' })}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Input
                  label="Company Name"
                  startIcon={<Building2 size={18} />}
                  error={errors.companyName?.message}
                  {...register('companyName', { required: 'Company name is required' })}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Input
                  label="Company Email"
                  type="email"
                  startIcon={<Mail size={18} />}
                  error={errors.companyEmail?.message}
                  {...register('companyEmail', {
                    required: 'Company email is required',
                    pattern: { value: /^\S+@\S+\.\S+$/, message: 'Invalid email' },
                  })}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Input
                  label="Phone Number"
                  startIcon={<Phone size={18} />}
                  error={errors.phone?.message}
                  {...register('phone', { required: 'Phone number is required' })}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Input
                  label="Registration Number"
                  startIcon={<Hash size={18} />}
                  error={errors.registrationNumber?.message}
                  {...register('registrationNumber', { required: 'Registration number is required' })}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Input
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  startIcon={<Lock size={18} />}
                  endIcon={
                    <IconButton size="small" onClick={() => setShowPassword(!showPassword)} edge="end">
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </IconButton>
                  }
                  error={errors.password?.message}
                  {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'Min 6 characters' } })}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Input
                  label="Confirm Password"
                  type={showConfirm ? 'text' : 'password'}
                  startIcon={<Lock size={18} />}
                  endIcon={
                    <IconButton size="small" onClick={() => setShowConfirm(!showConfirm)} edge="end">
                      {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                    </IconButton>
                  }
                  error={errors.confirmPassword?.message}
                  {...register('confirmPassword', {
                    required: 'Please confirm password',
                    validate: (val) => val === watch('password') || 'Passwords do not match',
                  })}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Button type="submit" fullWidth loading={loading} size="large">
                  Register Company
                </Button>
              </Grid>
            </Grid>
          </form>

          <Typography variant="body2" color="text.secondary" textAlign="center" mt={3}>
            Already have an account?{' '}
            <MuiLink component={Link} to="/login" underline="hover" color="primary" fontWeight={500}>
              Sign in
            </MuiLink>
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
};

export default Register;
