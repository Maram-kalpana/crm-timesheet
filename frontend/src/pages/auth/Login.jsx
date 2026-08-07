import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import {
  Box, Typography, Checkbox, FormControlLabel, Link as MuiLink,
  InputAdornment, IconButton, Grid, Paper,
} from '@mui/material';
import { Mail, Lock, Eye, EyeOff, Building2, Users, BarChart3, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { authAPI } from '../../services/services';
import { Button, Input, Card } from '../../components/ui';
import { colors } from '../../theme';
import { getErrorMessage } from '../../utils/helpers';

const features = [
  { icon: Users, title: 'Employee Management', desc: 'Complete lifecycle from onboarding to exit' },
  { icon: BarChart3, title: 'Smart Analytics', desc: 'Real-time insights and attendance trends' },
  { icon: Shield, title: 'Secure & Compliant', desc: 'Enterprise-grade security with role-based access' },
];

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm();

  useEffect(() => {
    authAPI.setupStatus()
      .then(({ data }) => {
        if (data.needsSetup) navigate('/register', { replace: true });
        else setNeedsSetup(false);
      })
      .catch(() => setNeedsSetup(false));
  }, [navigate]);

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await login({ email: data.email, password: data.password, rememberMe: data.rememberMe });
      toast.success('Welcome back!');
      navigate('/dashboard');
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
        <Box sx={{ position: 'absolute', inset: 0, opacity: 0.1, background: 'radial-gradient(circle at 20% 50%, white 0%, transparent 50%)' }} />
        <Box sx={{ position: 'relative', zIndex: 1, maxWidth: 480 }}>
          <Box display="flex" alignItems="center" gap={2} mb={4}>
            <Box sx={{ width: 48, height: 48, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building2 size={28} />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight={700}>HRMS Platform</Typography>
              <Typography variant="body2" sx={{ opacity: 0.8 }}>Modern HR for modern teams</Typography>
            </Box>
          </Box>
          <Typography variant="h3" fontWeight={700} mb={2} lineHeight={1.2}>
            Manage your workforce with confidence
          </Typography>
          <Typography variant="body1" sx={{ opacity: 0.85, mb: 5, lineHeight: 1.7 }}>
            Streamline attendance, leave, payroll, and projects in one beautiful platform built for software companies.
          </Typography>
          {features.map(({ icon: Icon, title, desc }) => (
            <Box key={title} display="flex" gap={2} mb={3}>
              <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={22} />
              </Box>
              <Box>
                <Typography fontWeight={600}>{title}</Typography>
                <Typography variant="body2" sx={{ opacity: 0.75 }}>{desc}</Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: { xs: 2, sm: 4 } }}>
        <Paper
          elevation={0}
          sx={{
            width: '100%', maxWidth: 440, p: { xs: 3, sm: 4 },
            borderRadius: 4,
            background: 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(20px)',
            border: `1px solid ${colors.border}`,
            boxShadow: '0 8px 32px rgba(37, 99, 235, 0.08)',
          }}
        >
          <Box textAlign="center" mb={4}>
            <Box sx={{ width: 56, height: 56, borderRadius: 3, bgcolor: `${colors.primary}15`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
              <Building2 size={28} color={colors.primary} />
            </Box>
            <Typography variant="h5" fontWeight={700}>Welcome back</Typography>
            <Typography variant="body2" color="text.secondary" mt={0.5}>Sign in to your HRMS account</Typography>
          </Box>

          <form onSubmit={handleSubmit(onSubmit)}>
            <Box display="flex" flexDirection="column" gap={2.5}>
              <Input
                label="Email Address"
                type="email"
                startIcon={<Mail size={18} />}
                error={errors.email?.message}
                {...register('email', { required: 'Email is required', pattern: { value: /^\S+@\S+\.\S+$/, message: 'Invalid email' } })}
              />
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
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <FormControlLabel
                  control={<Checkbox size="small" {...register('rememberMe')} />}
                  label={<Typography variant="body2">Remember me</Typography>}
                />
                <MuiLink component={Link} to="/forgot-password" variant="body2" underline="hover" color="primary">
                  Forgot password?
                </MuiLink>
              </Box>
              <Button type="submit" fullWidth loading={loading} size="large">
                Sign In
              </Button>
            </Box>
          </form>

          <Typography variant="caption" color="text.secondary" display="block" textAlign="center" mt={3}>
            Demo: admin@company.com / Admin@123
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
};

export default Login;
