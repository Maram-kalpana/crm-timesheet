import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { Box, Typography, Paper, Link as MuiLink } from '@mui/material';
import { Mail, ArrowLeft } from 'lucide-react';
import { authAPI } from '../../services/services';
import { Button, Input } from '../../components/ui';
import { colors } from '../../theme';
import { getErrorMessage } from '../../utils/helpers';

const ForgotPassword = () => {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await authAPI.forgotPassword(data.email);
      setSent(true);
      toast.success('Reset link sent if email exists.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box minHeight="100vh" display="flex" alignItems="center" justifyContent="center" bgcolor={colors.background} p={2}>
      <Paper sx={{ maxWidth: 420, width: '100%', p: 4, borderRadius: 4, border: `1px solid ${colors.border}` }}>
        <MuiLink component={Link} to="/login" display="flex" alignItems="center" gap={1} mb={3} color="text.secondary" underline="none">
          <ArrowLeft size={16} /> Back to login
        </MuiLink>
        <Typography variant="h5" fontWeight={700} mb={1}>Forgot password?</Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          Enter your email and we'll send you a reset link.
        </Typography>
        {sent ? (
          <Typography color="success.main">Check your email for the reset link.</Typography>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)}>
            <Input
              label="Email Address"
              type="email"
              startIcon={<Mail size={18} />}
              error={errors.email?.message}
              sx={{ mb: 3 }}
              {...register('email', { required: 'Email is required' })}
            />
            <Button type="submit" fullWidth loading={loading}>Send Reset Link</Button>
          </form>
        )}
      </Paper>
    </Box>
  );
};

export default ForgotPassword;
