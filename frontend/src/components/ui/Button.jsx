import { Button as MuiButton, CircularProgress } from '@mui/material';

const Button = ({
  children,
  loading = false,
  variant = 'contained',
  color = 'primary',
  size = 'medium',
  startIcon,
  endIcon,
  fullWidth,
  disabled,
  onClick,
  type = 'button',
  sx = {},
  ...props
}) => (
  <MuiButton
    variant={variant}
    color={color}
    size={size}
    startIcon={loading ? null : startIcon}
    endIcon={endIcon}
    fullWidth={fullWidth}
    disabled={disabled || loading}
    onClick={onClick}
    type={type}
    sx={{
      position: 'relative',
      overflow: 'hidden',
      transition: 'all 0.2s ease',
      '&:active': { transform: 'scale(0.98)' },
      ...sx,
    }}
    {...props}
  >
    {loading ? <CircularProgress size={20} color="inherit" /> : children}
  </MuiButton>
);

export default Button;
